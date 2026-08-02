// Business Objects Phase 1 foundation — permission proof only. Nothing writes
// this collection yet in the app (see docs/BUSINESS_OBJECTS_CONTRACT.md);
// this suite seeds docs directly with security rules disabled and asserts
// only the read/write rule surface. Run against the Firestore emulator only
// — never production:
//   firebase emulators:exec --only firestore "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "business-objects-rules-test";

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

  // Two orgs (A, B), each with one active member, plus a store owned by a
  // third, unrelated contributor — for the storeId-via-contributorId
  // placeholder check. One personal-origin businessObject (owner P,
  // participantUids also carries counterparty Q — populated on the doc for
  // future shared-type reads, even though the ledger_entry read rule doesn't
  // grant access via it) and one org-origin businessObject per org.
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

    await setDoc(doc(db, "memberships", "orgA_userA"), {
      orgId: "orgA", uid: "userA", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });
    await setDoc(doc(db, "memberships", "orgB_userB"), {
      orgId: "orgB", uid: "userB", role: "owner", teamIds: [], status: "active", createdAt: new Date(),
    });

    await setDoc(doc(db, "stores", "storeS"), {
      name: "Store S", contributorId: "userS", createdAt: new Date(),
    });

    // Personal-origin: owner P, counterparty Q (both in scopeTags.participantUids).
    await setDoc(doc(db, "businessObjects", "boPersonal"), {
      type: "ledger_entry", status: "active",
      originConversationId: "personal_P_Q", originMessageId: "msgFake", sourceActionId: "actFake",
      createdBy: "userP", createdAt: new Date(),
      linkedEntities: [],
      scopeTags: { ownerUid: "userP", orgId: null, storeId: null, projectId: null, participantUids: ["userP", "userQ"] },
      payload: { amount: 5000, invoiceNumber: null, dueDate: null, description: "test" },
    });

    // Org-origin: OrgA.
    await setDoc(doc(db, "businessObjects", "boOrgA"), {
      type: "ledger_entry", status: "active",
      originConversationId: "convOrgA", originMessageId: "msgFake", sourceActionId: "actFake",
      createdBy: "userA", createdAt: new Date(),
      linkedEntities: [],
      scopeTags: { ownerUid: null, orgId: "orgA", storeId: null, projectId: null, participantUids: [] },
      payload: { amount: 9000, invoiceNumber: null, dueDate: null, description: "test" },
    });

    // Org-origin: OrgB (cross-scope target).
    await setDoc(doc(db, "businessObjects", "boOrgB"), {
      type: "ledger_entry", status: "active",
      originConversationId: "convOrgB", originMessageId: "msgFake", sourceActionId: "actFake",
      createdBy: "userB", createdAt: new Date(),
      linkedEntities: [],
      scopeTags: { ownerUid: null, orgId: "orgB", storeId: null, projectId: null, participantUids: [] },
      payload: { amount: 3000, invoiceNumber: null, dueDate: null, description: "test" },
    });

    // Future shared-type proof only — NOT a real type in this slice's closed
    // set ('ledger_entry' is the only implemented type, see contract doc).
    // Exists solely to prove the participantUids branch of
    // canReadBusinessObject actually grants read for any type other than
    // 'ledger_entry', since every real seed doc above is a ledger_entry.
    await setDoc(doc(db, "businessObjects", "boFutureShared"), {
      type: "commitment", status: "active",
      originConversationId: "personal_P_Q", originMessageId: "msgFake", sourceActionId: "actFake",
      createdBy: "userP", createdAt: new Date(),
      linkedEntities: [],
      scopeTags: { ownerUid: "userP", orgId: null, storeId: null, projectId: null, participantUids: ["userP", "userQ"] },
      payload: {},
    });

    // Store-linked: owned by userS via stores/storeS.contributorId.
    await setDoc(doc(db, "businessObjects", "boStore"), {
      type: "ledger_entry", status: "active",
      originConversationId: "convStore", originMessageId: "msgFake", sourceActionId: "actFake",
      createdBy: "userS", createdAt: new Date(),
      linkedEntities: [{ kind: "store", id: "storeS" }],
      scopeTags: { ownerUid: null, orgId: null, storeId: "storeS", projectId: null, participantUids: [] },
      payload: { amount: 1000, invoiceNumber: null, dueDate: null, description: "test" },
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Business Objects Phase 1 — permission foundation", () => {
  it("1. personal owner (P) can read their own personal-origin object", async () => {
    const pDb = testEnv.authenticatedContext("userP").firestore();
    await assertSucceeds(getDoc(doc(pDb, "businessObjects", "boPersonal")));
  });

  it("2. DECISION: the other 1:1 participant (Q) is DENIED read on a ledger_entry object despite being in participantUids — a ledger is private books, not shared two-party truth. This is type-specific: participantUids stays on scopeTags for future shared object types (e.g. commitments) where the grant should apply — see canReadBusinessObject's data.type != 'ledger_entry' branch.", async () => {
    const qDb = testEnv.authenticatedContext("userQ").firestore();
    await assertFails(getDoc(doc(qDb, "businessObjects", "boPersonal")));
  });

  it("3. proof the participantUids branch itself works: Q CAN read a non-ledger ('commitment') object via participantUids — confirms test 2's denial is the type gate, not a broken branch", async () => {
    const qDb = testEnv.authenticatedContext("userQ").firestore();
    await assertSucceeds(getDoc(doc(qDb, "businessObjects", "boFutureShared")));
  });

  it("4. a non-participant, non-member (userZ) is denied read on the personal-origin object", async () => {
    const zDb = testEnv.authenticatedContext("userZ").firestore();
    await assertFails(getDoc(doc(zDb, "businessObjects", "boPersonal")));
  });

  it("5. an active OrgA member (userA) can read the OrgA-linked object", async () => {
    const aDb = testEnv.authenticatedContext("userA").firestore();
    await assertSucceeds(getDoc(doc(aDb, "businessObjects", "boOrgA")));
  });

  it("6. a non-member (userZ) is denied read on the OrgA-linked object", async () => {
    const zDb = testEnv.authenticatedContext("userZ").firestore();
    await assertFails(getDoc(doc(zDb, "businessObjects", "boOrgA")));
  });

  it("7. cross-scope: a user linked only to OrgA (userA) cannot read an OrgB object", async () => {
    const aDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(getDoc(doc(aDb, "businessObjects", "boOrgB")));
  });

  it("8. store contributor (userS) can read the store-linked object; a non-contributor cannot", async () => {
    const sDb = testEnv.authenticatedContext("userS").firestore();
    await assertSucceeds(getDoc(doc(sDb, "businessObjects", "boStore")));
    const zDb = testEnv.authenticatedContext("userZ").firestore();
    await assertFails(getDoc(doc(zDb, "businessObjects", "boStore")));
  });

  it("9. client write is denied unconditionally, even for the would-be owner", async () => {
    const pDb = testEnv.authenticatedContext("userP").firestore();
    await assertFails(setDoc(doc(pDb, "businessObjects", "boClientWrite"), {
      type: "ledger_entry", status: "active",
      originConversationId: "x", originMessageId: "x", sourceActionId: "x",
      createdBy: "userP", createdAt: new Date(),
      linkedEntities: [],
      scopeTags: { ownerUid: "userP", orgId: null, storeId: null, projectId: null, participantUids: ["userP"] },
      payload: { amount: 1, invoiceNumber: null, dueDate: null, description: "x" },
    }));
  });

  // Regression guard for the standing rules-bug pattern (see firestore.rules
  // commit 20bf2ef): a get() on a businessObjects doc that was never created
  // must resolve to a clean not-found, not crash rule evaluation by
  // dereferencing resource.data on a null resource.
  it("10. getDoc on a businessObjects doc that has never been created succeeds (not-found, doesn't crash the rule)", async () => {
    const pDb = testEnv.authenticatedContext("userP").firestore();
    const snap = await assertSucceeds(getDoc(doc(pDb, "businessObjects", "neverExisted")));
    if (snap.exists()) throw new Error("expected the doc to not exist");
  });
});
