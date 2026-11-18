// users/{uid} security fix (Jobs redesign phase 3): a user may still create
// and edit their own profile exactly as the app does (LoginPage sign-up,
// saveUserProfile merges, ProfilePage saves), but may NOT set
// verificationStatus or storeId — only the admin can. Also proves the Admin
// panel's store verify/reject (stores.verificationStatus) and user
// management still work.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";

const PROJECT_ID = "users-security-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

// The exact shape LoginPage.jsx writes for a new account (basicProfile).
const signupProfile = (uid) => ({
  name: "9876543210", email: "x@example.com", phone: "9876543210", workEmail: "x@example.com", personalEmail: "",
  role: "contributor", linkedin: "", company: "", level: "Bronze", validationStatus: "n/a",
  createdAt: new Date().toISOString(), uid,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "alice"), { ...signupProfile("alice"), role: "retailer", verificationStatus: "pending" });
    await setDoc(doc(db, "users", "verifiedBob"), { ...signupProfile("verifiedBob"), role: "retailer", verificationStatus: "verified", storeId: "storeB" });
    await setDoc(doc(db, "stores", "storeA"), { storeName: "A Tiles", contributorId: "champ", verificationStatus: "community_added" });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("sign-up and profile saves still work", () => {
  it("sign-up: creating your own profile with the LoginPage shape succeeds", async () => {
    const db = testEnv.authenticatedContext("newbie").firestore();
    await assertSucceeds(setDoc(doc(db, "users", "newbie"), signupProfile("newbie"), { merge: true }));
  });

  it("sign-up may start as 'pending' or 'unverified', never 'verified'", async () => {
    await assertSucceeds(setDoc(doc(testEnv.authenticatedContext("p1").firestore(), "users", "p1"), { ...signupProfile("p1"), verificationStatus: "pending" }));
    await assertSucceeds(setDoc(doc(testEnv.authenticatedContext("p2").firestore(), "users", "p2"), { ...signupProfile("p2"), verificationStatus: "unverified" }));
    await assertFails(setDoc(doc(testEnv.authenticatedContext("p3").firestore(), "users", "p3"), { ...signupProfile("p3"), verificationStatus: "verified" }));
  });

  it("sign-up can't set a store link", async () => {
    await assertFails(setDoc(doc(testEnv.authenticatedContext("p4").firestore(), "users", "p4"), { ...signupProfile("p4"), storeId: "storeA" }));
  });

  it("profile save (saveUserProfile merge) of ordinary fields succeeds", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(db, "users", "alice"), { name: "Alice P", company: "A Tiles", city: "Pune" }, { merge: true }));
    await assertSucceeds(updateDoc(doc(db, "users", "alice"), { jobBusiness: { name: "A Tiles", industry: "retail_distribution", city: "Pune" } }));
  });

  it("Retailer Dashboard store-profile save (fixed: no verificationStatus) succeeds", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "users", "retailerNoStatus"), { ...signupProfile("retailerNoStatus"), role: "retailer" }));
    const db = testEnv.authenticatedContext("retailerNoStatus").firestore();
    await assertSucceeds(updateDoc(doc(db, "users", "retailerNoStatus"), {
      storeName: "R Store", address: "", city: "Pune", state: "", pincode: "", phone: "98", whatsapp: "", instagram: "", facebook: "",
      website: "", categories: [], brands: "", gst: "", locations: [], customEvents: [],
    }));
  });

  it("an OLDER Retailer Dashboard build that re-saves verificationStatus: 'pending' still works", async () => {
    await testEnv.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "users", "retailerOld"), { ...signupProfile("retailerOld"), role: "retailer" }));
    const db = testEnv.authenticatedContext("retailerOld").firestore();
    await assertSucceeds(updateDoc(doc(db, "users", "retailerOld"), { storeName: "Old build", verificationStatus: "pending", locations: [], customEvents: [] }));
  });

  it("re-saving the whole profile with verificationStatus / storeId UNCHANGED still succeeds", async () => {
    const db = testEnv.authenticatedContext("verifiedBob").firestore();
    const current = (await getDoc(doc(db, "users", "verifiedBob"))).data();
    await assertSucceeds(setDoc(doc(db, "users", "verifiedBob"), { ...current, name: "Bob B" }));
  });
});

describe("users can't grant themselves verification or a store link", () => {
  it("can't set own verificationStatus to verified", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(db, "users", "alice"), { verificationStatus: "verified" }));
    await assertFails(setDoc(doc(db, "users", "alice"), { verificationStatus: "verified" }, { merge: true }));
  });

  it("can't set or change own storeId", async () => {
    await assertFails(updateDoc(doc(testEnv.authenticatedContext("alice").firestore(), "users", "alice"), { storeId: "storeA" }));
    await assertFails(updateDoc(doc(testEnv.authenticatedContext("verifiedBob").firestore(), "users", "verifiedBob"), { storeId: "storeA" }));
  });

  it("can't edit someone else's profile", async () => {
    await assertFails(updateDoc(doc(testEnv.authenticatedContext("alice").firestore(), "users", "verifiedBob"), { name: "x" }));
  });
});

describe("admin still controls verification", () => {
  const admin = () => testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();

  it("admin can set a user's verificationStatus and storeId", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "users", "alice"), { verificationStatus: "verified", storeId: "storeA" }));
    await assertSucceeds(updateDoc(doc(admin(), "users", "alice"), { verificationStatus: "pending" }));
  });

  it("admin user management (role / validationStatus) still works", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "users", "alice"), { role: "retailer", validationStatus: "validated" }));
  });

  it("Admin panel store verify / reject still sets stores.verificationStatus", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "stores", "storeA"), { verificationStatus: "verified", verifiedAt: new Date(), verifiedBy: "admin" }));
    await assertSucceeds(updateDoc(doc(admin(), "stores", "storeA"), { verificationStatus: "rejected" }));
  });
});
