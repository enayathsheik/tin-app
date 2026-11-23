// Jobs redesign phase 4 — jobApplications create / candidate / employer
// rules and candidate job profiles (docs/JOBS_BLUEPRINT.md §5.4–§5.6).
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { applicationSnapshot, emptyProfile, splitProfile } from "../../src/utils/jobProfile.js";
import { stageUpdate } from "../../src/utils/applications.js";
import { firstShortlist } from "./shortlistHelper.js";

const PROJECT_ID = "applications-phase4-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

const profile = (extra = {}) => ({ ...emptyProfile(), name: "Prakash", phone: "9769031000", lane: "skilled", trades: ["mason"], city: "Thane", currentPay: "₹800 / day", expectedPay: "₹950 / day", ...extra });
const newApp = (jobId, uid, extra = {}) => ({
  jobId, applicantUid: uid, ...applicationSnapshot(profile()), message: "",
  stage: "submitted", stageHistory: [{ stage: "submitted", at: new Date(), by: "candidate", byUid: uid }],
  applicantStatus: "new", createdAt: new Date(), ...extra,
});
// L8: the client writes contactUnlockedAt as serverTimestamp() (rules: == request.time).
const w = (update) => (update.contactUnlockedAt ? { ...update, contactUnlockedAt: serverTimestamp() } : update);
const job = (poster, extra = {}) => ({ postedByUid: poster, jobTitle: "Masons", status: "approved", jobStatus: "live", createdAt: new Date(), ...extra });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "jobListings", "live"), job("emp"));
    await setDoc(doc(db, "jobListings", "pendingJob"), job("emp", { status: "pending", jobStatus: null }));
    await setDoc(doc(db, "jobListings", "closedJob"), job("emp", { jobStatus: "closed" }));
    await setDoc(doc(db, "jobListings", "otherLive"), job("emp2"));
    // Existing applications at various stages (by cand1 to job "otherLive" etc.)
    const put = (id, data) => setDoc(doc(db, "jobApplications", id), data);
    await put("live_cSub", newApp("live", "cSub"));
    await put("live_cInv", newApp("live", "cInv", { stage: "int_invited", stageHistory: [{ stage: "submitted" }, { stage: "int_invited" }], interview: { date: "2026-11-25" } }));
    await put("live_cOffer", newApp("live", "cOffer", { stage: "offer_sent", stageHistory: [{ stage: "submitted" }, { stage: "offer_sent" }] }));
    await put("live_cDone", newApp("live", "cDone", { stage: "not_selected", stageHistory: [{ stage: "submitted" }, { stage: "not_selected" }] }));
    // Old-style applications (before Phase 4): applicantStatus only, no stage/history.
    await put("live_cOld", { jobId: "live", applicantUid: "cOld", applicantName: "Old", applicantPhone: "98", resumeUrl: "https://x", applicantStatus: "new", createdAt: new Date() });
    await put("live_cOldRej", { jobId: "live", applicantUid: "cOldRej", applicantName: "Old R", applicantStatus: "rejected", createdAt: new Date() });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const as = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();

describe("apply (create)", () => {
  it("a candidate can apply to a live job with the new shape", async () => {
    await assertSucceeds(setDoc(doc(as("c1"), "jobApplications", "live_c1"), newApp("live", "c1")));
  });

  it("L8: the old apply shape (phone / CV link on the application itself) is refused", async () => {
    await assertFails(setDoc(doc(as("c2"), "jobApplications", "live_c2"), {
      jobId: "live", applicantUid: "c2", applicantName: "C2", applicantPhone: "98", message: "", resumeUrl: "https://x", resumeFileName: "cv.pdf", applicantStatus: "new", createdAt: new Date(),
    }));
  });

  it("L8: a CV path on the application itself is refused (it belongs in private/contact)", async () => {
    await assertFails(setDoc(doc(as("c3"), "jobApplications", "live_c3"), newApp("live", "c3", { resumePath: "resumes/c3/live/123_cv.pdf" })));
  });

  it("the job must exist and be approved + live", async () => {
    await assertFails(setDoc(doc(as("c6"), "jobApplications", "pendingJob_c6"), newApp("pendingJob", "c6")));
    await assertFails(setDoc(doc(as("c6"), "jobApplications", "closedJob_c6"), newApp("closedJob", "c6")));
    await assertFails(setDoc(doc(as("c6"), "jobApplications", "ghost_c6"), newApp("ghost", "c6")));
  });

  it("must start at 'submitted', as yourself, under the right id, once", async () => {
    await assertFails(setDoc(doc(as("c7"), "jobApplications", "live_c7"), newApp("live", "c7", { stage: "shortlisted" })));
    await assertFails(setDoc(doc(as("c7"), "jobApplications", "live_c7"), newApp("live", "c7", { applicantStatus: "hired" })));
    await assertFails(setDoc(doc(as("c7"), "jobApplications", "live_c7"), newApp("live", "someoneElse")));
    await assertFails(setDoc(doc(as("c7"), "jobApplications", "live_wrongId"), newApp("live", "c7")));
    await assertFails(setDoc(doc(as("cSub"), "jobApplications", "live_cSub"), newApp("live", "cSub"))); // already applied
  });

  it("L8: pay goes into an application only when the candidate switched on \"show my pay\"", async () => {
    await assertFails(setDoc(doc(as("c8"), "jobApplications", "live_c8"), newApp("live", "c8", { currentPay: "₹800 / day" })));
    await assertFails(setDoc(doc(as("c8"), "jobApplications", "live_c8"), newApp("live", "c8", { expectedPay: "₹950 / day" })));
    await assertSucceeds(setDoc(doc(as("c8"), "jobApplications", "live_c8"), newApp("live", "c8", { payVisible: true, expectedPay: "₹950 / day", currentPay: "₹800 / day" })));
  });

  it("can't apply to your own job; guests can't apply", async () => {
    await assertFails(setDoc(doc(as("emp"), "jobApplications", "live_emp"), newApp("live", "emp")));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), "jobApplications", "live_anon"), newApp("live", "anon")));
  });
});

describe("reading applications", () => {
  it("the candidate, the job's poster and admin can read; others can't", async () => {
    await assertSucceeds(getDoc(doc(as("cSub"), "jobApplications", "live_cSub")));
    await assertSucceeds(getDoc(doc(as("emp"), "jobApplications", "live_cSub")));
    await assertSucceeds(getDoc(doc(as("adm", ADMIN_EMAIL), "jobApplications", "live_cSub")));
    await assertFails(getDoc(doc(as("emp2"), "jobApplications", "live_cSub")));
    await assertFails(getDoc(doc(as("cInv"), "jobApplications", "live_cSub")));
  });
});

describe("candidate updates", () => {
  const app = (id, stage, hist) => ({ id, stage, stageHistory: hist });

  it("accept an interview (invited → scheduled)", async () => {
    const u = stageUpdate(app("live_cInv", "int_invited", [{ stage: "submitted" }, { stage: "int_invited" }]), "int_scheduled", "candidate", "cInv");
    await assertSucceeds(updateDoc(doc(as("cInv"), "jobApplications", "live_cInv"), { ...u, updatedAt: new Date() }));
  });

  it("ask for another time: a note, stage unchanged — only while invited/rescheduled", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "jobApplications", "live_cInv2"), newApp("live", "cInv2", { stage: "int_invited", stageHistory: [{ stage: "submitted" }, { stage: "int_invited" }] })));
    await assertSucceeds(updateDoc(doc(as("cInv2"), "jobApplications", "live_cInv2"), { interviewResponse: { type: "reschedule_request", note: "After 4 pm" }, updatedAt: new Date() }));
    await assertFails(updateDoc(doc(as("cSub"), "jobApplications", "live_cSub"), { interviewResponse: { type: "reschedule_request", note: "x" } }));
  });

  it("answer an offer only from offer_sent", async () => {
    const u = stageUpdate(app("live_cOffer", "offer_sent", [{ stage: "submitted" }, { stage: "offer_sent" }]), "offer_accepted", "candidate", "cOffer");
    await assertSucceeds(updateDoc(doc(as("cOffer"), "jobApplications", "live_cOffer"), u));
    const bad = stageUpdate(app("live_cSub", "submitted", [{ stage: "submitted" }]), "offer_accepted", "candidate", "cSub");
    await assertFails(updateDoc(doc(as("cSub"), "jobApplications", "live_cSub"), bad));
  });

  it("can't set employer stages or skip the timeline entry", async () => {
    const shortlist = stageUpdate(app("live_cSub", "submitted", [{ stage: "submitted" }]), "shortlisted", "candidate", "cSub");
    await assertFails(updateDoc(doc(as("cSub"), "jobApplications", "live_cSub"), shortlist));
    await assertFails(updateDoc(doc(as("cSub"), "jobApplications", "live_cSub"), { stage: "withdrawn" })); // no history entry
    await assertFails(updateDoc(doc(as("cSub"), "jobApplications", "live_cSub"), { applicantPhone: "0000" }));
  });

  it("withdraw — then nothing more (closed)", async () => {
    const u = stageUpdate(app("live_cSub", "submitted", [{ stage: "submitted" }]), "withdrawn", "candidate", "cSub");
    await assertSucceeds(updateDoc(doc(as("cSub"), "jobApplications", "live_cSub"), u));
    const again = stageUpdate(app("live_cSub", "withdrawn", u.stageHistory), "withdrawn", "candidate", "cSub");
    await assertFails(updateDoc(doc(as("cSub"), "jobApplications", "live_cSub"), again));
  });

  it("an old application (no stage) can be withdrawn; an old 'rejected' one is closed", async () => {
    const u = stageUpdate({ applicantStatus: "new" }, "withdrawn", "candidate", "cOld");
    await assertSucceeds(updateDoc(doc(as("cOld"), "jobApplications", "live_cOld"), u));
    const r = stageUpdate({ applicantStatus: "rejected" }, "withdrawn", "candidate", "cOldRej");
    await assertFails(updateDoc(doc(as("cOldRej"), "jobApplications", "live_cOldRej"), r));
  });
});

describe("employer updates", () => {
  it("the poster can move through employer stages with a timeline entry", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "jobApplications", "live_e1"), newApp("live", "e1")));
    const viewed = stageUpdate({ stageHistory: [{ stage: "submitted" }] }, "app_viewed", "employer", "emp");
    await assertSucceeds(updateDoc(doc(as("emp"), "jobApplications", "live_e1"), viewed));
    const shortlisted = stageUpdate(viewed, "shortlisted", "employer", "emp", { note: "Good fit" });
    await assertSucceeds(firstShortlist(as("emp"), "live_e1", "live", w(shortlisted), 1)); // L10 slot
    const invited = stageUpdate(shortlisted, "int_invited", "employer", "emp", { interview: { date: "2026-11-25", time: "11:00", mode: "In person", where: "Shop 4", instructions: "" } });
    await assertSucceeds(updateDoc(doc(as("emp"), "jobApplications", "live_e1"), invited));
  });

  it("an employer can't set candidate-only stages, touch contact details, or skip the timeline", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "jobApplications", "live_e2"), newApp("live", "e2")));
    await assertFails(updateDoc(doc(as("emp"), "jobApplications", "live_e2"), stageUpdate({ stageHistory: [{ stage: "submitted" }] }, "offer_accepted", "employer", "emp")));
    await assertFails(updateDoc(doc(as("emp"), "jobApplications", "live_e2"), { applicantPhone: "0000" }));
    await assertFails(updateDoc(doc(as("emp"), "jobApplications", "live_e2"), { stage: "shortlisted" }));
    await assertFails(updateDoc(doc(as("emp"), "jobApplications", "live_e2"), { currentPay: "x" }));
  });

  it("older My Jobs builds changing only applicantStatus may reject, but not shortlist (L8: unlock must be recorded)", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "jobApplications", "live_e3"), { jobId: "live", applicantUid: "e3", applicantStatus: "new" }));
    await assertFails(updateDoc(doc(as("emp"), "jobApplications", "live_e3"), { applicantStatus: "shortlisted" }));
    await assertFails(updateDoc(doc(as("emp"), "jobApplications", "live_e3"), { applicantStatus: "hired" }));
    await assertSucceeds(updateDoc(doc(as("emp"), "jobApplications", "live_e3"), { applicantStatus: "rejected" }));
  });

  it("nothing after an application is closed; other employers can't touch it", async () => {
    await assertFails(updateDoc(doc(as("emp"), "jobApplications", "live_cDone"), stageUpdate({ stageHistory: [{}, {}] }, "review", "employer", "emp")));
    await assertFails(updateDoc(doc(as("emp2"), "jobApplications", "live_cInv"), stageUpdate({ stageHistory: [{}, {}] }, "review", "employer", "emp2")));
  });
});

describe("candidate job profiles", () => {
  it("the owner writes both docs; the shareable doc refuses private fields", async () => {
    const { pub, priv } = splitProfile(profile());
    await assertSucceeds(setDoc(doc(as("p1"), "jobProfiles", "p1"), pub));
    await assertSucceeds(setDoc(doc(as("p1"), "jobProfilesPrivate", "p1"), priv));
    for (const k of ["phone", "email", "currentPay", "expectedPay", "cv"]) {
      await assertFails(setDoc(doc(as("p1"), "jobProfiles", "p1"), { ...pub, [k]: "leak" }));
    }
    await assertFails(setDoc(doc(as("p1"), "jobProfiles", "p1"), { ...pub, lane: "wizard" }));
  });

  it("nobody else can write someone's profile", async () => {
    const { pub, priv } = splitProfile(profile());
    await assertFails(setDoc(doc(as("p2"), "jobProfiles", "p1"), pub));
    await assertFails(setDoc(doc(as("p2"), "jobProfilesPrivate", "p1"), priv));
  });

  it("the private doc is readable by the owner and (since TIN Jobs Admin) the super admin — never employers", async () => {
    await assertSucceeds(getDoc(doc(as("p1"), "jobProfilesPrivate", "p1")));
    await assertFails(getDoc(doc(as("emp"), "jobProfilesPrivate", "p1")));
    await assertSucceeds(getDoc(doc(as("adm", ADMIN_EMAIL), "jobProfilesPrivate", "p1")));
  });

  it("the shareable doc: readable by signed-in users unless 'not discoverable'", async () => {
    await assertSucceeds(getDoc(doc(as("emp"), "jobProfiles", "p1")));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "jobProfiles", "p1")));
    await assertSucceeds(updateDoc(doc(as("p1"), "jobProfiles", "p1"), { visibility: "not_discoverable" }));
    await assertFails(getDoc(doc(as("emp"), "jobProfiles", "p1")));
    await assertSucceeds(getDoc(doc(as("p1"), "jobProfiles", "p1")));
    await assertSucceeds(updateDoc(doc(as("p1"), "jobProfiles", "p1"), { visibility: deleteField() }));
  });
});
