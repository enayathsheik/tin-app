// HOM Systems "House of Mod" Block 1 — permission proof. The microsite has
// no auth: it publicly reads the catalog and creates orders, and nothing
// else. Everything else (vendors, order read/update/delete, supplier
// orders, catalog write) stays behind the existing isAdmin() email check.
// Run against the Firestore emulator only — never production:
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

let testEnv;

function validOrderPayload(overrides = {}) {
  return {
    customer: { name: "Test Customer", phone: "9998887776", pincode: "560001" },
    cabinets: [{ profileId: "KP-WIDE", cabW: 600, cabH: 482, qty: 1 }],
    pricingSnapshot: { basic: 4276, gst: 769.68, transport: 300, grand: 5345.68 },
    paymentMethod: "cod",
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

  it("6. unauthenticated user can create a valid order", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(db, "homOrders", "newOrder1"), validOrderPayload()));
  });

  it("7. invalid order create is denied — malformed pincode", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "homOrders", "badOrder1"),
        validOrderPayload({ customer: { name: "X", phone: "999", pincode: "12" } })
      )
    );
  });

  it("8. invalid order create is denied — no cabinets", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "homOrders", "badOrder2"), validOrderPayload({ cabinets: [] })));
  });

  it("9. invalid order create is denied — unrecognized payment method", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "homOrders", "badOrder3"), validOrderPayload({ paymentMethod: "cheque" })));
  });

  it("10. invalid order create is denied — missing pricing snapshot", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "homOrders", "badOrder4"), validOrderPayload({ pricingSnapshot: null })));
  });

  it("11. invalid order create is denied — missing customer name/phone", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "homOrders", "badOrder5"),
        validOrderPayload({ customer: { name: "", phone: "", pincode: "560001" } })
      )
    );
  });

  it("12. an unauthenticated customer cannot read any order, including one that already exists", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "homOrders", "orderExisting")));
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

  // ── Block 2: the public attachments-only update path ──
  it("17. an unauthenticated client can set attachments once on an order that has none yet", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "homOrders", "orderNoAttachments"),
        { attachments: [{ name: "photo.jpg", url: "https://example.com/photo.jpg" }] },
        { merge: true }
      )
    );
  });

  it("18. a second unauthenticated attachments update on the same order is denied (already non-empty)", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "homOrders", "orderAttachmentsAlreadySet"),
        { attachments: [{ name: "second.jpg", url: "https://example.com/second.jpg" }] },
        { merge: true }
      )
    );
  });

  it("19. an unauthenticated update touching any field besides attachments is denied, even on a fresh order", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "homOrders", "orderNoAttachments"),
        { status: "hacked", attachments: [{ name: "x.jpg", url: "https://example.com/x.jpg" }] },
        { merge: true }
      )
    );
  });

  it("20. an unauthenticated update setting attachments to a non-list is denied", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "homOrders", "orderForTypeCheck"), { attachments: "not-a-list" }, { merge: true })
    );
  });
});
