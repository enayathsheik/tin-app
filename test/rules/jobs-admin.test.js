// Admin → TIN Jobs Admin: the TIN super admin reads every account, job
// profile (private part too), job, application, contact and resume — and
// nobody else gains anything. Every "can't" here is the rule employers and
// job seekers already had. Uses the same reads as src/lib/jobsAdmin.js.
// Run against the Firestore + Storage emulators only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { getBytes, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { stageUpdate } from "../../src/utils/applications.js";
import { firstShortlist } from "./shortlistHelper.js";

// Storage emulator cross-service firestore.get() resolves against the real
// project id from .firebaserc (see cv-per-job-storage.test.js).
const PROJECT_ID = "trade-intelligence-netwo-97997";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const EMP = "jaEmp", EMP2 = "jaEmp2", C1 = "jaC1", C2 = "jaC2", HIDDEN = "jaHidden";
const JOB = "jaJob", PENDING = "jaPending";
const APP1 = `${JOB}_${C1}`, APP2 = `${JOB}_${C2}`;
const cv = (uid, folder) => `resumes/${uid}/${folder}/1_cv.pdf`;
const FLAT_CV = `resumes/${C1}/1_old.pdf`;
let testEnv;

const as = (uid, email) => testEnv.authenticatedContext(uid, { email: email || `${uid}@example.com` });
const db = (uid, email) => as(uid, email).firestore();
const st = (uid, email) => as(uid, email).storage();
const adminDb = () => db("jaAdmin", ADMIN_EMAIL);
const adminSt = () => st("jaAdmin", ADMIN_EMAIL);
const guestDb = () => testEnv.unauthenticatedContext().firestore();
const contact = (d, id) => doc(d, "jobApplications", id, "private", "contact");
const app = (uid, extra = {}) => ({
  jobId: JOB, applicantUid: uid, applicantName: uid, payVisible: false, hasCv: true, profileSnapshot: { city: "Thane" },
  stage: "submitted", stageHistory: [{ stage: "submitted" }], applicantStatus: "new", createdAt: new Date(), ...extra,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore(), s = c.storage();
    for (const uid of [EMP, EMP2, C1, C2, HIDDEN]) await setDoc(doc(d, "users", uid), { name: uid, phone: "9000000000", role: uid.includes("Emp") ? "retailer" : "consumer" });
    for (const uid of [C1, C2, HIDDEN]) {
      await setDoc(doc(d, "jobProfiles", uid), { name: uid, city: "Thane", visibility: uid === HIDDEN ? "not_discoverable" : "open_to_opportunities" });
      await setDoc(doc(d, "jobProfilesPrivate", uid), { phone: "9000000000", email: `${uid}@x.com`, expectedPay: "₹900", showPayToEmployers: false, cv: { path: cv(uid, "profile") } });
    }
    await setDoc(doc(d, "jobListings", JOB), { postedByUid: EMP, jobTitle: "Masons", status: "approved", jobStatus: "live", createdAt: new Date() });
    await setDoc(doc(d, "jobListings", PENDING), { postedByUid: EMP, jobTitle: "Waiting", status: "pending", createdAt: new Date() });
    await setDoc(doc(d, "jobListings", "jaNoStatus"), { postedByUid: EMP, jobTitle: "Broken", createdAt: new Date() });
    for (const uid of [C1, C2]) {
      await setDoc(doc(d, "jobApplications", `${JOB}_${uid}`), app(uid));
      await setDoc(contact(d, `${JOB}_${uid}`), { applicantPhone: "9000000000", applicantEmail: `${uid}@x.com`, resumePath: cv(uid, JOB), resumeFileName: "cv.pdf" });
      await uploadBytes(ref(s, cv(uid, JOB)), new Uint8Array(64).fill(7), { contentType: "application/pdf" });
      await uploadBytes(ref(s, cv(uid, "profile")), new Uint8Array(64).fill(7), { contentType: "application/pdf" });
    }
    await uploadBytes(ref(s, FLAT_CV), new Uint8Array(64).fill(7), { contentType: "application/pdf" });
  });
});

afterAll(async () => {
  await testEnv.clearFirestore();
  await testEnv.cleanup();
});

describe("the super admin reads everything", () => {
  it("lists every account, job profile, private profile, job and application", async () => {
    for (const [name, n] of [["users", 5], ["jobProfiles", 3], ["jobProfilesPrivate", 3], ["jobListings", 3], ["jobApplications", 2]]) {
      const snap = await assertSucceeds(getDocs(collection(adminDb(), name)));
      expect([name, snap.size]).toEqual([name, n]);
    }
  });

  it("reads hidden profiles, hidden pay, and contact of applicants nobody shortlisted", async () => {
    await assertSucceeds(getDoc(doc(adminDb(), "jobProfiles", HIDDEN)));
    const priv = await assertSucceeds(getDoc(doc(adminDb(), "jobProfilesPrivate", HIDDEN)));
    expect(priv.data().expectedPay).toBe("₹900");
    const c = await assertSucceeds(getDoc(contact(adminDb(), APP1)));
    expect(c.data().applicantPhone).toBe("9000000000");
  });

  it("opens every kind of resume through its download URL", async () => {
    for (const path of [cv(C1, JOB), cv(C1, "profile"), FLAT_CV]) {
      await assertSucceeds(getBytes(ref(adminSt(), path)));
      const url = await assertSucceeds(getDownloadURL(ref(adminSt(), path)));
      expect((await fetch(url)).status).toBe(200);
    }
  });

  it("a document that doesn't exist reads as 'not there', not as an error (null-dereference check)", async () => {
    for (const path of [["users", "nope"], ["jobProfiles", "nope"], ["jobProfilesPrivate", "nope"], ["jobListings", "nope"], ["jobApplications", "nope_nope"], ["jobApplications", "nope_nope", "private", "contact"]]) {
      const snap = await assertSucceeds(getDoc(doc(adminDb(), ...path)));
      expect(snap.exists()).toBe(false);
    }
  });

  it("read-only on private profiles: the admin can't change a candidate's phone, pay or CV", async () => {
    await assertFails(setDoc(doc(adminDb(), "jobProfilesPrivate", C1), { phone: "1" }, { merge: true }));
  });

  it("only that exact account: a look-alike email or an admin role on the account gets nothing", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "users", "jaFake"), { name: "x", role: "admin" }));
    for (const email of ["enayathsheik@gmail.co", "xenayathsheik@gmail.com", "jaFake@example.com"]) {
      const d = db("jaFake", email);
      for (const name of ["users", "jobProfiles", "jobProfilesPrivate", "jobListings", "jobApplications"]) await assertFails(getDocs(collection(d, name)));
      await assertFails(getDoc(contact(d, APP1)));
      await assertFails(getDownloadURL(ref(st("jaFake", email), cv(C1, "profile"))));
    }
    await testEnv.withSecurityRulesDisabled(async (c) => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(doc(c.firestore(), "users", "jaFake")); });
  });
});

describe("a normal employer still can't see an unshortlisted candidate's contact", () => {
  it("reads the application, but not phone / email / resume, account or private profile", async () => {
    await assertSucceeds(getDoc(doc(db(EMP), "jobApplications", APP1)));
    await assertSucceeds(getDocs(query(collection(db(EMP), "jobApplications"), where("jobId", "==", JOB))));
    await assertFails(getDoc(contact(db(EMP), APP1)));
    await assertFails(getDoc(doc(db(EMP), "jobProfilesPrivate", C1)));
    await assertFails(getDoc(doc(db(EMP), "users", C1)));
    for (const path of [cv(C1, JOB), cv(C1, "profile"), FLAT_CV]) await assertFails(getDownloadURL(ref(st(EMP), path)));
  });

  it("can't list accounts, private profiles, all profiles, all jobs or all applications", async () => {
    for (const name of ["users", "jobProfiles", "jobProfilesPrivate", "jobListings", "jobApplications"]) await assertFails(getDocs(collection(db(EMP), name)));
    await assertFails(getDoc(doc(db(EMP), "jobProfiles", HIDDEN)));
  });

  it("shortlisting unlocks that one applicant only, for that employer only", async () => {
    const sl = stageUpdate(app(C1), "shortlisted", "employer", EMP);
    await assertSucceeds(firstShortlist(db(EMP), APP1, JOB, { ...sl, contactUnlockedAt: serverTimestamp() }, 1));
    await assertSucceeds(getDoc(contact(db(EMP), APP1)));
    await assertSucceeds(getBytes(ref(st(EMP), cv(C1, JOB))));
    await assertFails(getDoc(contact(db(EMP), APP2)));
    await assertFails(getBytes(ref(st(EMP), cv(C2, JOB))));
    await assertFails(getDoc(doc(db(EMP), "jobProfilesPrivate", C1)));
    await assertFails(getDoc(doc(db(EMP2), "jobApplications", APP1)));
    await assertFails(getDoc(contact(db(EMP2), APP1)));
    await assertFails(getBytes(ref(st(EMP2), cv(C1, JOB))));
  });
});

describe("a job seeker can't see other candidates", () => {
  it("no other account, private profile, hidden profile, application, contact or resume", async () => {
    await assertFails(getDoc(doc(db(C2), "users", C1)));
    await assertFails(getDoc(doc(db(C2), "jobProfilesPrivate", C1)));
    await assertFails(getDoc(doc(db(C2), "jobProfiles", HIDDEN)));
    await assertFails(getDoc(doc(db(C2), "jobApplications", APP1)));
    await assertFails(getDoc(contact(db(C2), APP1)));
    for (const path of [cv(C1, JOB), cv(C1, "profile"), FLAT_CV]) await assertFails(getDownloadURL(ref(st(C2), path)));
  });

  it("can't list candidates, or who applied to a job", async () => {
    for (const name of ["users", "jobProfiles", "jobProfilesPrivate", "jobApplications"]) await assertFails(getDocs(collection(db(C2), name)));
    await assertFails(getDocs(query(collection(db(C2), "jobApplications"), where("jobId", "==", JOB))));
  });

  it("can't find out whether someone applied by probing application ids", async () => {
    await assertFails(getDoc(doc(db(C2), "jobApplications", `${JOB}_${HIDDEN}`))); // doesn't exist
    await assertFails(getDoc(doc(db(C2), "jobApplications", APP1)));               // exists
  });

  it("still sees their own account, profile, applications, contact and resume", async () => {
    await assertSucceeds(getDoc(doc(db(C2), "users", C2)));
    await assertSucceeds(getDoc(doc(db(C2), "jobProfiles", C2)));
    await assertSucceeds(getDoc(doc(db(C2), "jobProfilesPrivate", C2)));
    await assertSucceeds(getDocs(query(collection(db(C2), "jobApplications"), where("applicantUid", "==", C2))));
    await assertSucceeds(getDoc(contact(db(C2), APP2)));
    await assertSucceeds(getBytes(ref(st(C2), cv(C2, JOB))));
    await assertSucceeds(updateDoc(doc(db(C2), "jobProfilesPrivate", C2), { expectedPay: "₹950" }));
  });

  // A1: nobody else's shareable profile either (employers: candidate-search.test.js).
  it("another candidate's shareable profile", async () => {
    await assertFails(getDoc(doc(db(C2), "jobProfiles", C1)));
  });
});

describe("public visitors and posters keep exactly what they had", () => {
  it("guests: the public job feed and an approved job, nothing else", async () => {
    await assertSucceeds(getDocs(query(collection(guestDb(), "jobListings"), where("status", "==", "approved"), where("jobStatus", "==", "live"), orderBy("createdAt", "desc"))));
    await assertSucceeds(getDoc(doc(guestDb(), "jobListings", JOB)));
    for (const id of [PENDING, "jaNoStatus", "nope"]) await assertFails(getDoc(doc(guestDb(), "jobListings", id)));
    for (const name of ["users", "jobProfiles", "jobProfilesPrivate", "jobListings", "jobApplications"]) await assertFails(getDocs(collection(guestDb(), name)));
    await assertFails(getDoc(contact(guestDb(), APP1)));
  });

  it("a poster sees all their own jobs, a stranger doesn't see the pending one", async () => {
    const mine = await assertSucceeds(getDocs(query(collection(db(EMP), "jobListings"), where("postedByUid", "==", EMP), orderBy("createdAt", "desc"))));
    expect(mine.size).toBe(3);
    await assertSucceeds(getDoc(doc(db(EMP), "jobListings", PENDING)));
    await assertFails(getDoc(doc(db(EMP2), "jobListings", PENDING)));
  });
});
