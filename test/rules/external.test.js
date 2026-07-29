// Cross-company external-participant isolation suite for Phase D. This is
// the deploy gate for firestore.rules — every assertion below must pass
// before `firebase deploy --only firestore:rules` runs. Run against the
// Firestore emulator only — never production:
//   firebase emulators:exec --only firestore "npx vitest run"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, arrayUnion } from "firebase/firestore";

const PROJECT_ID = "external-rules-test";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  // Seed Org A (userA), Org B (userB), Org C (userC); one scope:"external"
  // conversation shared between A and B; one internal Org A conversation B
  // must never see; one Org-A-owned ledgerEntries doc and one Org-A-owned
  // suggestedActions doc, both tagged to the shared external thread.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "organizations", "orgA"), {
      name: "OrgA", type: "org", createdBy: "userA", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });
    await setDoc(doc(db, "organizations", "orgB"), {
      name: "OrgB", type: "org", createdBy: "userB", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });
    await setDoc(doc(db, "organizations", "orgC"), {
      name: "OrgC", type: "org", createdBy: "userC", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });

    await setDoc(doc(db, "memberships", "orgA_userA"), {
      orgId: "orgA", uid: "userA", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });
    await setDoc(doc(db, "memberships", "orgB_userB"), {
      orgId: "orgB", uid: "userB", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });
    await setDoc(doc(db, "memberships", "orgC_userC"), {
      orgId: "orgC", uid: "userC", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });

    // Shared external conversation between A and B.
    await setDoc(doc(db, "conversations", "extAB"), {
      type: "direct", scope: "external",
      participantUids: ["userA", "userB"],
      participantOrgIds: ["orgA", "orgB"],
      orgId: "orgA", createdBy: "userA",
      createdAt: new Date(), lastMessageAt: new Date(), linkedEntities: [],
    });

    // Org A's separate internal conversation — B must never reach this.
    await setDoc(doc(db, "conversations", "convOrgAInternal"), {
      orgId: "orgA", scope: "org", participantUids: ["userA"],
      createdBy: "userA", createdAt: new Date(), lastMessageAt: new Date(),
    });

    // Org-A-owned confirmed ledger entry tagged to the shared external thread.
    await setDoc(doc(db, "ledgerEntries", "ledgerA1"), {
      conversationId: "extAB", orgId: "orgA", amount: 5000, description: "test entry",
      createdBy: "userA", createdAt: new Date(), sourceActionId: "actionA1",
    });

    // Org-A-owned suggestion chip in the shared thread.
    await setDoc(doc(db, "suggestedActions", "actionA1"), {
      conversationId: "extAB", messageId: "msgA1", orgId: "orgA",
      actionType: "log_ledger_entry", payload: { amount: 5000 },
      explanation: { reasoning: "test", evidence: [], confidence: 0.9, recommendedAction: null },
      status: "pending", createdAt: new Date(),
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Phase D external-participant isolation", () => {
  it("1. A and B can each read the shared external conversation", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    const bobDb = testEnv.authenticatedContext("userB").firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "conversations", "extAB")));
    await assertSucceeds(getDoc(doc(bobDb, "conversations", "extAB")));
  });

  it("2. A and B can each create a message in the shared external conversation with their own senderOrgId", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    const bobDb = testEnv.authenticatedContext("userB").firestore();
    await assertSucceeds(addDoc(collection(aliceDb, "messages"), {
      conversationId: "extAB", senderUid: "userA", senderOrgId: "orgA",
      text: "hello from A", type: "text", attachment: null, createdAt: new Date(),
    }));
    await assertSucceeds(addDoc(collection(bobDb, "messages"), {
      conversationId: "extAB", senderUid: "userB", senderOrgId: "orgB",
      text: "hello from B", type: "text", attachment: null, createdAt: new Date(),
    }));
  });

  it("3. B cannot read Org A's separate internal conversation", async () => {
    const bobDb = testEnv.authenticatedContext("userB").firestore();
    await assertFails(getDoc(doc(bobDb, "conversations", "convOrgAInternal")));
  });

  it("4. B cannot read the Org-A-owned ledgerEntries record in the shared thread", async () => {
    const bobDb = testEnv.authenticatedContext("userB").firestore();
    await assertFails(getDoc(doc(bobDb, "ledgerEntries", "ledgerA1")));
  });

  it("5. A can read that same Org-A-owned ledgerEntries record", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "ledgerEntries", "ledgerA1")));
  });

  it("6. B cannot read a suggestedActions doc with orgId == orgA in the shared thread; A can", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    const bobDb = testEnv.authenticatedContext("userB").firestore();
    await assertFails(getDoc(doc(bobDb, "suggestedActions", "actionA1")));
    await assertSucceeds(getDoc(doc(aliceDb, "suggestedActions", "actionA1")));
  });

  it("7. C (non-participant) can neither read nor send in the A-B external conversation", async () => {
    const carolDb = testEnv.authenticatedContext("userC").firestore();
    await assertFails(getDoc(doc(carolDb, "conversations", "extAB")));
    await assertFails(addDoc(collection(carolDb, "messages"), {
      conversationId: "extAB", senderUid: "userC", senderOrgId: "orgC",
      text: "intruder", type: "text", attachment: null, createdAt: new Date(),
    }));
  });

  it("8. A client attempt to directly create a scope:\"external\" conversation is denied", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(setDoc(doc(aliceDb, "conversations", "extDirectAttempt"), {
      type: "direct", scope: "external",
      participantUids: ["userA", "userC"],
      participantOrgIds: ["orgA", "orgC"],
      orgId: "orgA", createdBy: "userA",
      createdAt: new Date(), lastMessageAt: new Date(), linkedEntities: [],
    }));
  });

  it("9. A user cannot update the external conversation to insert their own uid into participantUids", async () => {
    const carolDb = testEnv.authenticatedContext("userC").firestore();
    await assertFails(updateDoc(doc(carolDb, "conversations", "extAB"), {
      participantUids: arrayUnion("userC"),
    }));
  });
});
