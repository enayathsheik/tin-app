// L9 pricing switch: config/pricing (admin-only write, valid shape, public
// read) and entitlements (each free profile / job post recorded for 365
// days by its owner; only admin edits). Run against the Firestore emulator
// only — never production:   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { Timestamp, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { buildJobFields, emptyDraft } from "../../src/utils/jobDraft.js";
import { entitlementDoc, entitlementId, pricingFrom, validUntilFrom } from "../../src/utils/pricing.js";

const PROJECT_ID = "pricing-entitlements-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

const as = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();
const admin = () => as("adm", ADMIN_EMAIL);
const fee = { list: 750, offer: 100, launchDiscount: true };
const ent = (kind, uid, refId, extra = {}) => ({
  ...entitlementDoc(kind, uid, refId, fee), grantedAt: serverTimestamp(), validDays: 365,
  validUntil: Timestamp.fromDate(validUntilFrom(new Date())), ...extra,
});
const draft = () => ({
  ...emptyDraft({}), business: { name: "Shree Ganesh Plywood", industry: "retail_distribution", city: "Mumbai" },
  lane: "professional", title: "Sales Executive", headcount: "2", functions: ["sales_bd"], workTypes: ["full_time"], city: "Mumbai", duties: "Visit dealers",
  pay: { period: "month", min: "22000", max: "28000", display: "show_range", negotiable: false, incentives: "" }, contactPhone: "9800000000", notAgencyDeclaration: true,
});
// What createJob() writes: the job + its entitlement in one batch.
function postJob(db, uid, entExtra = {}, entUid = uid) {
  const ref = doc(collection(db, "jobListings"));
  const batch = writeBatch(db);
  batch.set(ref, { ...buildJobFields(draft()), postedByUid: uid, postedByName: "X", postedByType: "individual", status: "approved", jobStatus: "live", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, "entitlements", entitlementId("job_post", ref.id)), ent("job_post", entUid, ref.id, entExtra));
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
    await setDoc(doc(c.firestore(), "users", "emp"), { role: "retailer", verificationStatus: "pending" });
    await setDoc(doc(c.firestore(), "jobListings", "othersJob"), { postedByUid: "someoneElse", status: "approved", jobStatus: "live" });
  });
});
afterAll(async () => {
  await testEnv.cleanup();
});

describe("config/pricing", () => {
  it("only the TIN admin can change pricing; everyone can read it", async () => {
    const p = pricingFrom(null);
    await assertFails(setDoc(doc(as("emp"), "config", "pricing"), p));
    await assertSucceeds(setDoc(doc(admin(), "config", "pricing"), { ...p, updatedAt: serverTimestamp(), updatedBy: "adm" }));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "config", "pricing")));
    await assertFails(updateDoc(doc(as("emp"), "config", "pricing"), { "profileFee.launchDiscount": false }));
  });

  it("the admin can't save a broken pricing doc", async () => {
    const p = pricingFrom(null);
    await assertFails(setDoc(doc(admin(), "config", "pricing"), { ...p, profileFee: { ...p.profileFee, offer: 900 } }));        // offer > list
    await assertFails(setDoc(doc(admin(), "config", "pricing"), { ...p, jobPostFee: { ...p.jobPostFee, list: "750" } }));      // not a number
    await assertFails(setDoc(doc(admin(), "config", "pricing"), { ...p, shortlistLimit: 0 }));
    await assertFails(setDoc(doc(admin(), "config", "pricing"), { ...p, shortlistLimit: 1000 }));
    for (const v of [-1, 501, 2.5, "20", null]) await assertFails(setDoc(doc(admin(), "config", "pricing"), { ...p, searchShortlistDailyLimit: v }));
    for (const v of [0, 20, 500]) await assertSucceeds(setDoc(doc(admin(), "config", "pricing"), { ...p, searchShortlistDailyLimit: v }));
    const before = { ...p }; // an admin tab opened before A2
    delete before.searchShortlistDailyLimit;
    await assertSucceeds(setDoc(doc(admin(), "config", "pricing"), before));
    await assertSucceeds(setDoc(doc(admin(), "config", "pricing"), { ...p, profileFee: { list: 750, offer: 100, launchDiscount: false } }));
  });
});

describe("entitlements", () => {
  it("a job post records its free entitlement in the same batch", async () => {
    await assertSucceeds(postJob(as("emp"), "emp"));
  });

  it("a new profile records its own entitlement (365 days)", async () => {
    await assertSucceeds(setDoc(doc(as("seeker"), "entitlements", "job_profile_seeker"), ent("job_profile", "seeker", "seeker")));
  });

  it("refused: for someone else, someone else's job/profile, a paid amount, wrong dates, or extra fields", async () => {
    await assertFails(postJob(as("emp"), "emp", {}, "other"));                                                          // uid not me
    await assertFails(setDoc(doc(as("emp"), "entitlements", "job_post_othersJob"), ent("job_post", "emp", "othersJob"))); // not my job
    await assertFails(setDoc(doc(as("seeker"), "entitlements", "job_profile_other"), ent("job_profile", "seeker", "other")));
    await assertFails(postJob(as("emp"), "emp", { pricePaid: 100 }));
    await assertFails(postJob(as("emp"), "emp", { validUntil: Timestamp.fromDate(new Date(Date.now() + 1000 * 86400000)) }));
    await assertFails(postJob(as("emp"), "emp", { validDays: 999 }));
    await assertFails(postJob(as("emp"), "emp", { grantedAt: Timestamp.fromDate(new Date(2025, 0, 1)) }));
    await assertFails(postJob(as("emp"), "emp", { note: "free forever" }));
    await assertFails(setDoc(doc(as("seeker"), "entitlements", "wrong_id"), ent("job_profile", "seeker", "seeker")));   // id must match
  });

  it("owners read their own; others can't; only admin can edit or delete", async () => {
    await setDoc(doc(as("seeker"), "entitlements", "job_profile_seeker"), ent("job_profile", "seeker", "seeker"));
    await assertSucceeds(getDoc(doc(as("seeker"), "entitlements", "job_profile_seeker")));
    await assertFails(getDoc(doc(as("emp"), "entitlements", "job_profile_seeker")));
    await assertFails(updateDoc(doc(as("seeker"), "entitlements", "job_profile_seeker"), { validDays: 3650 }));
    await assertFails(deleteDoc(doc(as("seeker"), "entitlements", "job_profile_seeker")));
    await assertSucceeds(updateDoc(doc(admin(), "entitlements", "job_profile_seeker"), { validDays: 365 }));
  });

  it("can't be recorded twice for the same profile", async () => {
    await setDoc(doc(as("seeker"), "entitlements", "job_profile_seeker"), ent("job_profile", "seeker", "seeker"));
    await assertFails(setDoc(doc(as("seeker"), "entitlements", "job_profile_seeker"), ent("job_profile", "seeker", "seeker")));
  });

  it("the admin backfill can record past profiles/jobs with their own start dates", async () => {
    const start = new Date("2026-10-01T00:00:00Z");
    await assertSucceeds(setDoc(doc(admin(), "entitlements", "job_post_othersJob"), {
      ...entitlementDoc("job_post", "someoneElse", "othersJob", fee), grantedAt: Timestamp.fromDate(start), validDays: 365,
      validUntil: Timestamp.fromDate(validUntilFrom(start)), backfilled: true,
    }));
  });
});
