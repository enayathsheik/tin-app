// Phase 4 CV storage: resumes/{uid}/{jobId}/… (per job, live access check
// against that job's application) and resumes/{uid}/profile/… (owner only).
// Run against the Storage + Firestore emulators — never production:
//   firebase emulators:exec --only firestore,storage "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes, listAll } from "firebase/storage";

// Same reasoning as hom-storage.test.js: storage emulator cross-service
// firestore.get() resolves against the real project id from .firebaserc.
const PROJECT_ID = "trade-intelligence-netwo-97997";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const PDF = "application/pdf";
const CAND = "cvCand", EMP = "cvEmp", OTHER_EMP = "cvOtherEmp", STRANGER = "cvStranger";
const JOB = "cvJob1", OTHER_JOB = "cvJob2";
const JOB_CV = `resumes/${CAND}/${JOB}/1700000000000_cv.pdf`;
const PROFILE_CV = `resumes/${CAND}/profile/1700000000000_cv.pdf`;
let testEnv;
const file = () => new Uint8Array(1024).fill(7);
const st = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).storage();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "jobListings", JOB), { postedByUid: EMP, status: "approved", jobStatus: "live" });
    await setDoc(doc(db, "jobListings", OTHER_JOB), { postedByUid: OTHER_EMP, status: "approved", jobStatus: "live" });
    await setDoc(doc(db, "jobApplications", `${JOB}_${CAND}`), { jobId: JOB, applicantUid: CAND, stage: "submitted", resumePath: JOB_CV });
    const s = context.storage();
    await uploadBytes(ref(s, JOB_CV), file(), { contentType: PDF });
    await uploadBytes(ref(s, PROFILE_CV), file(), { contentType: PDF });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("job taken down by TIN", () => {
  const set = (path, data) => testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), ...path), data));
  it("the employer can't open a CV they had unlocked; the candidate and TIN can; restoring gives it back", async () => {
    await set(["jobApplications", `${JOB}_${CAND}`], { stage: "shortlisted", contactUnlockedAt: new Date() });
    await assertSucceeds(getBytes(ref(st(EMP), JOB_CV)));
    for (const status of ["taken_down", "rejected"]) {
      await set(["jobListings", JOB], { status });
      await assertFails(getBytes(ref(st(EMP), JOB_CV)));
      await assertSucceeds(getBytes(ref(st(CAND), JOB_CV)));
      await assertSucceeds(getBytes(ref(st("cvAdmin", ADMIN_EMAIL), JOB_CV)));
    }
    await set(["jobListings", JOB], { status: "approved" });
    await assertSucceeds(getBytes(ref(st(EMP), JOB_CV)));
    await set(["jobListings", JOB], { jobStatus: "closed" });          // closing it themselves changes nothing
    await assertSucceeds(getBytes(ref(st(EMP), JOB_CV)));
    await set(["jobListings", JOB], { jobStatus: "live" });
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "jobApplications", `${JOB}_${CAND}`), { jobId: JOB, applicantUid: CAND, stage: "submitted", resumePath: JOB_CV }));
  });
});

describe("per-job CV", () => {
  it("the candidate can upload and open their own CV for a job", async () => {
    const path = `resumes/${CAND}/${JOB}/1700000000001_new.pdf`;
    await assertSucceeds(uploadBytes(ref(st(CAND), path), file(), { contentType: PDF }));
    await assertSucceeds(getBytes(ref(st(CAND), path)));
  });

  it("L8: the employer of THAT job can open it only once they shortlist — and it stays open after a later rejection", async () => {
    await assertFails(getBytes(ref(st(EMP), JOB_CV)));                         // submitted: locked
    await testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobApplications", `${JOB}_${CAND}`), { stage: "shortlisted", contactUnlockedAt: new Date() }));
    await assertSucceeds(getBytes(ref(st(EMP), JOB_CV)));
    await testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobApplications", `${JOB}_${CAND}`), { stage: "not_selected" }));
    await assertSucceeds(getBytes(ref(st(EMP), JOB_CV)));                      // unlock is one-way
    await testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobApplications", `${JOB}_${CAND}`), { stage: "submitted" }));
  });

  it("L8: an old application already at Shortlisted (no contactUnlockedAt) counts as unlocked", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobApplications", `${JOB}_${CAND}`), { stage: "int_invited" }));
    await assertSucceeds(getBytes(ref(st(EMP), JOB_CV)));
    await testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobApplications", `${JOB}_${CAND}`), { stage: "submitted" }));
  });

  it("another employer, a stranger, or a logged-out visitor can't open it", async () => {
    await assertFails(getBytes(ref(st(OTHER_EMP), JOB_CV)));
    await assertFails(getBytes(ref(st(STRANGER), JOB_CV)));
    await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), JOB_CV)));
    await assertFails(listAll(ref(st(STRANGER), `resumes/${CAND}/${JOB}`)));
  });

  it("the admin can open it", async () => {
    await assertSucceeds(getBytes(ref(st("adm", ADMIN_EMAIL), JOB_CV)));
  });

  it("a CV put in another job's folder isn't openable by that job's employer without an application", async () => {
    const stray = `resumes/${CAND}/${OTHER_JOB}/1700000000002_cv.pdf`;
    await assertSucceeds(uploadBytes(ref(st(CAND), stray), file(), { contentType: PDF }));
    await assertFails(getBytes(ref(st(OTHER_EMP), stray)));
  });

  it("upload limits: owner only, PDF/Word, under 5 MB", async () => {
    await assertFails(uploadBytes(ref(st(STRANGER), `resumes/${CAND}/${JOB}/x.pdf`), file(), { contentType: PDF }));
    await assertFails(uploadBytes(ref(st(CAND), `resumes/${CAND}/${JOB}/pic.png`), file(), { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(st(CAND), `resumes/${CAND}/${JOB}/big.pdf`), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: PDF }));
  });

  it("WITHDRAWN: the employer loses access; the candidate keeps it", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobApplications", `${JOB}_${CAND}`), { stage: "withdrawn" }));
    await assertFails(getBytes(ref(st(EMP), JOB_CV)));
    await assertSucceeds(getBytes(ref(st(CAND), JOB_CV)));
  });
});

describe("saved profile CV", () => {
  it("owner and admin only — no employer access", async () => {
    await assertSucceeds(getBytes(ref(st(CAND), PROFILE_CV)));
    await assertSucceeds(getBytes(ref(st("adm", ADMIN_EMAIL), PROFILE_CV)));
    await assertFails(getBytes(ref(st(EMP), PROFILE_CV)));
    await assertFails(getBytes(ref(st(STRANGER), PROFILE_CV)));
  });

  it("owner can upload; others can't", async () => {
    await assertSucceeds(uploadBytes(ref(st(CAND), `resumes/${CAND}/profile/1700000000003_cv.pdf`), file(), { contentType: PDF }));
    await assertFails(uploadBytes(ref(st(STRANGER), `resumes/${CAND}/profile/hack.pdf`), file(), { contentType: PDF }));
  });
});
