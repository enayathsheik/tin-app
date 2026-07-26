// Cross-tenant denial suite for Phase A (tenancy & permission spine).
// Run against the Firestore emulator only — never production:
//   firebase emulators:exec --only firestore "npx vitest run"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "tenancy-rules-test";

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

  // Seed two orgs, each with one active owner, plus conversations/messages
  // scoped to each org — written with rules disabled (admin-equivalent).
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "organizations", "org1"), {
      name: "Org1", type: "org", createdBy: "userA", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });
    await setDoc(doc(db, "organizations", "org2"), {
      name: "Org2", type: "org", createdBy: "userB", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });

    await setDoc(doc(db, "memberships", "org1_userA"), {
      orgId: "org1", uid: "userA", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });
    await setDoc(doc(db, "memberships", "org2_userB"), {
      orgId: "org2", uid: "userB", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });

    // Org2 conversation + message — not accessible to A under any assertion.
    await setDoc(doc(db, "conversations", "convOrg2"), {
      orgId: "org2", scope: "org", participantUids: ["userB"],
      createdBy: "userB", createdAt: new Date(), lastMessageAt: new Date(),
    });
    await setDoc(doc(db, "messages", "msgOrg2"), {
      conversationId: "convOrg2", senderUid: "userB", senderOrgId: "org2",
      text: "hello from org2", createdAt: new Date(),
    });

    // Org1 personal-scope conversation A is not a participant of.
    await setDoc(doc(db, "conversations", "convOrg1Personal"), {
      orgId: "org1", scope: "personal", participantUids: ["userC"],
      createdBy: "userC", createdAt: new Date(), lastMessageAt: new Date(),
    });

    // Org1 org-scope conversation — any active Org1 member (including A) can read.
    await setDoc(doc(db, "conversations", "convOrg1Org"), {
      orgId: "org1", scope: "org", participantUids: ["userA"],
      createdBy: "userA", createdAt: new Date(), lastMessageAt: new Date(),
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Phase A tenant isolation", () => {
  it("1. A can read Org1's org doc and A's own membership", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "organizations", "org1")));
    await assertSucceeds(getDoc(doc(aliceDb, "memberships", "org1_userA")));
  });

  it("2. A cannot read Org2's org doc (no membership)", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(getDoc(doc(aliceDb, "organizations", "org2")));
  });

  it("3. A cannot read a conversation whose orgId == Org2", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(getDoc(doc(aliceDb, "conversations", "convOrg2")));
  });

  it("4. A cannot read a personal-scope Org1 conversation A is not a participant of", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(getDoc(doc(aliceDb, "conversations", "convOrg1Personal")));
  });

  it("5. A can read an org-scope Org1 conversation as an active member", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "conversations", "convOrg1Org")));
  });

  it("6. A cannot create a membership making themselves owner of an org they did not create", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(setDoc(doc(aliceDb, "memberships", "org2_userA"), {
      orgId: "org2", uid: "userA", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    }));
  });

  it("7. A message with orgId == Org2 is not readable by A", async () => {
    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(getDoc(doc(aliceDb, "messages", "msgOrg2")));
  });
});
