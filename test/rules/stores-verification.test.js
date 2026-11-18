// stores/{storeId}: only the admin sets a store's verified badge
// (verificationStatus / verifiedAt / verifiedBy). Whoever added a store
// (contributorId) can still edit its normal details, but not its
// verification fields or contributorId. Proves AddPage, admin bulk upload
// and the Admin panel's verify / reject keep working.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDoc } from "firebase/firestore";

const PROJECT_ID = "stores-verification-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

// The exact shape AddPage.jsx writes for a new store.
const addPageStore = (uid, extra = {}) => ({
  storeName: "Sai Tiles & Sanitary", phone: "9800000000", whatsapp: "", instagram: "", facebook: "",
  address: "Station Road", city: "Kalyan", state: "Maharashtra", pincode: "421301", businessType: "Retailer",
  ownerName: "Ramesh", email: "", personalEmail: "", gst: "", brands: "Kajaria", website: "", lat: null, lng: null,
  categories: [], checklist: [], type: "store", contributorId: uid, contributorEmail: "c@example.com",
  verificationStatus: "community_added", gstVerified: false, gstVerifiedData: null, pointsAwarded: 10, confidence: 20,
  createdAt: new Date(), ...extra,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "stores", "champStore"), addPageStore("champ"));
    await setDoc(doc(db, "stores", "verifiedStore"), addPageStore("champ", { verificationStatus: "verified", verifiedAt: new Date(), verifiedBy: "admin" }));
    await setDoc(doc(db, "stores", "legacyNoStatus"), { storeName: "Old Store", city: "Pune", contributorId: "champ" });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("adding a store", () => {
  it("AddPage's exact store (community_added) can be created by any signed-in user", async () => {
    const db = testEnv.authenticatedContext("newChamp").firestore();
    await assertSucceeds(addDoc(collection(db, "stores"), addPageStore("newChamp")));
  });

  it("a store with no verificationStatus can still be created", async () => {
    const db = testEnv.authenticatedContext("newChamp").firestore();
    const noStatus = addPageStore("newChamp");
    delete noStatus.verificationStatus;
    await assertSucceeds(addDoc(collection(db, "stores"), noStatus));
  });

  it("can't create a store that's already verified, or with verifiedAt / verifiedBy", async () => {
    const db = testEnv.authenticatedContext("newChamp").firestore();
    await assertFails(addDoc(collection(db, "stores"), addPageStore("newChamp", { verificationStatus: "verified" })));
    await assertFails(addDoc(collection(db, "stores"), addPageStore("newChamp", { verificationStatus: "pending_verification" })));
    await assertFails(addDoc(collection(db, "stores"), addPageStore("newChamp", { verifiedAt: new Date() })));
    await assertFails(addDoc(collection(db, "stores"), addPageStore("newChamp", { verifiedBy: "admin" })));
  });

  it("guests can't add stores (unchanged)", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(db, "stores"), addPageStore("anon")));
  });
});

describe("whoever added a store", () => {
  it("can still edit its normal details", async () => {
    const db = testEnv.authenticatedContext("champ").firestore();
    await assertSucceeds(updateDoc(doc(db, "stores", "champStore"), { storeName: "Sai Tiles & Bath", phone: "9811111111", brands: "Kajaria, Somany" }));
    await assertSucceeds(updateDoc(doc(db, "stores", "verifiedStore"), { address: "New address" })); // editing a verified store keeps its badge
    await assertSucceeds(updateDoc(doc(db, "stores", "legacyNoStatus"), { city: "Thane" }));
  });

  it("can't set or change the verified badge", async () => {
    const db = testEnv.authenticatedContext("champ").firestore();
    await assertFails(updateDoc(doc(db, "stores", "champStore"), { verificationStatus: "verified" }));
    await assertFails(updateDoc(doc(db, "stores", "champStore"), { verifiedAt: new Date(), verifiedBy: "admin" }));
    await assertFails(updateDoc(doc(db, "stores", "legacyNoStatus"), { verificationStatus: "verified" }));
    await assertFails(updateDoc(doc(db, "stores", "verifiedStore"), { verificationStatus: "community_added" }));
  });

  it("can't hand the store to another account (contributorId)", async () => {
    const db = testEnv.authenticatedContext("champ").firestore();
    await assertFails(updateDoc(doc(db, "stores", "champStore"), { contributorId: "someoneElse" }));
  });

  it("can't delete it (unchanged: admin only)", async () => {
    const db = testEnv.authenticatedContext("champ").firestore();
    await assertFails(deleteDoc(doc(db, "stores", "champStore")));
  });
});

describe("everyone else", () => {
  it("other signed-in users can't edit someone else's store", async () => {
    const db = testEnv.authenticatedContext("mallory").firestore();
    await assertFails(updateDoc(doc(db, "stores", "champStore"), { storeName: "Hijacked" }));
    await assertFails(updateDoc(doc(db, "stores", "champStore"), { verificationStatus: "verified" }));
  });

  it("anyone can still read stores (unchanged)", async () => {
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "stores", "champStore")));
  });
});

describe("admin", () => {
  const admin = () => testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();

  it("Admin panel verify sets verificationStatus + verifiedAt + verifiedBy", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "stores", "champStore"), { verificationStatus: "verified", verifiedAt: new Date(), verifiedBy: "admin" }));
  });

  it("Admin panel reject sets verificationStatus", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "stores", "champStore"), { verificationStatus: "rejected" }));
  });

  it("admin bulk upload (community_added) and admin create of a verified store both work", async () => {
    await assertSucceeds(addDoc(collection(admin(), "stores"), addPageStore("adminUid")));
    await assertSucceeds(addDoc(collection(admin(), "stores"), addPageStore("adminUid", { verificationStatus: "verified" })));
  });

  it("admin can change contributorId and delete", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "stores", "champStore"), { contributorId: "newOwner" }));
    await assertSucceeds(deleteDoc(doc(admin(), "stores", "legacyNoStatus")));
  });
});
