// "Mark as hired": the job's employer only, only from Selected or Offer sent,
// and final. Contact and CV stay open. Firestore + Storage emulators only —
// never production:  npm run test:rules
import { readFileSync } from "fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { ST } from "../../src/data/jobsTaxonomy.js";
import { stageUpdate } from "../../src/utils/applications.js";

const PROJECT_ID = "trade-intelligence-netwo-97997"; // see cv-per-job-storage.test.js
const EMP = "mhEmp", EMP2 = "mhEmp2", CAND = "mhCand", JOB = "mhJob", APP = `${JOB}_${CAND}`, CV = `resumes/${CAND}/${JOB}/1_cv.pdf`;
let testEnv;
const ctx = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com` });
const at = (stage, extra = {}) => ({ jobId: JOB, applicantUid: CAND, stage, stageHistory: [{ stage: "submitted", at: Timestamp.now() }, { stage, at: Timestamp.now() }], contactUnlockedAt: Timestamp.now(), shortlistSlot: 1, ...extra });
const put = (data) => testEnv.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "jobApplications", APP), data));
const hire = (uid, from, extra = {}) => {
  const u = stageUpdate(from, "hired", "employer", uid);
  return updateDoc(doc(ctx(uid).firestore(), "jobApplications", APP), { ...u, stageHistory: u.stageHistory.map(e => (e.at instanceof Date ? { ...e, at: Timestamp.fromDate(e.at) } : e)), updatedAt: serverTimestamp(), ...extra });
};
const contact = (uid) => getDoc(doc(ctx(uid).firestore(), "jobApplications", APP, "private", "contact"));

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
    await setDoc(doc(d, "jobListings", JOB), { postedByUid: EMP, status: "approved", jobStatus: "live", shortlistCount: 1 });
    await setDoc(doc(d, "jobApplications", APP), at("selected"));
    await setDoc(doc(d, "jobApplications", APP, "private", "contact"), { applicantPhone: "9", resumePath: CV });
    await uploadBytes(ref(c.storage(), CV), new Uint8Array([1]), { contentType: "application/pdf" });
  });
});
afterAll(async () => { await testEnv.clearFirestore(); await testEnv.cleanup(); });

describe("mark as hired", () => {
  it("the employer can, from Selected or Offer sent — also on a filled or closed job", async () => {
    for (const s of ["selected", "offer_sent"]) {
      for (const jobStatus of ["live", "paused", "filled", "closed"]) {
        await testEnv.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "jobListings", JOB), { jobStatus }));
        await put(at(s));
        await assertSucceeds(hire(EMP, at(s)));
      }
    }
  });
  it("not from any other stage", async () => {
    for (const s of Object.keys(ST).filter(x => !["selected", "offer_sent"].includes(x))) {
      await put(at(s));
      await assertFails(hire(EMP, at(s)));
    }
    await put({ jobId: JOB, applicantUid: CAND, applicantStatus: "shortlisted" });
    await assertFails(hire(EMP, { stageHistory: [] }));
  });
  it("nobody else: the candidate, another employer, a guest", async () => {
    for (const uid of [CAND, EMP2]) await assertFails(hire(uid, at("selected")));
    await assertFails(updateDoc(doc(testEnv.unauthenticatedContext().firestore(), "jobApplications", APP), { stage: "hired" }));
  });
  it("only with its timeline entry, and nothing smuggled in", async () => {
    await assertFails(updateDoc(doc(ctx(EMP).firestore(), "jobApplications", APP), { stage: "hired" }));
    for (const extra of [{ shortlistSlot: 2 }, { contactUnlockedAt: serverTimestamp() }, { source: "x" }, { applicantUid: EMP2 }]) await assertFails(hire(EMP, at("selected"), extra));
  });
  it("is final for both sides", async () => {
    const h = at("hired");
    await put(h);
    for (const [uid, by, to] of [[EMP, "employer", "not_selected"], [EMP, "employer", "closed"], [EMP, "employer", "selected"], [CAND, "candidate", "withdrawn"], [CAND, "candidate", "offer_accepted"]]) {
      const u = stageUpdate(h, to, by, uid);
      await assertFails(updateDoc(doc(ctx(uid).firestore(), "jobApplications", APP), { ...u, stageHistory: u.stageHistory.map(e => (e.at instanceof Date ? { ...e, at: Timestamp.fromDate(e.at) } : e)) }));
    }
  });
  it("contact and CV stay open to this employer and the candidate only — also on an old application with no unlock time", async () => {
    const old = at("selected"); delete old.contactUnlockedAt; delete old.shortlistSlot;
    for (const from of [at("selected"), old]) {
      await put(from);
      await assertSucceeds(hire(EMP, from));
      for (const uid of [EMP, CAND]) {
        await assertSucceeds(contact(uid));
        await assertSucceeds(getBytes(ref(ctx(uid).storage(), CV)));
      }
      await assertFails(contact(EMP2));
      await assertFails(getBytes(ref(ctx(EMP2).storage(), CV)));
    }
  });
});
