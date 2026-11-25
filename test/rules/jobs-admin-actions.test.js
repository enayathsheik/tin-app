// Admin → TIN Jobs Admin actions: approve / reject a business, pause / close /
// delete a job. Only the TIN super admin can; nobody else gains anything.
// Uses the same writes as src/lib/{storeClaims,storeVerification,employerDesk,jobsAdmin}.js.
// Run against the Firestore emulator only — never production: npm run test:rules
import { readFileSync } from "fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { stageUpdate } from "../../src/utils/applications.js";

const ADMIN_EMAIL = "enayathsheik@gmail.com";
const EMP = "jxEmp", CAND = "jxCand", CLAIMANT = "jxClaimant", HOM = "jxHom", FAKE = "jxFake";
const JOB = "jxJob", APP = `${JOB}_${CAND}`;
let testEnv;
const db = (uid, email) => testEnv.authenticatedContext(uid, { email: email || `${uid}@example.com` }).firestore();
const adminDb = () => db("jxAdmin", ADMIN_EMAIL);
const OTHERS = [[EMP], [CAND], [CLAIMANT], [HOM], [FAKE, "enayathsheik@gmail.co"]];

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "tin-jobs-admin-actions",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    for (const uid of [EMP, CAND, CLAIMANT]) await setDoc(doc(d, "users", uid), { name: uid, role: "consumer" });
    await setDoc(doc(d, "users", HOM), { name: "hom", role: "hom_admin" });
    await setDoc(doc(d, "users", FAKE), { name: "fake", role: "admin" });
    await setDoc(doc(d, "stores", "jxStore"), { storeName: "S", verificationStatus: "community_added", contributorId: EMP, createdAt: new Date("2026-11-20") });
    await setDoc(doc(d, "stores", "jxImp"), { storeName: "I", verificationStatus: "community_added", source: "bulk_upload", contributorId: "x", createdAt: new Date("2026-11-01") });
    await setDoc(doc(d, "claims", "jxClaim"), { claimantUid: CLAIMANT, storeId: "jxImp", status: "pending" });
    await setDoc(doc(d, "jobListings", JOB), { postedByUid: EMP, jobTitle: "Masons", status: "approved", jobStatus: "live", shortlistCount: 1, createdAt: new Date() });
    await setDoc(doc(d, "jobListings", JOB, "shortlistSlots", "1"), { appId: APP });
    await setDoc(doc(d, "jobApplications", APP), { jobId: JOB, applicantUid: CAND, stage: "shortlisted", contactUnlockedAt: new Date(), shortlistSlot: 1, stageHistory: [{ stage: "submitted" }, { stage: "shortlisted" }] });
    await setDoc(doc(d, "jobApplications", APP, "private", "contact"), { applicantPhone: "9000000000" });
  });
});
afterAll(async () => { await testEnv.clearFirestore(); await testEnv.cleanup(); });

const approveClaim = (d) => {
  const b = writeBatch(d);
  b.update(doc(d, "claims", "jxClaim"), { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "jxAdmin" });
  b.update(doc(d, "stores", "jxImp"), { claimedByUid: CLAIMANT, claimedAt: serverTimestamp(), claimId: "jxClaim", contributorId: CLAIMANT, previousContributorId: "x" });
  b.set(doc(d, "users", CLAIMANT), { storeId: "jxImp" }, { merge: true });
  return b.commit();
};
const closeJob = (d, uid) => {
  const u = stageUpdate({ stage: "shortlisted", contactUnlockedAt: true, stageHistory: [{ stage: "submitted" }, { stage: "shortlisted" }] }, "closed", "employer", uid, { note: "Closed" });
  const b = writeBatch(d);
  b.update(doc(d, "jobApplications", APP), { ...u, stageHistory: u.stageHistory.map(e => (e.at ? { ...e, at: Timestamp.fromDate(e.at) } : e)), updatedAt: serverTimestamp() });
  b.update(doc(d, "jobListings", JOB), { jobStatus: "closed", updatedAt: serverTimestamp() });
  return b.commit();
};

describe("what the dashboard reads", () => {
  it("admin: all claims, and stores added after a date (no composite index)", async () => {
    expect((await assertSucceeds(getDocs(collection(adminDb(), "claims")))).size).toBe(1);
    const snap = await assertSucceeds(getDocs(query(collection(adminDb(), "stores"), where("createdAt", ">", Timestamp.fromDate(new Date("2026-11-10"))))));
    expect(snap.docs.map(x => x.id)).toEqual(["jxStore"]);
    for (const p of [["claims", "nope"], ["stores", "nope"]]) expect((await assertSucceeds(getDoc(doc(adminDb(), ...p)))).exists()).toBe(false);
  });
  it("nobody else can list claims", async () => {
    for (const [uid, email] of OTHERS) await assertFails(getDocs(collection(db(uid, email), "claims")));
  });
});

describe("approve / reject a business", () => {
  it("admin: approve a claim, reject a claim, verify a store, reject a store", async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), "stores", "jxStore"), { verificationStatus: "verified", verifiedAt: serverTimestamp(), verifiedBy: "admin" }));
    await assertSucceeds(updateDoc(doc(adminDb(), "stores", "jxStore"), { verificationStatus: "rejected" }));
    await assertSucceeds(approveClaim(adminDb()));
    await assertSucceeds(updateDoc(doc(adminDb(), "claims", "jxClaim"), { status: "rejected" }));
  });
  it("nobody else, including the owner, the claimant, hom_admin and an account with role admin", async () => {
    for (const [uid, email] of OTHERS) {
      await assertFails(approveClaim(db(uid, email)));
      await assertFails(updateDoc(doc(db(uid, email), "claims", "jxClaim"), { status: "approved" }));
      await assertFails(updateDoc(doc(db(uid, email), "stores", "jxStore"), { verificationStatus: "verified" }));
      await assertFails(updateDoc(doc(db(uid, email), "stores", "jxStore"), { verificationStatus: "rejected" }));
    }
  });
});

describe("pause / close a job", () => {
  it("admin: pause, resume, and close with its open applications", async () => {
    for (const jobStatus of ["paused", "live"]) await assertSucceeds(updateDoc(doc(adminDb(), "jobListings", JOB), { jobStatus, updatedAt: serverTimestamp() }));
    await assertSucceeds(closeJob(adminDb(), "jxAdmin"));
    const a = (await getDoc(doc(adminDb(), "jobApplications", APP))).data();
    expect([a.stage, a.shortlistSlot, !!a.contactUnlockedAt]).toEqual(["closed", 1, true]);
    expect((await getDoc(doc(adminDb(), "jobListings", JOB))).data()).toMatchObject({ jobStatus: "closed", shortlistCount: 1 });
  });
  it("nobody but the job's own poster and the admin", async () => {
    for (const [uid, email] of OTHERS.filter(([u]) => u !== EMP)) {
      await assertFails(updateDoc(doc(db(uid, email), "jobListings", JOB), { jobStatus: "paused" }));
      await assertFails(closeJob(db(uid, email), uid));
    }
  });
});

describe("delete a job", () => {
  it("only the admin — not even the employer who posted it", async () => {
    for (const [uid, email] of OTHERS) await assertFails(deleteDoc(doc(db(uid, email), "jobListings", JOB)));
    await assertFails(deleteDoc(doc(testEnv.unauthenticatedContext().firestore(), "jobListings", JOB)));
    await assertSucceeds(deleteDoc(doc(adminDb(), "jobListings", JOB)));
  });
  it("afterwards: the applicant keeps their application, the employer loses the contact, others still see nothing", async () => {
    await assertSucceeds(closeJob(adminDb(), "jxAdmin"));
    await assertSucceeds(deleteDoc(doc(adminDb(), "jobListings", JOB)));
    await assertSucceeds(getDoc(doc(db(CAND), "jobApplications", APP)));
    await assertSucceeds(getDocs(query(collection(db(CAND), "jobApplications"), where("applicantUid", "==", CAND))));
    await assertSucceeds(getDoc(doc(db(CAND), "jobApplications", APP, "private", "contact")));
    await assertFails(getDoc(doc(db(EMP), "jobApplications", APP)));
    await assertFails(getDoc(doc(db(EMP), "jobApplications", APP, "private", "contact")));
    await assertFails(getDoc(doc(db(CLAIMANT), "jobApplications", APP)));
    const snap = await assertSucceeds(getDocs(collection(adminDb(), "jobApplications")));
    expect(snap.size).toBe(1);
  });
});
