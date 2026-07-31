// Identity-first personal conversations suite for Phase 1. This is the
// deploy gate for firestore.rules — every assertion below must pass before
// `firebase deploy --only firestore:rules` runs. Run against the Firestore
// emulator only — never production:
//   firebase emulators:exec --only firestore "npx vitest run"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";

const PROJECT_ID = "personal-rules-test";

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

  // Cross-org pair (X in orgX, Y in orgY — no shared org) plus a same-org
  // pair (Z and W, both active in orgZ) for the Step 1 exemption. One
  // pending cross-org personal conversation X->Y (status:'requested') with
  // an X-owned suggestedActions doc tagged to it.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "organizations", "orgX"), {
      name: "OrgX", type: "org", createdBy: "userX", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });
    await setDoc(doc(db, "organizations", "orgY"), {
      name: "OrgY", type: "org", createdBy: "userY", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });
    await setDoc(doc(db, "organizations", "orgZ"), {
      name: "OrgZ", type: "org", createdBy: "userZ", createdAt: new Date(),
      capabilities: { teams: false, roles: false, channels: false, externalCollab: false },
    });

    await setDoc(doc(db, "memberships", "orgX_userX"), {
      orgId: "orgX", uid: "userX", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });
    await setDoc(doc(db, "memberships", "orgY_userY"), {
      orgId: "orgY", uid: "userY", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });
    await setDoc(doc(db, "memberships", "orgZ_userZ"), {
      orgId: "orgZ", uid: "userZ", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });
    await setDoc(doc(db, "memberships", "orgZ_userW"), {
      orgId: "orgZ", uid: "userW", role: "member", teamIds: [], status: "active", createdAt: new Date(),
    });

    // Pending cross-org personal conversation, X (createdBy) -> Y, requested.
    await setDoc(doc(db, "conversations", "personalXY"), {
      context: "personal", type: "direct", scope: "personal", status: "requested",
      orgId: null, sharedOrgId: null,
      participantUids: ["userX", "userY"], participantNames: {},
      linkedEntities: [], createdBy: "userX",
      createdAt: new Date(), lastMessageAt: new Date(),
    });

    // Personal-context suggestedActions in personalXY, owned by X only —
    // Y is a conversation participant but must NOT be able to read this.
    await setDoc(doc(db, "suggestedActions", "suggXOnly"), {
      conversationId: "personalXY", messageId: "msgFake", orgId: null, ownerUid: "userX",
      actionType: "log_ledger_entry", payload: {},
      explanation: { reasoning: "test", evidence: [], confidence: 0.9, recommendedAction: null },
      status: "pending", createdAt: new Date(),
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Phase 1 identity-first personal conversations", () => {
  it("1. A non-participant (userQ) cannot read a personal thread", async () => {
    const qDb = testEnv.authenticatedContext("userQ").firestore();
    await assertFails(getDoc(doc(qDb, "conversations", "personalXY")));
  });

  it("2. Third-party uid injection into participantUids on create is denied", async () => {
    const xDb = testEnv.authenticatedContext("userX").firestore();
    await assertFails(setDoc(doc(xDb, "conversations", "personalXYQ"), {
      context: "personal", type: "direct", scope: "personal", status: "requested",
      orgId: null, sharedOrgId: null,
      participantUids: ["userX", "userY", "userQ"], participantNames: {},
      linkedEntities: [], createdBy: "userX",
      createdAt: new Date(), lastMessageAt: new Date(),
    }));
  });

  it("3. Two-way message write before status=='accepted' is denied for the non-initiator (cross-org pair)", async () => {
    const yDb = testEnv.authenticatedContext("userY").firestore();
    await assertFails(addDoc(collection(yDb, "messages"), {
      conversationId: "personalXY", senderUid: "userY", senderOrgId: null,
      text: "hi from Y before accept", type: "text", attachment: null, createdAt: new Date(),
    }));
  });

  it("4. A personal ownerUid record is unreadable by a non-owner participant; readable by its owner", async () => {
    const yDb = testEnv.authenticatedContext("userY").firestore(); // participant of personalXY, not owner
    await assertFails(getDoc(doc(yDb, "suggestedActions", "suggXOnly")));
    const xDb = testEnv.authenticatedContext("userX").firestore();
    await assertSucceeds(getDoc(doc(xDb, "suggestedActions", "suggXOnly")));
  });

  it("5. Step 1 exemption: a same-org pair (Z, W) can open a personal conversation directly 'accepted' and message immediately", async () => {
    const zDb = testEnv.authenticatedContext("userZ").firestore();
    await assertSucceeds(setDoc(doc(zDb, "conversations", "personalZW"), {
      context: "personal", type: "direct", scope: "personal", status: "accepted",
      orgId: null, sharedOrgId: "orgZ",
      participantUids: ["userW", "userZ"], participantNames: {},
      linkedEntities: [], createdBy: "userZ",
      createdAt: new Date(), lastMessageAt: new Date(),
    }));
    const wDb = testEnv.authenticatedContext("userW").firestore();
    await assertSucceeds(addDoc(collection(wDb, "messages"), {
      conversationId: "personalZW", senderUid: "userW", senderOrgId: null,
      text: "hi from W, no accept needed", type: "text", attachment: null, createdAt: new Date(),
    }));
  });

  it("6. (bonus) The same-org exemption cannot be forged with a fabricated sharedOrgId Y isn't actually a member of", async () => {
    const xDb = testEnv.authenticatedContext("userX").firestore();
    await assertFails(setDoc(doc(xDb, "conversations", "personalXYForged"), {
      context: "personal", type: "direct", scope: "personal", status: "accepted",
      orgId: null, sharedOrgId: "orgX", // X is really a member of orgX, but Y is not
      participantUids: ["userX", "userY"], participantNames: {},
      linkedEntities: [], createdBy: "userX",
      createdAt: new Date(), lastMessageAt: new Date(),
    }));
  });

  // Regression: getOrCreatePersonalConversation's existence check (getDoc on
  // a not-yet-created personal_{sorted uid pair} doc) — the most common
  // real-world trigger, literally the first-ever contact between any two
  // users. Firestore evaluates security rules on reads of NON-existent
  // documents too; a rule that dereferences resource.data unconditionally
  // throws (resource is null), which surfaced to real users as "Missing or
  // insufficient permissions" starting any brand-new chat.
  it("7. getDoc on a personal conversation that has never been created succeeds (returns not-found, doesn't crash the rule)", async () => {
    const xDb = testEnv.authenticatedContext("userX").firestore();
    const snap = await assertSucceeds(getDoc(doc(xDb, "conversations", "personal_neverExisted")));
    if (snap.exists()) throw new Error("expected the doc to not exist");
  });
});
