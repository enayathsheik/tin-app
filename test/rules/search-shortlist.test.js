// A2: what the rules allow around an application made by shortlistCandidate
// (the function itself: test/functions/shortlistCandidate.test.js). Nobody's
// browser can make or fake one, and the usual contact / CV rules apply to it.
// Firestore + Storage emulators only — never production:  npm run test:rules
import { readFileSync } from "fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { stageUpdate } from "../../src/utils/applications.js";

const PROJECT_ID = "trade-intelligence-netwo-97997"; // see cv-per-job-storage.test.js
const EMP = "ssEmp", EMP2 = "ssEmp2", CAND = "ssCand", JOB = "ssJob", JOB2 = "ssJob2", APP = `${JOB}_${CAND}`, APP2 = `${JOB2}_${CAND}`;
const CV = `resumes/${CAND}/${JOB}/1_cv.pdf`;
let testEnv;
const ctx = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com` });
const db = (uid) => ctx(uid).firestore();
const contact = (d, app = APP) => doc(d, "jobApplications", app, "private", "contact");
const made = () => ({
  jobId: JOB, applicantUid: CAND, applicantName: "R", payVisible: false, profileSnapshot: {}, message: "", hasCv: true, source: "employer_search",
  stage: "shortlisted", stageHistory: [{ stage: "shortlisted", at: Timestamp.now(), by: "employer", byUid: EMP }], applicantStatus: "new",
  contactUnlockedAt: Timestamp.now(), shortlistSlot: 1, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
});
const move = (d, by, uid, stage) => {
  const u = stageUpdate(made(), stage, by, uid);
  return updateDoc(doc(d, "jobApplications", APP), { ...u, stageHistory: u.stageHistory.map(e => (e.at instanceof Date ? { ...e, at: Timestamp.fromDate(e.at) } : e)), updatedAt: serverTimestamp() });
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    for (const uid of [EMP, EMP2]) await setDoc(doc(d, "users", uid), { name: uid, role: "employer" });
    await setDoc(doc(d, "jobListings", JOB), { postedByUid: EMP, status: "approved", jobStatus: "live", shortlistCount: 1 });
    await setDoc(doc(d, "jobListings", JOB2), { postedByUid: EMP, status: "approved", jobStatus: "live" });
    await setDoc(doc(d, "jobListings", JOB, "shortlistSlots", "1"), { appId: APP });
    await setDoc(doc(d, "jobApplications", APP), made());
    await setDoc(contact(d), { applicantPhone: "9000000000", resumePath: CV });
    await setDoc(doc(d, "searchShortlistUsage", EMP), { day: "2026-11-25", count: 3 });
    await uploadBytes(ref(c.storage(), CV), new Uint8Array([1]), { contentType: "application/pdf" });
  });
});
afterAll(async () => { await testEnv.clearFirestore(); await testEnv.cleanup(); });

describe("the application it made", () => {
  it("contact and CV: that employer and the candidate, nobody else", async () => {
    for (const uid of [EMP, CAND]) {
      await assertSucceeds(getDoc(contact(db(uid))));
      await assertSucceeds(getBytes(ref(ctx(uid).storage(), CV)));
    }
    await assertFails(getDoc(contact(db(EMP2))));
    await assertFails(getBytes(ref(ctx(EMP2).storage(), CV)));
  });
  it("the employer moves it on as usual; the candidate can withdraw, which ends CV access", async () => {
    await assertSucceeds(move(db(EMP), "employer", EMP, "contacted"));
    await testEnv.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "jobApplications", APP), made()));
    await assertSucceeds(move(db(CAND), "candidate", CAND, "withdrawn"));
    await assertFails(getBytes(ref(ctx(EMP).storage(), CV)));
    await assertFails(move(db(EMP), "employer", EMP, "contacted"));
  });
  it("neither side can change where it came from, the slot or the unlock time", async () => {
    for (const uid of [EMP, CAND]) {
      for (const data of [{ source: "x" }, { shortlistSlot: 2 }, { contactUnlockedAt: serverTimestamp() }, { applicantUid: EMP2 }]) await assertFails(updateDoc(doc(db(uid), "jobApplications", APP), data));
    }
  });
});

describe("nobody's browser can do what the function does", () => {
  it("an employer can't create an application for someone, with or without a slot, or write their contact", async () => {
    const d = db(EMP);
    const data = { ...made(), jobId: JOB2 };
    await assertFails(setDoc(doc(d, "jobApplications", APP2), data));
    await assertFails(setDoc(doc(d, "jobApplications", APP2), { jobId: JOB2, applicantUid: CAND, stage: "submitted", stageHistory: [], applicantStatus: "new" }));
    const b = writeBatch(d);
    b.set(doc(d, "jobApplications", APP2), data);
    b.set(contact(d, APP2), { applicantPhone: "1" });
    b.set(doc(d, "jobListings", JOB2, "shortlistSlots", "1"), { appId: APP2, createdAt: serverTimestamp() });
    b.update(doc(d, "jobListings", JOB2), { shortlistCount: 1 });
    await assertFails(b.commit());
    await assertFails(setDoc(contact(d, APP2), { applicantPhone: "1" }));
    await assertFails(setDoc(contact(d), { applicantPhone: "1" }));
  });
  it("a candidate can't apply pretending an employer shortlisted them, or apply twice", async () => {
    const d = db("ssOther"), id = `${JOB2}_ssOther`;
    const base = { jobId: JOB2, applicantUid: "ssOther", stage: "submitted", stageHistory: [{ stage: "submitted" }], applicantStatus: "new" };
    await assertFails(setDoc(doc(d, "jobApplications", id), { ...base, source: "employer_search" }));
    await assertFails(setDoc(doc(d, "jobApplications", id), { ...base, stage: "shortlisted", stageHistory: [{ stage: "shortlisted" }] }));
    await assertSucceeds(setDoc(doc(d, "jobApplications", id), base));
    await assertFails(setDoc(doc(db(CAND), "jobApplications", APP), { ...base, jobId: JOB, applicantUid: CAND }));
  });
  it("the daily count: the employer (and admin) can read their own; nobody can change it", async () => {
    const admin = testEnv.authenticatedContext("ssAdm", { email: "enayathsheik@gmail.com" }).firestore();
    await assertSucceeds(getDoc(doc(db(EMP), "searchShortlistUsage", EMP)));
    await assertSucceeds(getDoc(doc(db(EMP2), "searchShortlistUsage", EMP2))); // none yet
    await assertSucceeds(getDoc(doc(admin, "searchShortlistUsage", EMP)));
    await assertFails(getDoc(doc(db(EMP2), "searchShortlistUsage", EMP)));
    for (const d of [db(EMP), db(EMP2), admin]) {
      await assertFails(setDoc(doc(d, "searchShortlistUsage", EMP), { day: "2026-11-25", count: 0 }));
      await assertFails(updateDoc(doc(d, "searchShortlistUsage", EMP), { count: 0 }));
      await assertFails(deleteDoc(doc(d, "searchShortlistUsage", EMP)));
    }
  });
});
