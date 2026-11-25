// L10 shortlist limit (launch): each job post can shortlist at most `limit`
// applicants (config/pricing.shortlistLimit, default 10). An applicant counts
// once — the first time they reach Shortlisted (contact unlock, L8) — and
// moving them later, rejecting them or closing the job never frees the slot.
// Enforced here in the rules (numbered slots + shortlistCount), not just the
// screen. The limit applies when beta mode is OFF; beta ON is tested last. Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { stageUpdate } from "../../src/utils/applications.js";
import { planShortlistSlots } from "../../src/utils/shortlist.js";
import { pricingFrom } from "../../src/utils/pricing.js";
import { firstShortlist } from "./shortlistHelper.js";

const PROJECT_ID = "shortlist-limit-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const JOB = "jobL", EMP = "emp";
let testEnv;

const as = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();
const appId = (i) => `${JOB}_c${i}`;
const submitted = (i) => ({ jobId: JOB, applicantUid: `c${i}`, applicantName: `C${i}`, stage: "submitted", stageHistory: [{ stage: "submitted" }], applicantStatus: "new", createdAt: new Date() });
const w = (u) => (u.contactUnlockedAt ? { ...u, contactUnlockedAt: serverTimestamp() } : u);
const read = async (path) => { let d; await testEnv.withSecurityRulesDisabled(async (c) => { d = (await getDoc(doc(c.firestore(), ...path))).data(); }); return d; };
const shortlistUpdate = async (i, to = "shortlisted") => w(stageUpdate(await read(["jobApplications", appId(i)]), to, "employer", EMP));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "config", "pricing"), { betaMode: false });
    await setDoc(doc(db, "jobListings", JOB), { postedByUid: EMP, jobTitle: "Masons", status: "approved", jobStatus: "live", createdAt: new Date() });
    for (let i = 1; i <= 13; i++) await setDoc(doc(db, "jobApplications", appId(i)), submitted(i));
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("the limit (default 10)", () => {
  it("the 10th shortlist works and the 11th is refused", async () => {
    for (let i = 1; i <= 10; i++) await assertSucceeds(firstShortlist(as(EMP), appId(i), JOB, await shortlistUpdate(i), i));
    expect((await read(["jobListings", JOB])).shortlistCount).toBe(10);
    await assertFails(firstShortlist(as(EMP), appId(11), JOB, await shortlistUpdate(11), 11));
    // …and no way round it: reusing a taken slot, or unlocking without a slot.
    await assertFails(firstShortlist(as(EMP), appId(11), JOB, await shortlistUpdate(11), 10, { count: 10 }));
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", appId(11)), await shortlistUpdate(11)));
  });

  it("an admin-set limit in config/pricing is used (and only the admin can set it)", async () => {
    await assertFails(setDoc(doc(as(EMP), "config", "pricing"), { ...pricingFrom({ betaMode: false }), shortlistLimit: 50 }));
    await assertSucceeds(setDoc(doc(as("adm", ADMIN_EMAIL), "config", "pricing"), { ...pricingFrom({ betaMode: false }), shortlistLimit: 2 }));
    await assertSucceeds(firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 1));
    await assertSucceeds(firstShortlist(as(EMP), appId(2), JOB, await shortlistUpdate(2), 2));
    await assertFails(firstShortlist(as(EMP), appId(3), JOB, await shortlistUpdate(3), 3));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "config", "pricing"))); // screens can read it
  });
});

describe("counting once", () => {
  it("re-shortlisting the same person, moving them on, or rejecting them doesn't count again or free the slot", async () => {
    await firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 1);
    // Already unlocked: later moves are plain updates, no slot, count unchanged.
    await assertSucceeds(updateDoc(doc(as(EMP), "jobApplications", appId(1)), await shortlistUpdate(1, "int_done")));
    await assertFails(firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1, "selected"), 2)); // can't take a 2nd slot
    await assertSucceeds(updateDoc(doc(as(EMP), "jobApplications", appId(1)), await shortlistUpdate(1, "not_selected")));
    expect((await read(["jobListings", JOB])).shortlistCount).toBe(1);
    // The slot stays; the counter can't go back down.
    await assertFails(deleteDoc(doc(as(EMP), "jobListings", JOB, "shortlistSlots", "1")));
    await assertFails(updateDoc(doc(as(EMP), "jobListings", JOB), { shortlistCount: 0 }));
  });

  it("closing the job doesn't free slots", async () => {
    await firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 1);
    await assertSucceeds(updateDoc(doc(as(EMP), "jobListings", JOB), { jobStatus: "closed", updatedAt: serverTimestamp() }));
    expect((await read(["jobListings", JOB])).shortlistCount).toBe(1);
  });
});

describe("bulk shortlist over the limit partly applies", () => {
  it("with 8 used, shortlisting 4 more applies 2 and skips 2", async () => {
    for (let i = 1; i <= 8; i++) await firstShortlist(as(EMP), appId(i), JOB, await shortlistUpdate(i), i);
    const items = [];
    for (const i of [9, 10, 11, 12]) items.push({ app: { id: appId(i), jobId: JOB }, update: stageUpdate(await read(["jobApplications", appId(i)]), "shortlisted", "employer", EMP) });
    const plan = planShortlistSlots(items, { count: 8, limit: 10 });
    expect(plan.slotted.map(x => x.app.id)).toEqual([appId(9), appId(10)]);
    expect(plan.overLimit.map(x => x.app.id)).toEqual([appId(11), appId(12)]);
    let n = 8;
    for (const it of plan.slotted) await assertSucceeds(firstShortlist(as(EMP), it.app.id, JOB, w(it.update), ++n));
    expect((await read(["jobListings", JOB])).shortlistCount).toBe(10);
    expect((await read(["jobApplications", appId(11)])).stage).toBe("submitted");
  });

  it("one batch can't unlock two applicants with a single slot / counter step", async () => {
    const db = as(EMP);
    const batch = writeBatch(db);
    batch.update(doc(db, "jobApplications", appId(1)), { ...(await shortlistUpdate(1)), shortlistSlot: 1 });
    batch.update(doc(db, "jobApplications", appId(2)), { ...(await shortlistUpdate(2)), shortlistSlot: 1 });
    batch.set(doc(db, "jobListings", JOB, "shortlistSlots", "1"), { appId: appId(1), createdAt: serverTimestamp() });
    batch.update(doc(db, "jobListings", JOB), { shortlistCount: 1 });
    await assertFails(batch.commit());
  });
});

describe("beta mode", () => {
  const setConfig = (data) => testEnv.withSecurityRulesDisabled(async (c) => (data ? setDoc(doc(c.firestore(), "config", "pricing"), data) : deleteDoc(doc(c.firestore(), "config", "pricing"))));
  const fill = (n) => testEnv.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), "jobListings", JOB), { shortlistCount: n }));

  it("ON when there's no setting yet: no limit, and slots and the count are still recorded", async () => {
    for (const cfg of [null, { shortlistLimit: 10 }, { shortlistLimit: 2, betaMode: true }]) {
      await setConfig(cfg);
      const i = cfg ? (cfg.betaMode ? 3 : 2) : 1;
      await fill(9 + i);
      await assertSucceeds(firstShortlist(as(EMP), appId(i), JOB, await shortlistUpdate(i), 10 + i));
      expect((await read(["jobListings", JOB])).shortlistCount).toBe(10 + i);
      expect((await read(["jobListings", JOB, "shortlistSlots", String(10 + i)])).appId).toBe(appId(i));
      expect((await read(["jobApplications", appId(i)])).shortlistSlot).toBe(10 + i);
    }
  });
  it("ON: past 999, and contact still can't be unlocked without a recorded slot", async () => {
    await setConfig({ betaMode: true });
    await fill(1500);
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", appId(1)), await shortlistUpdate(1)));
    await assertFails(firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 1501, { count: 1500 }));
    await assertSucceeds(firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 1501));
  });
  it("switched OFF: the limit applies at once, even to a job already past it", async () => {
    await setConfig({ betaMode: true, shortlistLimit: 3 });
    for (let i = 1; i <= 4; i++) await assertSucceeds(firstShortlist(as(EMP), appId(i), JOB, await shortlistUpdate(i), i));
    await setConfig({ betaMode: false, shortlistLimit: 3 });
    await assertFails(firstShortlist(as(EMP), appId(5), JOB, await shortlistUpdate(5), 5));
    // People already shortlisted can still be moved on.
    await assertSucceeds(updateDoc(doc(as(EMP), "jobApplications", appId(4)), await shortlistUpdate(4, "contacted")));
    await setConfig({ betaMode: false });   // no number saved: 10
    await assertSucceeds(firstShortlist(as(EMP), appId(5), JOB, await shortlistUpdate(5), 5));
    await fill(10);
    await assertFails(firstShortlist(as(EMP), appId(6), JOB, await shortlistUpdate(6), 11));
  });
  it("only the admin can switch it, and only to yes or no", async () => {
    const p = pricingFrom(null);
    expect(p.betaMode).toBe(true);
    const admin = as("adm", ADMIN_EMAIL);
    await assertFails(setDoc(doc(as(EMP), "config", "pricing"), { ...p, betaMode: true }));
    await assertFails(updateDoc(doc(as(EMP), "config", "pricing"), { betaMode: true }));
    for (const v of ["off", 0, null]) await assertFails(setDoc(doc(admin, "config", "pricing"), { ...p, betaMode: v }));
    for (const v of [false, true]) await assertSucceeds(setDoc(doc(admin, "config", "pricing"), { ...p, betaMode: v }));
  });
});

describe("slot tampering", () => {
  it("a slot must belong to an application of THIS job that takes it in the same batch", async () => {
    await assertFails(firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 1, { slotAppId: appId(2) }));
    await assertFails(setDoc(doc(as(EMP), "jobListings", JOB, "shortlistSlots", "1"), { appId: appId(1), createdAt: serverTimestamp() }));
  });
  it("slot numbers outside 1..limit, and other employers, are refused", async () => {
    await assertFails(firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 11, { count: 11 }));
    await assertFails(firstShortlist(as(EMP), appId(1), JOB, await shortlistUpdate(1), 0, { count: 1 }));
    await assertFails(firstShortlist(as("emp2"), appId(1), JOB, await shortlistUpdate(1), 1));
  });
  it("a new job can't start with shortlists used", async () => {
    const j = (n) => ({ postedByUid: EMP, status: "approved", jobStatus: "live", shortlistCount: n, lane: "skilled", headcount: 1, createdAt: serverTimestamp(),
      pay: { period: "month", min: 1000, max: 2000, display: "show_range", negotiable: false, incentives: "" } });
    await assertFails(setDoc(doc(as(EMP), "jobListings", "j2"), j(3)));
    await assertSucceeds(setDoc(doc(as(EMP), "jobListings", "j2"), j(0)));
  });
});
