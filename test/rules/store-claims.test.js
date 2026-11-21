// L2b "Find your business": claims/{id} and the store claim fields.
//  - A signed-in user claims a store for their OWN account only, with a
//    confirmed 10-digit mobile; GST optional; status must start "pending".
//  - The claimant can read their own claims; nobody else (but the admin).
//  - Only the admin approves: claim → approved, store → claimedByUid +
//    contributorId, users/{uid}.storeId. Approval does not verify the account.
//  - After approval the new owner edits the store's details, never its claim
//    or verification fields.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, limit,
} from "firebase/firestore";

const PROJECT_ID = "store-claims-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

const importedStore = (extra = {}) => ({
  storeName: "Sai Tiles & Sanitary", city: "Kalyan", phone: "9800000000", businessType: "Retailer",
  verificationStatus: "community_added", source: "bulk_upload", contributorId: "adminUid",
  createdAt: new Date(), ...extra,
});

// Same shape as src/utils/storeClaim.js buildClaimDoc + createdAt.
const claimDoc = (uid, storeId, extra = {}) => ({
  claimantUid: uid, storeId, storeName: "Sai Tiles & Sanitary", storeCity: "Kalyan",
  name: "Ramesh", phone: "9876543210", phoneConfirmed: true, gst: null, email: "r@example.com",
  status: "pending", createdAt: serverTimestamp(), ...extra,
});

const asUser = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const asAdmin = () => testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "stores", "s1"), importedStore());
    await setDoc(doc(db, "stores", "s2"), importedStore({ storeName: "Sai Ceramics", city: "kalyan" }));
    await setDoc(doc(db, "stores", "taken"), importedStore({ claimedByUid: "someoneElse" }));
    await setDoc(doc(db, "users", "owner"), { name: "Ramesh", role: "consumer", verificationStatus: "pending" });
    await setDoc(doc(db, "users", "other"), { name: "Other", role: "consumer" });
    await setDoc(doc(db, "claims", "c-owner"), { ...claimDoc("owner", "s1"), createdAt: new Date() });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("searching stores (Find your business)", () => {
  it("anyone can run the name-prefix-in-city search, hidden imported stores included", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const snap = await assertSucceeds(getDocs(query(collection(db, "stores"),
      where("city", "in", ["Kalyan", "kalyan", "KALYAN"]),
      where("storeName", ">=", "Sai"), where("storeName", "<=", "Sai"),
      orderBy("storeName"), limit(20))));
    expect(snap.size).toBe(3);
  });
});

describe("creating a claim", () => {
  it("a signed-in user can claim a store for their own account (no GST)", async () => {
    await assertSucceeds(addDoc(collection(asUser("owner"), "claims"), claimDoc("owner", "s2")));
  });

  it("GST is optional but, when given, is a 15-character string", async () => {
    await assertSucceeds(addDoc(collection(asUser("owner"), "claims"), claimDoc("owner", "s2", { gst: "27ABCDE1234F1Z5" })));
    await assertFails(addDoc(collection(asUser("owner"), "claims"), claimDoc("owner", "s2", { gst: "123" })));
  });

  it("can't claim on behalf of another account", async () => {
    await assertFails(addDoc(collection(asUser("owner"), "claims"), claimDoc("other", "s2")));
  });

  it("guests can't claim", async () => {
    await assertFails(addDoc(collection(testEnv.unauthenticatedContext().firestore(), "claims"), claimDoc("owner", "s2")));
  });

  it("needs a valid 10-digit mobile that the claimant confirmed", async () => {
    const db = asUser("owner");
    await assertFails(addDoc(collection(db, "claims"), claimDoc("owner", "s2", { phone: "12345" })));
    await assertFails(addDoc(collection(db, "claims"), claimDoc("owner", "s2", { phone: "1876543210" })));
    await assertFails(addDoc(collection(db, "claims"), claimDoc("owner", "s2", { phoneConfirmed: false })));
    const noPhone = claimDoc("owner", "s2"); delete noPhone.phone;
    await assertFails(addDoc(collection(db, "claims"), noPhone));
  });

  it("must start pending, with no extra fields, a real store and a server timestamp", async () => {
    const db = asUser("owner");
    await assertFails(addDoc(collection(db, "claims"), claimDoc("owner", "s2", { status: "approved" })));
    await assertFails(addDoc(collection(db, "claims"), claimDoc("owner", "s2", { reviewedBy: "me" })));
    await assertFails(addDoc(collection(db, "claims"), claimDoc("owner", "noSuchStore")));
    await assertFails(addDoc(collection(db, "claims"), claimDoc("owner", "s2", { createdAt: new Date(2020, 0, 1) })));
  });

  it("can't claim a store that's already claimed", async () => {
    await assertFails(addDoc(collection(asUser("owner"), "claims"), claimDoc("owner", "taken")));
  });
});

describe("reading claims", () => {
  it("the claimant reads their own claim and lists their own claims", async () => {
    const db = asUser("owner");
    await assertSucceeds(getDoc(doc(db, "claims", "c-owner")));
    await assertSucceeds(getDocs(query(collection(db, "claims"), where("claimantUid", "==", "owner"))));
  });

  it("another user can't read it or list all claims", async () => {
    const db = asUser("other");
    await assertFails(getDoc(doc(db, "claims", "c-owner")));
    await assertFails(getDocs(collection(db, "claims")));
    await assertFails(getDocs(query(collection(db, "claims"), where("claimantUid", "==", "owner"))));
  });

  it("the admin lists pending claims", async () => {
    await assertSucceeds(getDocs(query(collection(asAdmin(), "claims"), where("status", "==", "pending"))));
  });
});

describe("approving a claim", () => {
  const approveBatch = (db) => {
    const batch = writeBatch(db);
    batch.update(doc(db, "claims", "c-owner"), { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "adminUid" });
    batch.update(doc(db, "stores", "s1"), {
      claimedByUid: "owner", claimedAt: serverTimestamp(), claimId: "c-owner",
      contributorId: "owner", previousContributorId: "adminUid",
    });
    batch.set(doc(db, "users", "owner"), { storeId: "s1" }, { merge: true });
    return batch.commit();
  };

  it("the claimant can't approve their own claim or link the store themselves", async () => {
    const db = asUser("owner");
    await assertFails(updateDoc(doc(db, "claims", "c-owner"), { status: "approved" }));
    await assertFails(updateDoc(doc(db, "users", "owner"), { storeId: "s1" }));
    await assertFails(approveBatch(db));
  });

  it("the admin approves in one batch; the account stays unverified", async () => {
    await assertSucceeds(approveBatch(asAdmin()));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const user = (await getDoc(doc(db, "users", "owner"))).data();
      expect(user.storeId).toBe("s1");
      expect(user.verificationStatus).toBe("pending");
      const store = (await getDoc(doc(db, "stores", "s1"))).data();
      expect(store.claimedByUid).toBe("owner");
      expect(store.contributorId).toBe("owner");
    });
  });

  it("after approval the owner edits the store's details but not its claim or verification fields", async () => {
    await approveBatch(asAdmin());
    const db = asUser("owner");
    await assertSucceeds(updateDoc(doc(db, "stores", "s1"), { storeName: "Sai Tiles", about: "Since 1998", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "stores", "s1"), { claimedByUid: "other" }));
    await assertFails(updateDoc(doc(db, "stores", "s1"), { previousContributorId: null }));
    await assertFails(updateDoc(doc(db, "stores", "s1"), { verificationStatus: "verified" }));
    await assertFails(updateDoc(doc(asUser("other"), "stores", "s1"), { storeName: "Hijack" }));
  });

  it("nobody but the admin can mark a store claimed — not on create, not on update", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "stores", "mine"), importedStore({ contributorId: "other", source: "manual" }));
    });
    const db = asUser("other");
    await assertFails(updateDoc(doc(db, "stores", "mine"), { claimedByUid: "other" }));
    await assertFails(addDoc(collection(db, "stores"), importedStore({ contributorId: "other", claimedByUid: "other", source: "manual" })));
  });

  it("the admin can reject; the claimant can't delete or edit a claim", async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), "claims", "c-owner"), { status: "rejected", reviewedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(asUser("owner"), "claims", "c-owner"), { status: "pending" }));
  });
});
