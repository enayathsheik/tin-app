// B2: accounts signed in with a one-time code have no email in their token
// (isAdmin() reads it). Everything a skilled worker does must still work, and
// nothing more. Emulators only:  npm run test:rules
import { readFileSync } from "fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { applicationContact, applicationSnapshot, profileFromDocs, splitProfile } from "../../src/utils/jobProfile.js";
import { skilledAccount, skilledJobProfile } from "../../src/utils/otp.js";
import { stageUpdate } from "../../src/utils/applications.js";

const PROJECT_ID = "trade-intelligence-netwo-97997"; // see cv-per-job-storage.test.js
const ME = "plMe", OTHER = "plOther", JOB = "plJob", APP = `${JOB}_${ME}`, P = "9876500001";
const F = { name: "Ramesh", trades: ["mason"], city: "Thane", openToEmployers: true };
let testEnv;
// Exactly a phone sign-in's token: phone_number, no email.
const ctx = (uid) => testEnv.authenticatedContext(uid, { phone_number: "+91" + P, firebase: { sign_in_provider: "phone", identities: { phone: ["+91" + P] } } });
let mine;
const db = () => (mine ||= ctx(ME).firestore()); // one instance: a batch can't mix two

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, "jobListings", JOB), { postedByUid: "plEmp", status: "approved", jobStatus: "live", jobTitle: "Mason", createdAt: new Date() });
    await setDoc(doc(d, "users", OTHER), { role: "jobseeker", name: "O" });
    await setDoc(doc(d, "jobProfiles", OTHER), { name: "O", searchable: true, openToEmployers: true, visibility: "actively_looking" });
    await setDoc(doc(d, "jobProfilesPrivate", OTHER), { phone: "9" });
    await setDoc(doc(d, "config", "pricing"), { shortlistLimit: 10 });
  });
});
afterAll(async () => { await testEnv.clearFirestore(); await testEnv.cleanup(); });

describe("a phone account (no email)", () => {
  it("signs up: profile, private part, account, stats, handle", async () => {
    const { pub, priv } = splitProfile(skilledJobProfile(F, P));
    await assertSucceeds(setDoc(doc(db(), "jobProfiles", ME), { ...pub, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(doc(db(), "jobProfilesPrivate", ME), { ...priv, updatedAt: serverTimestamp() }, { merge: true }));
    const u = skilledAccount(F, ME, P);
    for (const k of ["points", "storesAdded", "citiesCovered", "level"]) delete u[k];
    await assertSucceeds(setDoc(doc(db(), "users", ME), u, { merge: true }));
    await assertSucceeds(setDoc(doc(db(), "users", ME, "stats", "summary"), { points: 0 }, { merge: true }));
    const b = writeBatch(db());
    b.set(doc(db(), "handles", "plramesh"), { uid: ME, createdAt: serverTimestamp() });
    b.set(doc(db(), "profiles", ME), { handle: "plramesh", role: "jobseeker", displayName: "Ramesh" }, { merge: true });
    await assertSucceeds(b.commit());
    await assertSucceeds(updateDoc(doc(db(), "users", ME), { handle: "plramesh" }));
  });
  it("reads own account and profile, browses jobs, saves a job", async () => {
    for (const p of [["users", ME], ["jobProfiles", ME], ["jobProfilesPrivate", ME], ["jobListings", JOB], ["config", "pricing"]]) await assertSucceeds(getDoc(doc(db(), ...p)));
    await assertSucceeds(getDocs(query(collection(db(), "jobListings"), where("status", "==", "approved"), where("jobStatus", "==", "live"), orderBy("createdAt", "desc"))));
    await assertSucceeds(setDoc(doc(db(), "users", ME, "savedJobs", JOB), { at: serverTimestamp() }));
  });
  it("uploads a CV, applies, sees the application, changes the employer choice, withdraws", async () => {
    const path = `resumes/${ME}/profile/1_cv.pdf`;
    await assertSucceeds(uploadBytes(ref(ctx(ME).storage(), path), new Uint8Array([1]), { contentType: "application/pdf" }));
    await assertSucceeds(getBytes(ref(ctx(ME).storage(), path)));
    const pr = profileFromDocs((await getDoc(doc(db(), "jobProfiles", ME))).data(), (await getDoc(doc(db(), "jobProfilesPrivate", ME))).data());
    const hist = [{ stage: "submitted", at: Timestamp.now(), by: "candidate", byUid: ME }];
    const b = writeBatch(db());
    b.set(doc(db(), "jobApplications", APP), { jobId: JOB, applicantUid: ME, ...applicationSnapshot(pr), message: "", hasCv: false, stage: "submitted", stageHistory: hist, applicantStatus: "new", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    b.set(doc(db(), "jobApplications", APP, "private", "contact"), { ...applicationContact(pr), createdAt: serverTimestamp() });
    await assertSucceeds(b.commit());
    await assertSucceeds(getDocs(query(collection(db(), "jobApplications"), where("applicantUid", "==", ME))));
    await assertSucceeds(updateDoc(doc(db(), "jobProfiles", ME), { openToEmployers: false, searchable: false, visibility: pr.visibility, openToEmployersAt: serverTimestamp() }));
    const u = stageUpdate({ stage: "submitted", stageHistory: hist }, "withdrawn", "candidate", ME);
    await assertSucceeds(updateDoc(doc(db(), "jobApplications", APP), { ...u, stageHistory: u.stageHistory.map(e => (e.at instanceof Date ? { ...e, at: Timestamp.fromDate(e.at) } : e)), updatedAt: serverTimestamp() }));
  });
  it("can't read or change anyone else, search candidates, or touch admin things", async () => {
    for (const p of [["users", OTHER], ["jobProfiles", OTHER], ["jobProfilesPrivate", OTHER]]) await assertFails(getDoc(doc(db(), ...p)));
    for (const c of ["users", "jobProfiles", "jobApplications", "jobReports", "claims"]) await assertFails(getDocs(collection(db(), c)));
    await assertFails(updateDoc(doc(db(), "users", ME), { role: "hom_admin" }));
    await assertFails(updateDoc(doc(db(), "users", ME), { verificationStatus: "verified" }));
    await assertFails(setDoc(doc(db(), "config", "pricing"), { shortlistLimit: 99 }));
    await assertFails(deleteDoc(doc(db(), "jobListings", JOB)));
    await assertFails(getBytes(ref(ctx(ME).storage(), `resumes/${OTHER}/profile/1_cv.pdf`)));
    await assertFails(setDoc(doc(db(), "homVendors", "v"), { a: 1 }));
  });
});
