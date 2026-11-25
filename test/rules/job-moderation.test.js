// Jobs go live at once; TIN checks afterwards. Take down / restore, block from
// posting, job reports, and the employer closing their own job.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteField, doc, getDoc, getDocs, orderBy, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { stageUpdate } from "../../src/utils/applications.js";
import { buildJobFields, emptyDraft } from "../../src/utils/jobDraft.js";
import { approvedFields } from "../../src/utils/jobModeration.js";
import { firstShortlist } from "./shortlistHelper.js";

const PROJECT_ID = "job-moderation-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const EMP = "emp", CAND = "cand", JOB = "job1", WAIT = "jobWait";
const APP = `${JOB}_${CAND}`, APP2 = `${JOB}_cand2`;
let testEnv;

const as = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();
const admin = () => as("adm", ADMIN_EMAIL);
const raw = (fn) => testEnv.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const submitted = (uid) => ({ jobId: JOB, applicantUid: uid, applicantName: uid, stage: "submitted", stageHistory: [{ stage: "submitted" }], applicantStatus: "new", createdAt: new Date() });
const newJob = (uid) => ({
  ...buildJobFields({
    ...emptyDraft({}), business: { name: "A Tiles", industry: "retail_distribution", city: "Mumbai" }, lane: "professional", title: "Sales", headcount: "1",
    functions: ["sales_bd"], workTypes: ["full_time"], city: "Mumbai", duties: "Visit dealers",
    pay: { period: "month", min: "22000", max: "28000", display: "show_range", incentives: "" }, contactPhone: "9800000000", notAgencyDeclaration: true,
  }),
  postedByUid: uid, postedByName: "X", postedByType: "individual", status: "approved", jobStatus: "live", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});
const down = { status: "taken_down", takedown: { reason: "Asks for money", at: serverTimestamp() } };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await raw(async (db) => {
    await setDoc(doc(db, "users", EMP), { role: "employer", name: "Emp", verificationStatus: "pending" });
    await setDoc(doc(db, "users", CAND), { role: "jobseeker" });
    await setDoc(doc(db, "jobListings", JOB), { ...newJob(EMP), shortlistCount: 1, createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, "jobListings", WAIT), { ...newJob(EMP), status: "pending", jobStatus: null, createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, "jobApplications", APP), { ...submitted(CAND), stage: "shortlisted", contactUnlockedAt: new Date(), shortlistSlot: 1 });
    await setDoc(doc(db, "jobApplications", APP, "private", "contact"), { applicantPhone: "9", applicantEmail: "e" });
    await setDoc(doc(db, "jobApplications", APP2), submitted("cand2"));
    await setDoc(doc(db, "jobApplications", APP2, "private", "contact"), { applicantPhone: "8" });
  });
});
afterAll(async () => { await testEnv.cleanup(); });

describe("take down", () => {
  const contact = (db) => getDoc(doc(db, "jobApplications", APP, "private", "contact"));

  it("hides the job from the public; the poster still sees it, with the reason", async () => {
    const pub = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(pub, "jobListings", JOB)));
    await assertSucceeds(updateDoc(doc(admin(), "jobListings", JOB), down));
    await assertFails(getDoc(doc(pub, "jobListings", JOB)));
    await assertFails(getDoc(doc(as(CAND), "jobListings", JOB)));
    await assertSucceeds(getDoc(doc(as(EMP), "jobListings", JOB)));
    await assertFails(setDoc(doc(as("cand3"), "jobApplications", `${JOB}_cand3`), submitted("cand3"))); // nobody new can apply
  });

  it("ends the employer's access to applications and unlocked contacts; candidate and TIN keep theirs; restore gives it back", async () => {
    await assertSucceeds(contact(as(EMP)));
    await assertSucceeds(getDocs(query(collection(as(EMP), "jobApplications"), where("jobId", "==", JOB))));
    for (const status of ["taken_down", "rejected"]) {
      await assertSucceeds(updateDoc(doc(admin(), "jobListings", JOB), { ...down, status }));
      await assertFails(contact(as(EMP)));
      await assertFails(getDoc(doc(as(EMP), "jobApplications", APP)));
      await assertFails(getDocs(query(collection(as(EMP), "jobApplications"), where("jobId", "==", JOB))));
      await assertSucceeds(contact(as(CAND)));
      await assertSucceeds(contact(admin()));
      await assertSucceeds(getDocs(query(collection(admin(), "jobApplications"), where("jobId", "==", JOB))));
      await assertSucceeds(getDocs(query(collection(as(CAND), "jobApplications"), where("applicantUid", "==", CAND))));
    }
    await assertSucceeds(updateDoc(doc(admin(), "jobListings", JOB), { ...approvedFields({ jobStatus: "live" }), takedown: deleteField() }));
    await assertSucceeds(contact(as(EMP)));
    await assertSucceeds(getDocs(query(collection(as(EMP), "jobApplications"), where("jobId", "==", JOB))));
  });

  it("the employer can't shortlist or move anyone while it's down; the candidate can still withdraw", async () => {
    await updateDoc(doc(admin(), "jobListings", JOB), down);
    const u = { ...stageUpdate(submitted("cand2"), "shortlisted", "employer", EMP), contactUnlockedAt: serverTimestamp() };
    await assertFails(firstShortlist(as(EMP), APP2, JOB, u, 2));
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", APP2), stageUpdate(submitted("cand2"), "review", "employer", EMP)));
    await assertFails(updateDoc(doc(as(EMP), "jobApplications", APP2), { applicantStatus: "rejected" }));
    await assertSucceeds(updateDoc(doc(as("cand2"), "jobApplications", APP2), { stage: "withdrawn", stageHistory: [{ stage: "submitted" }, { stage: "withdrawn" }], updatedAt: serverTimestamp() }));
  });

  it("the poster can't put it back, remove the note, or restart it by editing", async () => {
    await updateDoc(doc(admin(), "jobListings", JOB), down);
    const mine = doc(as(EMP), "jobListings", JOB);
    await assertFails(updateDoc(mine, { status: "approved" }));
    await assertFails(updateDoc(mine, { status: "pending" }));
    await assertFails(updateDoc(mine, { takedown: deleteField() }));
    await assertFails(setDoc(mine, newJob(EMP)));
    await assertSucceeds(updateDoc(mine, { jobTitle: "Fixed title", updatedAt: serverTimestamp() })); // may fix it for TIN to look at
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "jobListings", JOB)));
    await assertFails(contact(as(EMP)));
  });

  it("only the admin can take down, restore or approve", async () => {
    for (const db of [as(EMP), as(CAND), as("other", "someone@else.com")]) {
      await assertFails(updateDoc(doc(db, "jobListings", JOB), down));
      await assertFails(updateDoc(doc(db, "jobListings", WAIT), approvedFields({})));
    }
    await assertSucceeds(updateDoc(doc(admin(), "jobListings", WAIT), approvedFields({})));
  });
});

describe("Approve all pending jobs", () => {
  it("one batch by the admin; the same batch from anyone else is refused", async () => {
    await raw(db => setDoc(doc(db, "jobListings", "jobWait2"), { ...newJob("emp2"), status: "pending", createdAt: new Date(), updatedAt: new Date() }));
    const all = (db) => { const b = writeBatch(db); for (const id of [WAIT, "jobWait2"]) b.update(doc(db, "jobListings", id), approvedFields({})); return b.commit(); };
    await assertSucceeds(getDocs(query(collection(admin(), "jobListings"), where("status", "==", "pending"))));
    await assertFails(all(as(EMP)));
    await assertSucceeds(all(admin()));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "jobListings", "jobWait2")));
  });
});

describe("block from posting", () => {
  const block = { postingBlocked: true, postingBlockedReason: "Scam", postingBlockedAt: serverTimestamp() };
  const blockEmp = () => setDoc(doc(admin(), "users", EMP), block, { merge: true });

  it("blocks new jobs and reopening; pausing and closing still work; unblocking restores both", async () => {
    const mine = doc(as(EMP), "jobListings", JOB);
    await assertSucceeds(addDoc(collection(as(EMP), "jobListings"), newJob(EMP)));
    await assertSucceeds(blockEmp());
    await assertFails(addDoc(collection(as(EMP), "jobListings"), newJob(EMP)));
    await assertFails(addDoc(collection(as(EMP), "jobListings"), { ...newJob(EMP), status: "pending" }));
    for (const jobStatus of ["paused", "filled", "closed"]) {
      await assertSucceeds(updateDoc(mine, { jobStatus, updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(mine, { jobStatus: "live", updatedAt: serverTimestamp() }));
    }
    // Turning an old job into a new one by editing it, or both at once.
    await assertFails(updateDoc(mine, { jobTitle: "Another job", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(mine, { jobTitle: "Another job", jobStatus: "live", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(admin(), "users", EMP), { postingBlocked: deleteField(), postingBlockedReason: deleteField(), postingBlockedAt: deleteField() }));
    await assertSucceeds(updateDoc(mine, { jobStatus: "live", updatedAt: serverTimestamp() }));
    await assertSucceeds(addDoc(collection(as(EMP), "jobListings"), newJob(EMP)));
  });

  it("nobody can block, unblock or pre-set it themselves; their other account saves still work", async () => {
    const me = doc(as(EMP), "users", EMP);
    await assertFails(updateDoc(me, { postingBlocked: false }));
    await blockEmp();
    await assertFails(updateDoc(me, { postingBlocked: false }));
    await assertFails(updateDoc(me, { postingBlocked: deleteField() }));
    await assertFails(updateDoc(me, { postingBlockedReason: "" }));
    await assertFails(setDoc(me, { role: "employer", verificationStatus: "pending" }));   // replacing the whole record
    await assertSucceeds(updateDoc(me, { name: "New name" }));
    await assertSucceeds(getDoc(me));                                                     // sees their own reason
    await assertFails(setDoc(doc(as("fresh"), "users", "fresh"), { role: "employer", postingBlocked: false }));
    await assertSucceeds(setDoc(doc(as("fresh"), "users", "fresh"), { role: "employer" }));
    await assertFails(updateDoc(doc(as("fresh"), "users", EMP), { postingBlocked: deleteField() }));
  });

  it("the admin can block an account with no users record, and list the blocked ones; others can't list", async () => {
    await assertSucceeds(setDoc(doc(admin(), "users", "ghost"), block, { merge: true }));
    await assertFails(addDoc(collection(as("ghost"), "jobListings"), newJob("ghost")));
    await assertFails(setDoc(doc(as("ghost"), "users", "ghost"), { role: "employer" }));
    const q = (db) => getDocs(query(collection(db, "users"), where("postingBlocked", "==", true)));
    await assertSucceeds(q(admin()));
    await assertFails(q(as(EMP)));
  });
});

describe("the employer closes their own job", () => {
  it("any time, live or still waiting, with its open applications; it leaves the public list and can be reopened", async () => {
    const db = as(EMP);
    const b = writeBatch(db);
    b.update(doc(db, "jobApplications", APP2), { ...stageUpdate(submitted("cand2"), "closed", "employer", EMP), updatedAt: serverTimestamp() });
    b.update(doc(db, "jobListings", JOB), { jobStatus: "closed", updatedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
    await assertFails(setDoc(doc(as("cand3"), "jobApplications", `${JOB}_cand3`), submitted("cand3")));
    await assertSucceeds(getDoc(doc(db, "jobApplications", APP, "private", "contact"))); // closing keeps unlocked contacts
    await assertSucceeds(updateDoc(doc(db, "jobListings", JOB), { jobStatus: "live", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "jobListings", WAIT), { jobStatus: "closed", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(CAND), "jobListings", JOB), { jobStatus: "closed" }));
  });
});

describe("Admin → Jobs Review lists", () => {
  it("new jobs, taken-down jobs and reports: admin only; reports can be marked checked by the admin only", async () => {
    await assertSucceeds(setDoc(doc(as(CAND), "jobReports", APP), { jobId: JOB, reporterUid: CAND, reason: "scam", createdAt: serverTimestamp() }));
    const newest = (db) => getDocs(query(collection(db, "jobListings"), orderBy("createdAt", "desc"), limit(30)));
    const gone = (db) => getDocs(query(collection(db, "jobListings"), where("status", "in", ["taken_down", "rejected"])));
    const reports = (db) => getDocs(collection(db, "jobReports"));
    for (const q of [newest, gone, reports]) {
      await assertSucceeds(q(admin()));
      await assertFails(q(as(EMP)));
      await assertFails(q(as(CAND)));
    }
    for (const db of [as(EMP), as(CAND)]) await assertFails(updateDoc(doc(db, "jobReports", APP), { checkedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(admin(), "jobReports", APP), { checkedAt: serverTimestamp() }));
  });
});
