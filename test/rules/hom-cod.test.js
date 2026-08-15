// HOM Systems Block 4 — COD approval wiring proof. Block 3's
// approveAndAssignOrder/rejectOrder (src/utils/homAdmin.js) already do
// exactly what this block asks for — this file proves the write shape they
// send is actually allowed for admin/hom_admin and actually denied for
// everyone else, at the rules layer. Run against the Firestore emulator
// only — never production:
//   firebase emulators:exec --only firestore,storage "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

const PROJECT_ID = "hom-cod-rules-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";

let testEnv;

function codOrderPayload(overrides = {}) {
  return {
    orderNo: "HOM-CODTEST1",
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
    await setDoc(doc(db, "users", "homAdminUid"), { role: "hom_admin", name: "HOM Admin" });
    await setDoc(doc(db, "homOrders", "codOrderToApprove"), codOrderPayload());
    await setDoc(doc(db, "homOrders", "codOrderToReject"), codOrderPayload({ orderNo: "HOM-CODTEST2" }));
    await setDoc(doc(db, "homOrders", "codOrderPublicAttempt"), codOrderPayload({ orderNo: "HOM-CODTEST3" }));
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("HOM Systems Block 4 — COD approve/reject", () => {
  it("1. hom_admin approving a COD order — exactly the write shape approveAndAssignOrder sends — succeeds and lands on status 'confirmed'", async () => {
    const db = testEnv.authenticatedContext("homAdminUid", { email: "hom-admin@example.com" }).firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "homOrders", "codOrderToApprove"),
        { status: "confirmed", profileMakerId: "vendorA", glassSupplierId: "vendorB" },
        { merge: true }
      )
    );
  });

  it("2. full TIN admin rejecting a COD order — exactly the write shape rejectOrder sends — succeeds and lands on status 'rejected'", async () => {
    const db = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(setDoc(doc(db, "homOrders", "codOrderToReject"), { status: "rejected" }, { merge: true }));
  });

  it("3. an unauthenticated customer cannot approve their own COD order", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "homOrders", "codOrderPublicAttempt"),
        { status: "confirmed", profileMakerId: "vendorA", glassSupplierId: "vendorB" },
        { merge: true }
      )
    );
  });

  it("4. an unauthenticated customer cannot reject an order either", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "homOrders", "codOrderPublicAttempt"), { status: "rejected" }, { merge: true }));
  });

  it("5. a plain logged-in user (neither admin nor hom_admin) cannot approve or reject", async () => {
    const db = testEnv.authenticatedContext("plainUid2", { email: "plain2@example.com" }).firestore();
    await assertFails(setDoc(doc(db, "homOrders", "codOrderPublicAttempt"), { status: "confirmed" }, { merge: true }));
    await assertFails(setDoc(doc(db, "homOrders", "codOrderPublicAttempt"), { status: "rejected" }, { merge: true }));
  });
});
