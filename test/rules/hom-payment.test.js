// HOM Systems Block 4 — payment-integrity rules proof. Online payment
// itself is parked (TODO(block4-payment), no gateway wired up yet) — this
// file proves the underlying invariant that protects it either way: no
// client-writable homOrders path can ever set status or paymentStatus,
// regardless of what it sends, whether via a future payment gateway's
// checkout flow or anything else. COD approve/reject transitions and email
// skip/idempotency are covered in hom-cod.test.js. Run against the
// Firestore emulator only — never production:
//   firebase emulators:exec --only firestore,storage "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "hom-payment-rules-test";
const OWNER_UID = "payTestOwnerUid";

let testEnv;

function validOrderPayload(overrides = {}) {
  return {
    orderNo: "HOM-PAYTEST1",
    ownerUid: OWNER_UID,
    customer: { name: "Test Customer", phone: "9998887776", pincode: "560001" },
    cabinets: [{ profileId: "KP-WIDE", cabW: 600, cabH: 482, qty: 1 }],
    pricingSnapshot: { basic: 4276, gst: 769.68, transport: 300, grand: 5345.68 },
    paymentMethod: "online",
    paymentStatus: "pending_payment",
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
    await setDoc(doc(db, "homOrders", "onlineOrderPending"), validOrderPayload());
    // Separate doc for the "anonymous can no longer use the attachments
    // path at all" proof, isolated from onlineOrderPending so it can't be
    // order-dependent on that doc's attachments already being set by test 3.
    await setDoc(doc(db, "homOrders", "onlineOrderForAnonAttachmentCheck"), validOrderPayload());
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

function ownerDb() {
  return testEnv.authenticatedContext(OWNER_UID, { email: "payowner@example.com" }).firestore();
}

describe("HOM Systems Block 4 — payment status can't be client-set", () => {
  it("1. an unauthenticated client cannot flip status to confirmed via the attachments-update path", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "homOrders", "onlineOrderPending"),
        { status: "confirmed", paymentStatus: "paid", attachments: [{ name: "x.jpg", url: "https://example.com/x.jpg" }] },
        { merge: true }
      )
    );
  });

  it("1a. even the order's own owner cannot flip status/paymentStatus via the attachments-update path", async () => {
    await assertFails(
      setDoc(
        doc(ownerDb(), "homOrders", "onlineOrderPending"),
        { status: "confirmed", paymentStatus: "paid", attachments: [{ name: "x.jpg", url: "https://example.com/x.jpg" }] },
        { merge: true }
      )
    );
  });

  it("2. an unauthenticated client cannot flip paymentStatus alone, even without touching attachments", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "homOrders", "onlineOrderPending"), { paymentStatus: "paid" }, { merge: true })
    );
  });

  // Block 5 (login gate): the attachments-only path is now scoped to the
  // order's own owner (see firestore.rules) — an unauthenticated client can
  // no longer use it at all.
  it("2a. an unauthenticated client can no longer use the attachments-only path either, now that Block 5 requires the owner", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "homOrders", "onlineOrderForAnonAttachmentCheck"), { attachments: [{ name: "x.jpg", url: "https://example.com/x.jpg" }] }, { merge: true })
    );
  });

  it("3. the attachments-only path itself still works for the order's own owner (regression guard, narrowed in Block 5)", async () => {
    await assertSucceeds(
      setDoc(doc(ownerDb(), "homOrders", "onlineOrderPending"), { attachments: [{ name: "x.jpg", url: "https://example.com/x.jpg" }] }, { merge: true })
    );
  });

  it("4. status is still exactly 'new' after the failed client attempts above — only a server-side write can change it", async () => {
    // Reading is admin/hom_admin-only per firestore.rules, so prove this
    // via the rules-disabled context instead — the point here is simply
    // that the two assertFails above left no trace, not testing read access.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), "homOrders", "onlineOrderPending"));
      if (snap.data().status !== "new" || snap.data().paymentStatus !== "pending_payment") {
        throw new Error(`Expected status/paymentStatus untouched, got status=${snap.data().status} paymentStatus=${snap.data().paymentStatus}`);
      }
    });
  });
});
