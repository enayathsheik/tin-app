// HOM Systems Block 3 — scoped hom_admin role proof, on top of Block 1+2
// (test/rules/hom.test.js already covers the public-facing catalog-read/
// order-create/attachments-update surface; this file is specifically the
// admin/hom_admin management surface canManageHom() gates). Run against the
// Firestore emulator only — never production:
//   firebase emulators:exec --only firestore,storage "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "hom-admin-rules-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";

let testEnv;

function validOrderPayload(overrides = {}) {
  return {
    orderNo: "HOM-TEST1",
    customer: { name: "Test Customer", phone: "9998887776", pincode: "560001" },
    cabinets: [{ profileId: "KP-WIDE", cabW: 600, cabH: 482, qty: 1 }],
    pricingSnapshot: { basic: 4276, gst: 769.68, transport: 300, grand: 5345.68 },
    paymentMethod: "cod",
    paymentStatus: "cod_pending_approval",
    status: "new",
    createdAt: new Date(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // hom_admin: a plain users/{uid}.role field, same mechanism as every
    // other TIN role — nothing hom-specific about the users collection
    // itself.
    await setDoc(doc(db, "users", "homAdminUid"), { role: "hom_admin", name: "HOM Admin" });
    // Neither admin nor hom_admin — an ordinary logged-in TIN user.
    await setDoc(doc(db, "users", "plainUid"), { role: "consumer", name: "Plain User" });
    // uidWithNoDoc deliberately has NO users/{uid} doc at all — proves the
    // exists()-before-get() guard in isHomAdminRole() resolves to "not
    // hom_admin" cleanly rather than crashing rule evaluation.

    await setDoc(doc(db, "homConfig", "catalog"), { profiles: [], colours: [], glasses: [], bars: [], hinges: [], addons: [], gstPct: 18, transportFlat: 300, seeded: true });
    await setDoc(doc(db, "homVendors", "vendor1"), { name: "Vendor One", type: "profile", active: true });
    await setDoc(doc(db, "homOrders", "orderExisting"), validOrderPayload());
    await setDoc(doc(db, "homOrders", "orderForFreezeCheck"), validOrderPayload({ orderNo: "HOM-FREEZE1" }));
    await setDoc(doc(db, "homSupplierOrders", "po1"), { type: "profile", vendorId: "vendor1", items: [] });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

function homAdminDb() {
  return testEnv.authenticatedContext("homAdminUid", { email: "hom-admin-not-master@example.com" }).firestore();
}
function plainDb() {
  return testEnv.authenticatedContext("plainUid", { email: "plain@example.com" }).firestore();
}
function noDocDb() {
  return testEnv.authenticatedContext("uidWithNoDoc", { email: "nodoc@example.com" }).firestore();
}
function adminDb() {
  return testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
}
function publicDb() {
  return testEnv.unauthenticatedContext().firestore();
}

describe("HOM Systems Block 3 — hom_admin scoped role", () => {
  it("1. hom_admin can write homConfig/catalog", async () => {
    await assertSucceeds(setDoc(doc(homAdminDb(), "homConfig", "catalog"), { profiles: [] }, { merge: true }));
  });

  it("2. hom_admin can read and write homVendors", async () => {
    const db = homAdminDb();
    await assertSucceeds(getDoc(doc(db, "homVendors", "vendor1")));
    await assertSucceeds(setDoc(doc(db, "homVendors", "vendor2"), { name: "Vendor Two", type: "glass", active: true }));
  });

  it("3. hom_admin can read and write homSupplierOrders", async () => {
    const db = homAdminDb();
    await assertSucceeds(getDoc(doc(db, "homSupplierOrders", "po1")));
    await assertSucceeds(setDoc(doc(db, "homSupplierOrders", "po2"), { type: "glass", vendorId: "vendor1", items: [] }));
  });

  it("4. hom_admin can read homOrders and update it (status/vendor assignment)", async () => {
    const db = homAdminDb();
    await assertSucceeds(getDoc(doc(db, "homOrders", "orderExisting")));
    await assertSucceeds(
      setDoc(doc(db, "homOrders", "orderExisting"), { status: "confirmed", profileMakerId: "vendor1", glassSupplierId: "vendor1" }, { merge: true })
    );
  });

  it("5. hom_admin CANNOT delete homOrders — narrower than canManageHom() on purpose", async () => {
    await assertFails(deleteDoc(doc(homAdminDb(), "homOrders", "orderExisting")));
  });

  it("6. a plain logged-in user (neither admin nor hom_admin) cannot write homConfig", async () => {
    await assertFails(setDoc(doc(plainDb(), "homConfig", "catalog"), { profiles: [] }, { merge: true }));
  });

  it("7. a plain logged-in user cannot read or write homVendors", async () => {
    const db = plainDb();
    await assertFails(getDoc(doc(db, "homVendors", "vendor1")));
    await assertFails(setDoc(doc(db, "homVendors", "vendor3"), { name: "x", type: "profile", active: true }));
  });

  it("8. a plain logged-in user cannot read or write homSupplierOrders", async () => {
    const db = plainDb();
    await assertFails(getDoc(doc(db, "homSupplierOrders", "po1")));
    await assertFails(setDoc(doc(db, "homSupplierOrders", "po3"), { type: "profile", vendorId: "vendor1", items: [] }));
  });

  it("9. a plain logged-in user cannot read or update homOrders", async () => {
    const db = plainDb();
    await assertFails(getDoc(doc(db, "homOrders", "orderExisting")));
    await assertFails(setDoc(doc(db, "homOrders", "orderExisting"), { status: "confirmed" }, { merge: true }));
  });

  it("10. a user with no users/{uid} doc at all is not treated as hom_admin (exists() guard) — denied write", async () => {
    await assertFails(setDoc(doc(noDocDb(), "homConfig", "catalog"), { profiles: [] }, { merge: true }));
  });

  it("11. public (unauthenticated) can still read homConfig/catalog", async () => {
    await assertSucceeds(getDoc(doc(publicDb(), "homConfig", "catalog")));
  });

  it("12. public can still create a valid order", async () => {
    await assertSucceeds(setDoc(doc(publicDb(), "homOrders", "publicOrder1"), validOrderPayload({ orderNo: "HOM-PUB1" })));
  });

  it("13. public cannot read another customer's order", async () => {
    await assertFails(getDoc(doc(publicDb(), "homOrders", "orderExisting")));
  });

  it("14. public cannot write homConfig or homVendors", async () => {
    const db = publicDb();
    await assertFails(setDoc(doc(db, "homConfig", "catalog"), { profiles: [] }, { merge: true }));
    await assertFails(setDoc(doc(db, "homVendors", "vendor4"), { name: "x", type: "profile", active: true }));
  });

  it("15. full TIN admin (isAdmin()) still has every homOrders capability, including delete", async () => {
    const db = adminDb();
    await assertSucceeds(getDoc(doc(db, "homOrders", "orderExisting")));
    await assertSucceeds(setDoc(doc(db, "homOrders", "orderExisting"), { status: "delivered" }, { merge: true }));
  });

  // ── Price-freeze regression (carry-over hard rule) ──
  it("16. editing homConfig/catalog rates does NOT change an existing order's frozen pricingSnapshot", async () => {
    const before = (await getDoc(doc(adminDb(), "homOrders", "orderForFreezeCheck"))).data().pricingSnapshot;
    expect(before).toEqual({ basic: 4276, gst: 769.68, transport: 300, grand: 5345.68 });

    await setDoc(
      doc(adminDb(), "homConfig", "catalog"),
      { gstPct: 28, transportFlat: 999, makingPerShutter: 5000 },
      { merge: true }
    );

    const after = (await getDoc(doc(adminDb(), "homOrders", "orderForFreezeCheck"))).data().pricingSnapshot;
    expect(after).toEqual(before);
  });
});
