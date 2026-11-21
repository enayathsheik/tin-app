// L8 contact visibility (launch): the employer sees the TIN card and full
// profile WITHOUT phone, email or CV; those unlock — for the job's poster
// (and the admin) — when the application first reaches Shortlisted or a
// later stage, and stay unlocked. Uses the real client helpers.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, deleteField } from "firebase/firestore";
import { applicationContact, applicationSnapshot, emptyProfile } from "../../src/utils/jobProfile.js";
import { stageUpdate } from "../../src/utils/applications.js";

const PROJECT_ID = "contact-visibility-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const JOB = "jobA";
const CAND = "cand", EMP = "emp", OTHER = "other";
const APP = `${JOB}_${CAND}`;
let testEnv;

const profile = { ...emptyProfile(), name: "Prakash", phone: "9769031000", email: "p@example.com", lane: "skilled", trades: ["mason"], city: "Thane" };
const as = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();
const contactRef = (db, id = APP) => doc(db, "jobApplications", id, "private", "contact");
const w = (u) => (u.contactUnlockedAt ? { ...u, contactUnlockedAt: serverTimestamp() } : u);

// What submitApplication() writes: application + private contact in one batch.
function applyBatch(db, uid = CAND, jobId = JOB, { resumePath = "" } = {}) {
  const id = `${jobId}_${uid}`;
  const batch = writeBatch(db);
  batch.set(doc(db, "jobApplications", id), {
    jobId, applicantUid: uid, ...applicationSnapshot(profile), message: "", hasCv: !!resumePath,
    jobSnapshot: { title: "Masons", businessName: "X", city: "Thane" },
    stage: "submitted", stageHistory: [{ stage: "submitted", at: new Date(), by: "candidate", byUid: uid }],
    applicantStatus: "new", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(contactRef(db, id), { ...applicationContact(profile), ...(resumePath ? { resumePath, resumeFileName: "cv.pdf" } : {}), createdAt: serverTimestamp() });
  return batch.commit();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "jobListings", JOB), { postedByUid: EMP, jobTitle: "Masons", status: "approved", jobStatus: "live", createdAt: new Date() });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const appNow = async () => {
  let data;
  await testEnv.withSecurityRulesDisabled(async (c) => { data = (await getDoc(doc(c.firestore(), "jobApplications", APP))).data(); });
  return data;
};

describe("applying", () => {
  it("the candidate writes the application + private contact in one batch, with a CV in their own job folder", async () => {
    await assertSucceeds(applyBatch(as(CAND), CAND, JOB, { resumePath: `resumes/${CAND}/${JOB}/1_cv.pdf` }));
  });

  it("the CV path must be in resumes/{me}/{thisJob}/", async () => {
    await assertFails(applyBatch(as(CAND), CAND, JOB, { resumePath: `resumes/${CAND}/otherJob/1_cv.pdf` }));
    await assertFails(applyBatch(as(CAND), CAND, JOB, { resumePath: `resumes/someoneElse/${JOB}/1_cv.pdf` }));
  });

  it("nobody else can write a candidate's contact doc, and it can't be rewritten later", async () => {
    await applyBatch(as(CAND));
    await assertFails(setDoc(contactRef(as(EMP)), { applicantPhone: "000" }));
    await assertFails(setDoc(contactRef(as(CAND)), { applicantPhone: "111", createdAt: serverTimestamp() }));
    await assertFails(updateDoc(contactRef(as(CAND)), { applicantPhone: "111" }));
  });

  it("an application can't start unlocked", async () => {
    const db = as(CAND);
    const batch = writeBatch(db);
    batch.set(doc(db, "jobApplications", APP), {
      jobId: JOB, applicantUid: CAND, ...applicationSnapshot(profile), stage: "submitted", stageHistory: [{ stage: "submitted" }],
      applicantStatus: "new", contactUnlockedAt: serverTimestamp(), createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });
});

describe("before shortlist", () => {
  it("the employer reads the application (TIN card + profile) but NOT phone, email or CV", async () => {
    await applyBatch(as(CAND));
    const snap = await assertSucceeds(getDoc(doc(as(EMP), "jobApplications", APP)));
    expect(snap.data()).not.toHaveProperty("applicantPhone");
    expect(snap.data().profileSnapshot.trades).toEqual(["mason"]);
    await assertFails(getDoc(contactRef(as(EMP))));
  });

  it("moving to Review or Not shortlisted doesn't unlock", async () => {
    await applyBatch(as(CAND));
    const review = stageUpdate(await appNow(), "review", "employer", EMP);
    await assertSucceeds(updateDoc(doc(as(EMP), "jobApplications", APP), w(review)));
    await assertFails(getDoc(contactRef(as(EMP))));
  });

  it("the employer can't sneak contactUnlockedAt in on a non-unlocking move", async () => {
    await applyBatch(as(CAND));
    const review = stageUpdate(await appNow(), "review", "employer", EMP);
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", APP), { ...w(review), contactUnlockedAt: serverTimestamp() }));
  });

  it("the candidate and the admin can always read the contact; strangers never", async () => {
    await applyBatch(as(CAND));
    await assertSucceeds(getDoc(contactRef(as(CAND))));
    await assertSucceeds(getDoc(contactRef(as("adm", ADMIN_EMAIL))));
    await assertFails(getDoc(contactRef(as(OTHER))));
    await assertFails(getDoc(contactRef(testEnv.unauthenticatedContext().firestore())));
  });
});

describe("shortlist unlocks", () => {
  it("shortlisting must record contactUnlockedAt in the same write", async () => {
    await applyBatch(as(CAND));
    const sl = stageUpdate(await appNow(), "shortlisted", "employer", EMP);
    const { contactUnlockedAt: _drop, ...without } = w(sl); // eslint-disable-line no-unused-vars
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", APP), without));
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", APP), { ...w(sl), contactUnlockedAt: new Date(2020, 0, 1) }));
    await assertSucceeds(updateDoc(doc(as(EMP), "jobApplications", APP), w(sl)));
  });

  it("after shortlisting, the poster reads phone, email and CV; other employers still can't", async () => {
    await applyBatch(as(CAND), CAND, JOB, { resumePath: `resumes/${CAND}/${JOB}/1_cv.pdf` });
    await updateDoc(doc(as(EMP), "jobApplications", APP), w(stageUpdate(await appNow(), "shortlisted", "employer", EMP)));
    const c = await assertSucceeds(getDoc(contactRef(as(EMP))));
    expect(c.data()).toMatchObject({ applicantPhone: "9769031000", applicantEmail: "p@example.com", resumePath: `resumes/${CAND}/${JOB}/1_cv.pdf` });
    await assertFails(getDoc(contactRef(as(OTHER))));
  });

  it("going straight to an interview invite also unlocks", async () => {
    await applyBatch(as(CAND));
    const inv = stageUpdate(await appNow(), "int_invited", "employer", EMP, { interview: { date: "2026-11-25", time: "11:00", mode: "Phone call", where: "", instructions: "" } });
    await assertSucceeds(updateDoc(doc(as(EMP), "jobApplications", APP), w(inv)));
    await assertSucceeds(getDoc(contactRef(as(EMP))));
  });

  it("unlock is one-way: rejecting later keeps contact visible, and nobody but admin can clear the timestamp", async () => {
    await applyBatch(as(CAND));
    await updateDoc(doc(as(EMP), "jobApplications", APP), w(stageUpdate(await appNow(), "shortlisted", "employer", EMP)));
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", APP), { contactUnlockedAt: deleteField() }));
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", APP), { contactUnlockedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(EMP), "jobApplications", APP), w(stageUpdate(await appNow(), "not_selected", "employer", EMP))));
    await assertSucceeds(getDoc(contactRef(as(EMP))));
  });

  it("an old application already at Shortlisted (no contactUnlockedAt) counts as unlocked", async () => {
    await applyBatch(as(CAND));
    await testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobApplications", APP), { stage: "shortlisted", stageHistory: [{ stage: "submitted" }, { stage: "shortlisted" }] }));
    await assertSucceeds(getDoc(contactRef(as(EMP))));
  });
});

describe("admin migration of old applications", () => {
  it("the admin can move contact into private/contact and strip it from the application", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "jobApplications", "jobA_old"), {
      jobId: JOB, applicantUid: "old", applicantName: "Old", applicantPhone: "98", resumeUrl: "https://x", applicantStatus: "new", createdAt: new Date(),
    }));
    const db = as("adm", ADMIN_EMAIL);
    const batch = writeBatch(db);
    batch.set(contactRef(db, "jobA_old"), { applicantPhone: "98", resumeUrl: "https://x", createdAt: serverTimestamp() }, { merge: true });
    batch.update(doc(db, "jobApplications", "jobA_old"), { applicantPhone: deleteField(), resumeUrl: deleteField(), hasCv: true });
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(contactRef(as(EMP), "jobA_old")));
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", "jobA_old"), { hasCv: false }));
  });
});
