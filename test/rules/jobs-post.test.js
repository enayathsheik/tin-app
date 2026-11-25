// Jobs redesign phase 3 — jobListings create + poster edit rules
// (docs/JOBS_BLUEPRINT.md §5.2/§5.3). Uses the real buildJobFields() so the
// tests check exactly what the wizard writes.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { buildJobFields, emptyDraft } from "../../src/utils/jobDraft.js";

const PROJECT_ID = "jobs-post-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

const draft = (extra = {}) => ({
  ...emptyDraft({}),
  business: { name: "Shree Ganesh Plywood", industry: "retail_distribution", city: "Mumbai" },
  lane: "professional", title: "Sales Executive", headcount: "2",
  functions: ["sales_bd"], workTypes: ["full_time"], city: "Mumbai", duties: "Visit dealers",
  pay: { period: "month", min: "22000", max: "28000", display: "show_range", incentives: "" },
  contactPhone: "9800000000", notAgencyDeclaration: true,
  ...extra,
});
const newJob = (uid, status, fields) => ({
  ...fields, postedByUid: uid, postedByName: "X", postedByType: uid === "verified" ? "verified_business" : "individual",
  status, ...(status === "approved" ? { jobStatus: "live" } : {}), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "plain"), { role: "retailer", verificationStatus: "pending" });
    await setDoc(doc(db, "users", "verified"), { role: "retailer", verificationStatus: "verified", storeId: "storeV" });
    await setDoc(doc(db, "users", "linkedUnverified"), { role: "retailer", storeId: "storeL" });
    // Existing jobs to edit.
    await setDoc(doc(db, "jobListings", "plainLive"), newJob("plain", "approved", buildJobFields(draft())));
    await setDoc(doc(db, "jobListings", "plainPending"), newJob("plain", "pending", buildJobFields(draft())));
    await setDoc(doc(db, "jobListings", "verifiedLive"), newJob("verified", "approved", buildJobFields(draft(), { storeId: "storeV" })));
    // L7: an old job posted with "Don't disclose" (no amounts).
    await setDoc(doc(db, "jobListings", "oldHiddenPay"), newJob("verified", "approved", {
      ...buildJobFields(draft()), pay: { period: "month", min: null, max: null, display: "undisclosed", incentives: "" }, salaryRange: "Not disclosed",
    }));
    // An old-shape job exactly like today's production data.
    await setDoc(doc(db, "jobListings", "legacyLive"), {
      postedByUid: "plain", postedByName: "X", postedByType: "individual", businessName: "Old Co", jobTitle: "ID",
      category: "Design & Architecture", description: "Design", city: "Mumbai", state: "", pincode: "", jobType: "Full-time",
      salaryRange: "35000", contactPhone: "98", notAgencyDeclaration: true, status: "approved", jobStatus: "live", createdAt: new Date(),
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("create with the wizard's fields", () => {
  it("unverified account: the job goes live at once (and an older open page's pending job still saves)", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    await assertSucceeds(addDoc(collection(db, "jobListings"), newJob("plain", "approved", buildJobFields(draft()))));
    await assertSucceeds(addDoc(collection(db, "jobListings"), newJob("plain", "pending", buildJobFields(draft()))));
  });

  it("an account with no users record can post too", async () => {
    const db = testEnv.authenticatedContext("noRecord").firestore();
    await assertSucceeds(addDoc(collection(db, "jobListings"), newJob("noRecord", "approved", buildJobFields(draft()))));
  });

  it("can't fake the verified badge, the posting time, another status, or a take-down note", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    const add = (extra) => addDoc(collection(db, "jobListings"), { ...newJob("plain", "approved", buildJobFields(draft())), ...extra });
    await assertFails(add({ postedByType: "verified_business" }));
    await assertFails(add({ postedByType: "tin_partner" }));
    await assertFails(add({ createdAt: new Date(Date.now() + 86400000 * 365) }));
    await assertFails(add({ createdAt: new Date(Date.now() - 86400000) }));
    await assertFails(add({ status: "taken_down" }));
    await assertFails(add({ status: "rejected" }));
    await assertFails(add({ jobStatus: "paused" }));
    await assertFails(add({ takedown: { reason: "x" } }));
    await assertSucceeds(add({}));
  });

  it("verified account: approved + live with its own storeId", async () => {
    const db = testEnv.authenticatedContext("verified").firestore();
    await assertSucceeds(addDoc(collection(db, "jobListings"), newJob("verified", "approved", buildJobFields(draft(), { storeId: "storeV" }))));
  });

  it("storeId must be the poster's admin-set store link", async () => {
    const plain = testEnv.authenticatedContext("plain").firestore();
    await assertFails(addDoc(collection(plain, "jobListings"), newJob("plain", "pending", buildJobFields(draft(), { storeId: "storeV" }))));
    const linked = testEnv.authenticatedContext("linkedUnverified").firestore();
    await assertSucceeds(addDoc(collection(linked, "jobListings"), newJob("linkedUnverified", "pending", buildJobFields(draft(), { storeId: "storeL" }))));
    await assertFails(addDoc(collection(linked, "jobListings"), newJob("linkedUnverified", "pending", buildJobFields(draft(), { storeId: "storeV" }))));
  });

  it("L7: a new job needs a pay range — period, from and to; Negotiable flag allowed", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    const ok = buildJobFields(draft({ pay: { period: "month", min: "22000", max: "28000", display: "show_range", negotiable: true, incentives: "" } }));
    await assertSucceeds(addDoc(collection(db, "jobListings"), newJob("plain", "pending", ok)));
    const same = buildJobFields(draft({ pay: { period: "day", min: "900", max: "900", display: "show_range", incentives: "" } }));
    await assertSucceeds(addDoc(collection(db, "jobListings"), newJob("plain", "pending", same)));
    const bad = (pay) => addDoc(collection(db, "jobListings"), newJob("plain", "pending", { ...ok, pay: { ...ok.pay, ...pay } }));
    await assertFails(bad({ display: "undisclosed", min: null, max: null }));   // Don't disclose is gone
    await assertFails(bad({ display: "negotiable", min: null, max: null }));    // Negotiable instead of pay is gone
    await assertFails(bad({ max: null }));                                      // "to" required
    await assertFails(bad({ min: null }));                                      // "from" required
    await assertFails(bad({ min: 0 }));
    await assertFails(bad({ min: 30000, max: 20000 }));                         // to ≥ from
    await assertFails(bad({ period: "fortnight" }));
    await assertFails(bad({ negotiable: "yes" }));
    const noPay = { ...ok }; delete noPay.pay;
    await assertFails(addDoc(collection(db, "jobListings"), newJob("plain", "pending", noPay)));
  });

  it("L7: old jobs are unchanged — status-only and non-pay edits still work; changing pay needs a range", async () => {
    const db = testEnv.authenticatedContext("verified").firestore();
    await assertSucceeds(updateDoc(doc(db, "jobListings", "oldHiddenPay"), { jobStatus: "paused", updatedAt: new Date() }));
    await assertSucceeds(updateDoc(doc(db, "jobListings", "oldHiddenPay"), { description: "Updated text", updatedAt: new Date() }));
    await assertFails(updateDoc(doc(db, "jobListings", "oldHiddenPay"), { pay: { period: "month", min: null, max: null, display: "negotiable", incentives: "" } }));
    await assertSucceeds(updateDoc(doc(db, "jobListings", "oldHiddenPay"), { pay: { period: "month", min: 20000, max: 25000, display: "show_range", negotiable: true, incentives: "" }, salaryRange: "₹20,000–25,000 / month · Negotiable" }));
    await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext("plain").firestore(), "jobListings", "legacyLive"), { jobStatus: "filled" }));
  });

  it("lane and headcount are checked", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    const f = buildJobFields(draft());
    await assertFails(addDoc(collection(db, "jobListings"), newJob("plain", "pending", { ...f, lane: "wizard" })));
    await assertFails(addDoc(collection(db, "jobListings"), newJob("plain", "pending", { ...f, headcount: 0 })));
    await assertFails(addDoc(collection(db, "jobListings"), newJob("plain", "pending", { ...f, headcount: "2" })));
  });

  it("can't post as someone else", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    await assertFails(addDoc(collection(db, "jobListings"), newJob("verified", "pending", buildJobFields(draft()))));
  });
});

describe("poster edits", () => {
  it("Live/Filled/Closed (with updatedAt, as My Jobs sends it) works without re-approval", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    await assertSucceeds(updateDoc(doc(db, "jobListings", "plainLive"), { jobStatus: "filled", updatedAt: new Date() }));
    await assertSucceeds(updateDoc(doc(db, "jobListings", "plainLive"), { jobStatus: "live", updatedAt: new Date() }));
    await assertSucceeds(updateDoc(doc(db, "jobListings", "legacyLive"), { jobStatus: "closed", updatedAt: new Date() }));
    await assertSucceeds(updateDoc(doc(db, "jobListings", "legacyLive"), { jobStatus: "live", updatedAt: new Date() }));
  });

  it("unverified poster: a content edit of a live job stays live, and never goes to pending", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    await assertSucceeds(updateDoc(doc(db, "jobListings", "plainLive"), { jobTitle: "Senior Sales Executive", updatedAt: new Date() }));
    await assertFails(updateDoc(doc(db, "jobListings", "plainLive"), { jobTitle: "Sales Head", status: "pending", updatedAt: new Date() }));
  });

  it("unverified poster can edit an old-shape job (it stays live)", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    const f = buildJobFields(draft({ title: "Interior Designer", pay: { period: "month", min: "35000", max: "", display: "show_range", incentives: "" } }));
    await assertSucceeds(updateDoc(doc(db, "jobListings", "legacyLive"), { ...f, updatedAt: new Date() }));
  });

  it("unverified poster editing a pending job keeps it pending", async () => {
    const db = testEnv.authenticatedContext("plain").firestore();
    await assertSucceeds(updateDoc(doc(db, "jobListings", "plainPending"), { headcount: 3, updatedAt: new Date() }));
  });

  it("verified poster's content edit stays live", async () => {
    const db = testEnv.authenticatedContext("verified").firestore();
    await assertSucceeds(updateDoc(doc(db, "jobListings", "verifiedLive"), { jobTitle: "Area Sales Manager", updatedAt: new Date() }));
  });

  it("approval stays admin-only: nobody but admin can approve or reject", async () => {
    const plain = testEnv.authenticatedContext("plain").firestore();
    await assertFails(updateDoc(doc(plain, "jobListings", "plainPending"), { status: "approved", jobStatus: "live" }));
    const verified = testEnv.authenticatedContext("verified").firestore();
    await assertFails(updateDoc(doc(verified, "jobListings", "verifiedLive"), { status: "rejected" }));
    const admin = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(updateDoc(doc(admin, "jobListings", "plainPending"), { status: "approved", jobStatus: "live" }));
  });

  it("can't change who posted it, the poster type or created date", async () => {
    const db = testEnv.authenticatedContext("verified").firestore();
    await assertFails(updateDoc(doc(db, "jobListings", "verifiedLive"), { postedByUid: "plain" }));
    await assertFails(updateDoc(doc(db, "jobListings", "verifiedLive"), { postedByType: "individual" }));
    await assertFails(updateDoc(doc(db, "jobListings", "verifiedLive"), { createdAt: new Date() }));
  });

  it("can't edit someone else's job, or set an unknown jobStatus", async () => {
    await assertFails(updateDoc(doc(testEnv.authenticatedContext("plain").firestore(), "jobListings", "verifiedLive"), { jobStatus: "closed" }));
    await assertFails(updateDoc(doc(testEnv.authenticatedContext("verified").firestore(), "jobListings", "verifiedLive"), { jobStatus: "deleted" }));
  });

  it("an edit can't add another store's id or hidden-pay amounts", async () => {
    const db = testEnv.authenticatedContext("verified").firestore();
    await assertFails(updateDoc(doc(db, "jobListings", "verifiedLive"), { storeId: "storeL" }));
    await assertFails(updateDoc(doc(db, "jobListings", "verifiedLive"), { pay: { period: "month", min: 1, max: null, display: "negotiable", incentives: "" } }));
  });
});
