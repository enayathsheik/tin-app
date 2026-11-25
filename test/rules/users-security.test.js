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
import { collection, doc, setDoc, updateDoc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { emptySignup, signupProfile as newAccount } from "../../src/utils/signup.js";

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

describe("B1 sign-up", () => {
  const identity = (kind, uid, extra) => {
    const u = newAccount(kind, { ...emptySignup(kind), name: "A", mobile: "9876500001", password: "secret1", businessName: "A Tiles", industry: "wholesalers", city: "Thane", dealsIn: ["Flooring"], ...extra }, uid, ["Flooring"]);
    for (const k of ["points", "storesAdded", "citiesCovered", "level"]) delete u[k]; // saveUserProfile puts these in stats
    return u;
  };
  // What src/lib/signup.js writes: the account, its stats, its handle + public page.
  it("job seeker and employer accounts can be created, with handle, and saved again on a retry", async () => {
    for (const kind of ["work", "hire"]) {
      const uid = `su_${kind}`, db = testEnv.authenticatedContext(uid, { email: "9876500001@phone.tinit.in" }).firestore();
      for (let i = 0; i < 2; i++) await assertSucceeds(setDoc(doc(db, "users", uid), identity(kind, uid), { merge: true }));
      await assertSucceeds(setDoc(doc(db, "users", uid, "stats", "summary"), { points: 0, level: "Bronze" }, { merge: true }));
      const b = writeBatch(db);
      b.set(doc(db, "handles", `h${kind}`), { uid, createdAt: serverTimestamp() });
      b.set(doc(db, "profiles", uid), { handle: `h${kind}`, role: kind === "hire" ? "employer" : "jobseeker", displayName: "A" }, { merge: true });
      await assertSucceeds(b.commit());
      await assertSucceeds(updateDoc(doc(db, "users", uid), { handle: `h${kind}` }));
    }
  });
  it("the new employer can search candidates straight away; the new job seeker can't", async () => {
    const q = (uid) => getDocs(query(collection(testEnv.authenticatedContext(uid).firestore(), "jobProfiles"), where("searchable", "==", true), orderBy("updatedAt", "desc"), limit(20)));
    await assertSucceeds(q("su_hire"));
    await assertFails(q("su_work"));
  });
  it("a new account is never verified or linked to a store by signing up", async () => {
    const db = testEnv.authenticatedContext("su_x").firestore();
    for (const extra of [{ verificationStatus: "verified" }, { storeId: "storeA" }, { role: "hom_admin" }]) await assertFails(setDoc(doc(db, "users", "su_x"), { ...identity("hire", "su_x"), ...extra }));
  });
});

describe("users can't make themselves an admin (S0)", () => {
  const dbOf = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
  const seed = (uid, data) => testEnv.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "users", uid), data));
  const BAD = ["hom_admin", "admin", "jobs_admin", "HOM_ADMIN", "", null, ["hom_admin"], { a: 1 }];

  it("sign-up with a privileged or made-up role is refused", async () => {
    for (const role of BAD) await assertFails(setDoc(doc(dbOf("r1"), "users", "r1"), { ...signupProfile("r1"), role }));
  });

  it("changing your own role to one is refused (update, merge, or whole-document save)", async () => {
    await seed("r2", signupProfile("r2"));
    for (const role of BAD) {
      await assertFails(updateDoc(doc(dbOf("r2"), "users", "r2"), { role }));
      await assertFails(setDoc(doc(dbOf("r2"), "users", "r2"), { role, name: "x" }, { merge: true }));
      await assertFails(setDoc(doc(dbOf("r2"), "users", "r2"), { ...signupProfile("r2"), role }));
    }
  });

  it("so HOM orders and catalogue stay closed to them", async () => {
    await seed("r2b", signupProfile("r2b"));
    await assertFails(updateDoc(doc(dbOf("r2b"), "users", "r2b"), { role: "hom_admin" }));
    await assertFails(setDoc(doc(dbOf("r2b"), "homVendors", "v1"), { name: "x" }));
  });

  it("every ordinary account type still signs up, and can switch to another", async () => {
    for (const role of ["consumer", "contributor", "retailer", "contractor", "architect", "manufacturer", "jobseeker", "employer"]) {
      await assertSucceeds(setDoc(doc(dbOf(`ok_${role}`), "users", `ok_${role}`), { ...signupProfile(`ok_${role}`), role }));
      await assertSucceeds(updateDoc(doc(dbOf(`ok_${role}`), "users", `ok_${role}`), { role: "employer" }));
    }
  });

  it("a profile with no role yet can be created and saved (Post a Job, handle)", async () => {
    await assertSucceeds(setDoc(doc(dbOf("r3"), "users", "r3"), { jobBusiness: { name: "A" } }, { merge: true }));
    await assertSucceeds(updateDoc(doc(dbOf("r3"), "users", "r3"), { handle: "r3" }));
  });

  it("an account the admin already made hom_admin keeps working, but can't regain it after dropping it", async () => {
    await seed("r4", { ...signupProfile("r4"), role: "hom_admin" });
    await assertSucceeds(updateDoc(doc(dbOf("r4"), "users", "r4"), { name: "HOM staff" }));
    await assertSucceeds(setDoc(doc(dbOf("r4"), "users", "r4"), { ...signupProfile("r4"), role: "hom_admin" }));
    await assertSucceeds(updateDoc(doc(dbOf("r4"), "users", "r4"), { role: "consumer" }));
    await assertFails(updateDoc(doc(dbOf("r4"), "users", "r4"), { role: "hom_admin" }));
  });

  it("an older account with an unlisted role can still save other fields", async () => {
    await seed("r5", { ...signupProfile("r5"), role: "designer" });
    await assertSucceeds(updateDoc(doc(dbOf("r5"), "users", "r5"), { city: "Pune" }));
  });

  it("the TIN admin still signs in as admin and can make someone hom_admin", async () => {
    const admin = testEnv.authenticatedContext("adminS0", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(setDoc(doc(admin, "users", "adminS0"), { ...signupProfile("adminS0"), role: "admin" }, { merge: true }));
    await assertSucceeds(updateDoc(doc(admin, "users", "adminS0"), { name: "Admin", role: "admin" }));
    await assertSucceeds(updateDoc(doc(admin, "users", "r5"), { role: "hom_admin" }));
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
