// Jobs redesign phase 5a — Employer Desk rules: pause, bulk stage updates,
// closing a vacancy (batched), and candidate ↔ employer conversations that
// open without the request step only when backed by a real application.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, setDoc, updateDoc, writeBatch, addDoc } from "firebase/firestore";
import { stageUpdate } from "../../src/utils/applications.js";

const PROJECT_ID = "employer-desk-test";
let testEnv;

const job = (poster, extra = {}) => ({ postedByUid: poster, jobTitle: "Masons", status: "approved", jobStatus: "live", createdAt: new Date(), ...extra });
const appDoc = (jobId, uid, stage = "submitted", extra = {}) => ({
  jobId, applicantUid: uid, applicantName: uid, applicantPhone: "98",
  stage, stageHistory: stage === "submitted" ? [{ stage: "submitted" }] : [{ stage: "submitted" }, { stage }],
  applicantStatus: "new", createdAt: new Date(), ...extra,
});
const conv = (a, b, createdBy, extra = {}) => ({
  context: "personal", type: "direct", scope: "personal", status: "accepted", orgId: null, sharedOrgId: null,
  participantUids: [a, b].sort(), participantNames: {}, linkedEntities: [], createdBy, createdAt: new Date(), lastMessageAt: new Date(), ...extra,
});
const pairId = (a, b) => `personal_${[a, b].sort().join("_")}`;
const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const seed = (fn) => testEnv.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const peek = async (path) => { let data; await testEnv.withSecurityRulesDisabled(async (c) => { data = (await getDoc(doc(c.firestore(), ...path.split("/")))).data(); }); return data; };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await seed(async (db) => {
    await setDoc(doc(db, "jobListings", "j1"), job("emp"));
    await setDoc(doc(db, "jobListings", "j2"), job("emp2"));
    await setDoc(doc(db, "jobListings", "jPause"), job("emp"));
    await setDoc(doc(db, "jobApplications", "j1_cand"), appDoc("j1", "cand"));
    await setDoc(doc(db, "jobApplications", "j1_gone"), appDoc("j1", "gone", "withdrawn"));
    await setDoc(doc(db, "jobApplications", "j1_old"), { jobId: "j1", applicantUid: "old", applicantStatus: "new" }); // pre-phase-4 shape
    await setDoc(doc(db, "jobApplications", "j2_cand2"), appDoc("j2", "cand2"));
  });
});

afterAll(async () => { await testEnv.cleanup(); });

describe("pause (jobStatus 'paused')", () => {
  it("the poster can pause and reopen; others can't", async () => {
    await assertSucceeds(updateDoc(doc(as("emp"), "jobListings", "jPause"), { jobStatus: "paused", updatedAt: new Date() }));
    await assertFails(updateDoc(doc(as("emp2"), "jobListings", "jPause"), { jobStatus: "live", updatedAt: new Date() }));
    await assertSucceeds(updateDoc(doc(as("emp"), "jobListings", "jPause"), { jobStatus: "live", updatedAt: new Date() }));
  });

  it("unknown statuses are still refused", async () => {
    await assertFails(updateDoc(doc(as("emp"), "jobListings", "jPause"), { jobStatus: "draft" }));
    await assertFails(updateDoc(doc(as("emp"), "jobListings", "jPause"), { jobStatus: "archived" }));
  });

  it("a paused job takes no applications, but its poster still sees it", async () => {
    await seed(db => setDoc(doc(db, "jobListings", "jP2"), job("emp", { jobStatus: "paused" })));
    await assertFails(setDoc(doc(as("c9"), "jobApplications", "jP2_c9"), appDoc("jP2", "c9")));
    await assertSucceeds(getDoc(doc(as("emp"), "jobListings", "jP2")));
  });
});

describe("bulk stage updates (one batch)", () => {
  const seedApps = (jobId, specs) => seed(async (db) => {
    for (const [uid, stage] of specs) await setDoc(doc(db, "jobApplications", `${jobId}_${uid}`), appDoc(jobId, uid, stage));
  });
  const batchMove = (uid, jobId, specs, to, note = "Thank you for applying.") => {
    const db = as(uid);
    const b = writeBatch(db);
    for (const [cand, stage] of specs) {
      const a = { stageHistory: stage === "submitted" ? [{ stage: "submitted" }] : [{ stage: "submitted" }, { stage }] };
      b.update(doc(db, "jobApplications", `${jobId}_${cand}`), { ...stageUpdate(a, to, "employer", uid, { note }), updatedAt: new Date() });
    }
    return b.commit();
  };

  it("the poster can move several open applications at once", async () => {
    const specs = [["b1", "submitted"], ["b2", "app_viewed"], ["b3", "review"]];
    await seedApps("j1", specs);
    await assertSucceeds(batchMove("emp", "j1", specs, "not_shortlisted"));
  });

  it("a batch that includes a closed application changes nothing", async () => {
    const specs = [["b4", "submitted"], ["b5", "not_selected"]];
    await seedApps("j1", specs);
    await assertFails(batchMove("emp", "j1", specs, "shortlisted"));
    const after = await peek("jobApplications/j1_b4");
    expect(after.stage).toBe("submitted");
  });

  it("candidate-only stages and other employers are refused", async () => {
    const specs = [["b6", "submitted"]];
    await seedApps("j1", specs);
    await assertFails(batchMove("emp", "j1", specs, "offer_accepted"));
    await assertFails(batchMove("emp", "j1", specs, "withdrawn"));
    await assertFails(batchMove("emp2", "j1", specs, "review"));
  });
});

describe("closing a vacancy (job + applications in one batch)", () => {
  it("closes the job and 30 open applications together", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "jobListings", "jClose"), job("emp"));
      for (let i = 0; i < 30; i++) await setDoc(doc(db, "jobApplications", `jClose_k${i}`), appDoc("jClose", `k${i}`, i % 2 ? "app_viewed" : "submitted"));
    });
    const db = as("emp");
    const b = writeBatch(db);
    for (let i = 0; i < 30; i++) {
      const a = { stageHistory: i % 2 ? [{ stage: "submitted" }, { stage: "app_viewed" }] : [{ stage: "submitted" }] };
      b.update(doc(db, "jobApplications", `jClose_k${i}`), { ...stageUpdate(a, "closed", "employer", "emp", { note: "This position is now closed." }), updatedAt: new Date() });
    }
    b.update(doc(db, "jobListings", "jClose"), { jobStatus: "filled", updatedAt: new Date() });
    await assertSucceeds(b.commit());
    const j = await peek("jobListings/jClose");
    const k = await peek("jobApplications/jClose_k7");
    expect(j.jobStatus).toBe("filled");
    expect(k.stage).toBe("closed");
    expect(k.stageHistory.at(-1).note).toBe("This position is now closed.");
  });

  it("someone else can't close your vacancy", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "jobListings", "jClose2"), job("emp"));
      await setDoc(doc(db, "jobApplications", "jClose2_z"), appDoc("jClose2", "z"));
    });
    const db = as("emp2");
    const b = writeBatch(db);
    b.update(doc(db, "jobApplications", "jClose2_z"), { ...stageUpdate({ stageHistory: [{ stage: "submitted" }] }, "closed", "employer", "emp2"), updatedAt: new Date() });
    b.update(doc(db, "jobListings", "jClose2"), { jobStatus: "closed", updatedAt: new Date() });
    await assertFails(b.commit());
  });
});

describe("conversations backed by an application (no request step)", () => {
  it("the employer can open an accepted chat with an applicant", async () => {
    await assertSucceeds(setDoc(doc(as("emp"), "conversations", pairId("emp", "cand")), conv("emp", "cand", "emp", { viaApplication: "j1_cand" })));
  });

  it("…and then both sides can message", async () => {
    await assertSucceeds(addDoc(collection(as("cand"), "messages"), { conversationId: pairId("emp", "cand"), senderUid: "cand", text: "Hello", type: "text", createdAt: new Date() }));
    await assertSucceeds(addDoc(collection(as("emp"), "messages"), { conversationId: pairId("emp", "cand"), senderUid: "emp", text: "Please send a photo of your work", type: "text", createdAt: new Date() }));
  });

  it("the candidate can open it too (Message employer)", async () => {
    await assertSucceeds(setDoc(doc(as("cand2"), "conversations", pairId("emp2", "cand2")), conv("emp2", "cand2", "cand2", { viaApplication: "j2_cand2" })));
  });

  it("an old application (no stage field) also counts", async () => {
    await assertSucceeds(setDoc(doc(as("emp"), "conversations", pairId("emp", "old")), conv("emp", "old", "emp", { viaApplication: "j1_old" })));
  });

  it("refused without an application, with a withdrawn one, or a missing one", async () => {
    await assertFails(setDoc(doc(as("emp"), "conversations", pairId("emp", "x1")), conv("emp", "x1", "emp")));
    await assertFails(setDoc(doc(as("emp"), "conversations", pairId("emp", "gone")), conv("emp", "gone", "emp", { viaApplication: "j1_gone" })));
    await assertFails(setDoc(doc(as("emp"), "conversations", pairId("emp", "x2")), conv("emp", "x2", "emp", { viaApplication: "j1_x2" })));
  });

  it("someone else's application can't be borrowed", async () => {
    // A stranger claims cand's application to reach cand.
    await assertFails(setDoc(doc(as("stranger"), "conversations", pairId("stranger", "cand")), conv("stranger", "cand", "stranger", { viaApplication: "j1_cand" })));
    // Another employer claims an application to a job that isn't theirs.
    await assertFails(setDoc(doc(as("emp2"), "conversations", pairId("emp2", "cand")), conv("emp2", "cand", "emp2", { viaApplication: "j1_cand" })));
    // The applicant points at the wrong employer.
    await assertFails(setDoc(doc(as("cand"), "conversations", pairId("cand", "emp2")), conv("cand", "emp2", "cand", { viaApplication: "j1_cand" })));
  });

  it("strangers still go through the request step", async () => {
    await assertSucceeds(setDoc(doc(as("s1"), "conversations", pairId("s1", "s2")), conv("s1", "s2", "s1", { status: "requested" })));
    await assertFails(setDoc(doc(as("s3"), "conversations", pairId("s3", "s4")), conv("s3", "s4", "s3")));
  });

  it("an earlier 'requested' thread opens up once there's an application — from either side", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "jobApplications", "j1_r1"), appDoc("j1", "r1"));
      await setDoc(doc(db, "jobApplications", "j1_r2"), appDoc("j1", "r2"));
      await setDoc(doc(db, "conversations", pairId("emp", "r1")), conv("emp", "r1", "emp", { status: "requested" }));
      await setDoc(doc(db, "conversations", pairId("emp", "r2")), conv("emp", "r2", "r2", { status: "requested" }));
    });
    // The initiator (emp) can't self-accept…
    await assertFails(updateDoc(doc(as("emp"), "conversations", pairId("emp", "r1")), { status: "accepted" }));
    // …but can with the application as proof.
    await assertSucceeds(updateDoc(doc(as("emp"), "conversations", pairId("emp", "r1")), { status: "accepted", viaApplication: "j1_r1" }));
    await assertSucceeds(updateDoc(doc(as("r2"), "conversations", pairId("emp", "r2")), { status: "accepted", viaApplication: "j1_r2" }));
  });

  it("…but not with a bogus or unrelated application", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "conversations", pairId("emp", "r3")), conv("emp", "r3", "emp", { status: "requested" }));
    });
    await assertFails(updateDoc(doc(as("emp"), "conversations", pairId("emp", "r3")), { status: "accepted", viaApplication: "j1_cand" }));
    await assertFails(updateDoc(doc(as("emp"), "conversations", pairId("emp", "r3")), { status: "accepted", viaApplication: "nope" }));
    await assertFails(updateDoc(doc(as("emp"), "conversations", pairId("emp", "r3")), { status: "accepted", viaApplication: "j1_r1", participantUids: ["emp", "r1"] }));
  });
});
