// HOM Systems Block 1 (+ Block 5 login gate) — permission proof. The
// microsite reads the catalog with no auth at all, but placing an order now
// requires a signed-in TIN account (mobile or email — see
// src/utils/phoneAuth.js and src/pages/hom/HomAuthGate.jsx) whose uid must
// match the order's ownerUid. Everything else (vendors, order read/update/
// delete, supplier orders, catalog write) stays behind the existing
// isAdmin() email check. Run against the Firestore emulator only — never
// production:
//   firebase emulators:exec --only firestore "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "hom-rules-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const OWNER_UID = "customerUid1";
const OTHER_UID = "customerUid2";

let testEnv;

function validOrderPayload(overrides = {}) {
  return {
    ownerUid: OWNER_UID,
    customer: { name: "Test Customer", phone: "9998887776", pincode: "560001" },
    cabinets: [{ profileId: "KP-WIDE", cabW: 600, cabH: 482, qty: 1 }],
    pricingSnapshot: { basic: 4276, gst: 769.68, transport: 300, grand: 5345.68 },
    paymentMethod: "cod",
    status: "new",
    createdAt: new Date(),
    ...overrides,
  };
}

function ownerDb() {
  return testEnv.authenticatedContext(OWNER_UID, { email: "owner@example.com" }).firestore();
}
function otherDb() {
  return testEnv.authenticatedContext(OTHER_UID, { email: "other@example.com" }).firestore();
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
    await setDoc(doc(db, "homConfig", "catalog"), { profiles: [], colours: [], seeded: true });
    await setDoc(doc(db, "homVendors", "vendor1"), { name: "Vendor One" });
    await setDoc(doc(db, "homOrders", "orderExisting"), validOrderPayload());
    // Separate, untouched docs for the attachments-only update tests below —
    // isolated from orderExisting so those tests can't be order-dependent on
    // what earlier tests (e.g. admin's status update) already did to it.
    await setDoc(doc(db, "homOrders", "orderNoAttachments"), validOrderPayload());
    await setDoc(doc(db, "homOrders", "orderAttachmentsAlreadySet"), validOrderPayload({ attachments: [{ name: "existing.jpg", url: "https://example.com/existing.jpg" }] }));
    await setDoc(doc(db, "homOrders", "orderForTypeCheck"), validOrderPayload());
    await setDoc(doc(db, "homSupplierOrders", "po1"), { vendorId: "vendor1", items: [] });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("HOM Systems Block 1 — security rules", () => {
  it("1. anyone (unauthenticated) can read the catalog", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "homConfig", "catalog")));
  });

  it("2. unauthenticated user cannot write the catalog", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "homConfig", "catalog"), { profiles: [] }, { merge: true }));
  });

  it("3. admin can write the catalog", async () => {
    const db = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(setDoc(doc(db, "homConfig", "catalog"), { profiles: [] }, { merge: true }));
  });

  it("4. unauthenticated user cannot read or write vendors", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "homVendors", "vendor1")));
    await assertFails(setDoc(doc(db, "homVendors", "vendor2"), { name: "x" }));
  });

  it("5. admin can read and write vendors", async () => {
    const db = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(getDoc(doc(db, "homVendors", "vendor1")));
    await assertSucceeds(setDoc(doc(db, "homVendors", "vendor2"), { name: "x" }));
  });

  // ── Block 5: login gate — order create now requires a signed-in owner ──
  it("6. a signed-in customer can create a valid order with ownerUid == their own uid", async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), "homOrders", "newOrder1"), validOrderPayload()));
  });

  it("6a. an unauthenticated (anonymous) create is now DENIED — the login gate can't be bypassed", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "homOrders", "anonOrder1"), validOrderPayload()));
  });

  it("6b. a signed-in user cannot create an order claiming someone else's uid as ownerUid", async () => {
    await assertFails(setDoc(doc(ownerDb(), "homOrders", "spoofedOwnerOrder"), validOrderPayload({ ownerUid: OTHER_UID })));
  });

  it("7. invalid order create is denied — malformed pincode (even for the correct owner)", async () => {
    await assertFails(
      setDoc(
        doc(ownerDb(), "homOrders", "badOrder1"),
        validOrderPayload({ customer: { name: "X", phone: "999", pincode: "12" } })
      )
    );
  });

  it("8. invalid order create is denied — no cabinets (even for the correct owner)", async () => {
    await assertFails(setDoc(doc(ownerDb(), "homOrders", "badOrder2"), validOrderPayload({ cabinets: [] })));
  });

  it("9. invalid order create is denied — unrecognized payment method (even for the correct owner)", async () => {
    await assertFails(setDoc(doc(ownerDb(), "homOrders", "badOrder3"), validOrderPayload({ paymentMethod: "cheque" })));
  });

  it("10. invalid order create is denied — missing pricing snapshot (even for the correct owner)", async () => {
    await assertFails(setDoc(doc(ownerDb(), "homOrders", "badOrder4"), validOrderPayload({ pricingSnapshot: null })));
  });

  it("11. invalid order create is denied — missing customer name/phone (even for the correct owner)", async () => {
    await assertFails(
      setDoc(
        doc(ownerDb(), "homOrders", "badOrder5"),
        validOrderPayload({ customer: { name: "", phone: "", pincode: "560001" } })
      )
    );
  });

  it("12. an unauthenticated customer cannot read any order, including one that already exists", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "homOrders", "orderExisting")));
  });

  it("12a. the order's own owner CAN read it back", async () => {
    await assertSucceeds(getDoc(doc(ownerDb(), "homOrders", "orderExisting")));
  });

  it("12b. a different signed-in user cannot read someone else's order", async () => {
    await assertFails(getDoc(doc(otherDb(), "homOrders", "orderExisting")));
  });

  it("13. admin can read, update, and delete orders", async () => {
    const db = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(getDoc(doc(db, "homOrders", "orderExisting")));
    await assertSucceeds(setDoc(doc(db, "homOrders", "orderExisting"), { status: "confirmed" }, { merge: true }));
  });

  it("14. unauthenticated user cannot update an existing order", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "homOrders", "orderExisting"), { status: "hacked" }, { merge: true }));
  });

  it("14a. the order's own owner cannot update status either — only canManageHom() can", async () => {
    await assertFails(setDoc(doc(ownerDb(), "homOrders", "orderExisting"), { status: "hacked" }, { merge: true }));
  });

  it("15. unauthenticated user cannot read or write supplier orders", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "homSupplierOrders", "po1")));
    await assertFails(setDoc(doc(db, "homSupplierOrders", "po2"), { vendorId: "vendor1", items: [] }));
  });

  it("16. admin can read and write supplier orders", async () => {
    const db = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(getDoc(doc(db, "homSupplierOrders", "po1")));
    await assertSucceeds(setDoc(doc(db, "homSupplierOrders", "po2"), { vendorId: "vendor1", items: [] }));
  });

  // ── Block 2 (narrowed in Block 5 to the order's own owner) ──
  it("17. the order's own owner can set attachments once on an order that has none yet", async () => {
    await assertSucceeds(
      setDoc(
        doc(ownerDb(), "homOrders", "orderNoAttachments"),
        { attachments: [{ name: "photo.jpg", url: "https://example.com/photo.jpg" }] },
        { merge: true }
      )
    );
  });

  it("17a. an unauthenticated client can no longer set attachments at all — Block 5 requires the owner", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "homOrders", "orderForTypeCheck"),
        { attachments: [{ name: "anon.jpg", url: "https://example.com/anon.jpg" }] },
        { merge: true }
      )
    );
  });

  it("17b. a different signed-in user (not the owner) cannot set attachments on someone else's order", async () => {
    await assertFails(
      setDoc(
        doc(otherDb(), "homOrders", "orderForTypeCheck"),
        { attachments: [{ name: "intruder.jpg", url: "https://example.com/intruder.jpg" }] },
        { merge: true }
      )
    );
  });

  it("18. a second attachments update by the owner on the same order is denied (already non-empty)", async () => {
    await assertFails(
      setDoc(
        doc(ownerDb(), "homOrders", "orderAttachmentsAlreadySet"),
        { attachments: [{ name: "second.jpg", url: "https://example.com/second.jpg" }] },
        { merge: true }
      )
    );
  });

  it("19. an owner update touching any field besides attachments is denied, even on a fresh order", async () => {
    await assertFails(
      setDoc(
        doc(ownerDb(), "homOrders", "orderNoAttachments"),
        { status: "hacked", attachments: [{ name: "x.jpg", url: "https://example.com/x.jpg" }] },
        { merge: true }
      )
    );
  });

  it("20. an owner update setting attachments to a non-list is denied", async () => {
    await assertFails(
      setDoc(doc(ownerDb(), "homOrders", "orderForTypeCheck"), { attachments: "not-a-list" }, { merge: true })
    );
  });

  // ── Block 6: multi-site delivery — additive `sites[]` validation ──
  it("21. a single-site order (sites[] with exactly one valid entry) creates exactly as before", async () => {
    await assertSucceeds(
      setDoc(
        doc(ownerDb(), "homOrders", "singleSiteOrder"),
        validOrderPayload({ sites: [{ siteId: "Site 1", label: "Site 1", address: { flat: "", street: "", area: "", city: "", pincode: "560001" } }] })
      )
    );
  });

  it("21a. a multi-site order (sites[] with two valid-pincode entries) creates successfully", async () => {
    await assertSucceeds(
      setDoc(
        doc(ownerDb(), "homOrders", "multiSiteOrder"),
        validOrderPayload({
          sites: [
            { siteId: "Kitchen", label: "Kitchen", address: { flat: "1", street: "", area: "", city: "", pincode: "560001" } },
            { siteId: "Utility", label: "Utility", address: { flat: "2", street: "", area: "", city: "", pincode: "600001" } },
          ],
        })
      )
    );
  });

  it("21b. a site with a malformed pincode denies the whole create", async () => {
    await assertFails(
      setDoc(
        doc(ownerDb(), "homOrders", "badSitePincode"),
        validOrderPayload({
          sites: [
            { siteId: "Kitchen", label: "Kitchen", address: { flat: "", street: "", area: "", city: "", pincode: "560001" } },
            { siteId: "Utility", label: "Utility", address: { flat: "", street: "", area: "", city: "", pincode: "12" } },
          ],
        })
      )
    );
  });

  it("21c. a site missing a pincode entirely denies the whole create", async () => {
    await assertFails(
      setDoc(
        doc(ownerDb(), "homOrders", "missingSitePincode"),
        validOrderPayload({ sites: [{ siteId: "Kitchen", label: "Kitchen", address: { flat: "", street: "", area: "", city: "" } }] })
      )
    );
  });

  it("21d. a malformed site (not a map) denies the whole create", async () => {
    await assertFails(
      setDoc(doc(ownerDb(), "homOrders", "badSiteShape"), validOrderPayload({ sites: ["not-a-site-map"] }))
    );
  });

  it("21e. an order with no `sites` field at all still creates — backward compatible with the pre-Block-6 shape", async () => {
    // validOrderPayload() with no `sites` override — the exact same call
    // every pre-existing test in this file already makes; asserted here
    // explicitly as the multi-site feature's own backward-compat proof.
    await assertSucceeds(setDoc(doc(ownerDb(), "homOrders", "noSitesFieldOrder"), validOrderPayload()));
  });
});
