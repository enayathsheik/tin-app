// Jobs redesign phase 2 — saved jobs (users/{uid}/savedJobs/{jobId}) and
// job reports (jobReports/{jobId}_{uid}), per docs/JOBS_BLUEPRINT.md §5.1.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, collection } from "firebase/firestore";

const PROJECT_ID = "jobs-save-report-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

const report = (uid, jobId = "job1", extra = {}) => ({ jobId, reporterUid: uid, reason: "scam", createdAt: new Date(), ...extra });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "jobListings", "job1"), { postedByUid: "poster", jobTitle: "Sales", status: "approved", jobStatus: "live" });
    await setDoc(doc(db, "users", "alice", "savedJobs", "job1"), { jobId: "job1", savedAt: new Date() });
    await setDoc(doc(db, "jobReports", "job1_bob"), report("bob"));
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("savedJobs", () => {
  it("a user can save, read, list and unsave their own jobs", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(db, "users", "alice", "savedJobs", "job2"), { jobId: "job2", savedAt: new Date() }));
    await assertSucceeds(getDoc(doc(db, "users", "alice", "savedJobs", "job1")));
    await assertSucceeds(getDocs(collection(db, "users", "alice", "savedJobs")));
    await assertSucceeds(deleteDoc(doc(db, "users", "alice", "savedJobs", "job2")));
  });

  it("nobody else can read or write someone's saved jobs", async () => {
    const db = testEnv.authenticatedContext("mallory").firestore();
    await assertFails(getDoc(doc(db, "users", "alice", "savedJobs", "job1")));
    await assertFails(getDocs(collection(db, "users", "alice", "savedJobs")));
    await assertFails(setDoc(doc(db, "users", "alice", "savedJobs", "job3"), { jobId: "job3" }));
    await assertFails(deleteDoc(doc(db, "users", "alice", "savedJobs", "job1")));
  });

  it("guests can't save", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "users", "alice", "savedJobs", "job4"), { jobId: "job4" }));
  });
});

describe("jobReports", () => {
  it("a signed-in user can report a job once, with an allowed reason", async () => {
    const db = testEnv.authenticatedContext("carol").firestore();
    await assertSucceeds(setDoc(doc(db, "jobReports", "job1_carol"), report("carol")));
  });

  it("a second report from the same person is denied (it's an update)", async () => {
    const db = testEnv.authenticatedContext("bob").firestore();
    await assertFails(setDoc(doc(db, "jobReports", "job1_bob"), report("bob", "job1", { reason: "other" })));
  });

  it("can't report as someone else, under a mismatched id, or for a job that doesn't exist", async () => {
    const db = testEnv.authenticatedContext("dave").firestore();
    await assertFails(setDoc(doc(db, "jobReports", "job1_dave"), report("erin")));
    await assertFails(setDoc(doc(db, "jobReports", "job1_someoneelse"), report("dave")));
    await assertFails(setDoc(doc(db, "jobReports", "ghost_dave"), report("dave", "ghost")));
  });

  it("only the allowed fields and reasons", async () => {
    const db = testEnv.authenticatedContext("frank").firestore();
    await assertFails(setDoc(doc(db, "jobReports", "job1_frank"), report("frank", "job1", { reason: "spam!!" })));
    await assertFails(setDoc(doc(db, "jobReports", "job1_frank"), report("frank", "job1", { note: "extra field" })));
  });

  it("guests can't report", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "jobReports", "job1_anon"), report("anon")));
  });

  it("reports are admin-only to read, update and delete", async () => {
    const reporter = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(reporter, "jobReports", "job1_bob")));
    const poster = testEnv.authenticatedContext("poster").firestore();
    await assertFails(getDoc(doc(poster, "jobReports", "job1_bob")));
    const admin = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(getDoc(doc(admin, "jobReports", "job1_bob")));
    await assertSucceeds(updateDoc(doc(admin, "jobReports", "job1_bob"), { reviewed: true }));
  });
});
