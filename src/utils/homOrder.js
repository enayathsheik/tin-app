// HOM Systems — order-save + attachment-upload for the public
// microsite (Block 2, reworked for the rate-list + optimiser overhaul).
// Builds on src/utils/homPricing.js for all math — this file only shapes/
// writes data, it never computes a price itself.
//
// The homOrders payload below is shaped to satisfy firestore.rules'
// isValidHomOrder EXACTLY: pincode lives on `customer` (not `address`) and
// `paymentMethod` is a flat top-level string — both because that's where
// the deployed Block-1 rule looks for them, not an arbitrary schema choice.
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { priceOrder } from "./homPricing";

function makeOrderNo() {
  return "HOM-" + Date.now().toString(36).toUpperCase();
}

// Freezes exactly the catalog values priceOrder reads, so a later admin
// edit to homConfig/catalog never reprices an already-placed order.
// Deliberately excludes colours/profileTypes/photos/active flags —
// display-only, nothing in homPricing.js reads them (colourId/
// profileTypeId are only ever used as pooling-group keys, never looked up
// for a name or rate).
function freezeCatalogRates(catalog) {
  return {
    brands: (catalog.brands || []).map((b) => ({
      id: b.id,
      name: b.name,
      regularBars: b.regularBars,
      handleTypes: (b.handleTypes || []).map((h) => ({ id: h.id, name: h.name, bars: h.bars })),
    })),
    glasses: catalog.glasses,
    addons: catalog.addons,
    hingeCategories: catalog.hingeCategories,
    liftUp: catalog.liftUp,
    makingPerShutter: catalog.makingPerShutter,
    glassDeductMm: catalog.glassDeductMm,
    gstPct: catalog.gstPct,
    transportFlat: catalog.transportFlat,
    kerfMm: catalog.kerfMm,
  };
}

// Prices `cabinets` (raw priceOrder cabinet inputs, each optionally carrying
// a `projectLabel`) via priceOrder and writes the order to Firestore. Throws
// on any failure — callers must not swallow it and must not clear the
// customer's form on catch (see HomBuilder.jsx). priceOrder's cabinets[]
// already merge each cabinet's raw input with its computed fields
// (shutterW, indicativeTotal, regularBar/handleBar, etc.) — one source of
// pricing math, stored whole, not re-derived here.
//
// `ownerUid` (Block 5 — login gate): the caller MUST already be signed in
// before this is called (see HomBuilder.jsx's placeOrder — it shows the
// auth gate and returns early if there's no user yet) and must pass that
// user's uid here. firestore.rules' homOrders create rule now REQUIRES
// request.auth != null && request.resource.data.ownerUid ==
// request.auth.uid, so an order written without a matching ownerUid is
// rejected at the rules layer, not just skipped client-side.
export async function submitHomOrder({ catalog, cabinets, customer, address, paymentMethod, ownerUid }) {
  const priced = priceOrder(catalog, cabinets);
  const orderNo = makeOrderNo();

  const payload = {
    orderNo,
    ownerUid,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      email: (customer.email || "").trim(),
      // Lives here, not on `address` — see file header.
      pincode: customer.pincode.trim(),
    },
    address: {
      flat: address.flat || "",
      street: address.street || "",
      area: address.area || "",
      city: address.city || "",
    },
    cabinets: priced.cabinets,
    pricingSnapshot: {
      basic: priced.basic,
      gst: priced.gst,
      transport: priced.transport,
      grand: priced.grand,
      gstPct: catalog.gstPct,
      transportFlat: catalog.transportFlat,
    },
    catalogSnapshot: freezeCatalogRates(catalog),
    paymentMethod,
    // "online" is parked — HomBuilder.jsx currently only ever sends "cod"
    // (the "Pay now" radio is rendered disabled). This branch and the
    // "pending_payment" status are kept intact as the seam for whichever
    // payment gateway a future block wires up.
    // TODO(block4-payment): reconcile "online" orders server-side once a
    // gateway is chosen; flip paymentStatus to "paid" only after a verified
    // payment, never on the client's say-so. "cod" orders wait on admin
    // approval (Block 3's Approve/Reject, wired end-to-end in Block 4).
    paymentStatus: paymentMethod === "online" ? "pending_payment" : "cod_pending_approval",
    status: "new",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "homOrders"), payload);
  return { orderId: docRef.id, orderNo, pricing: priced };
}

// Uploads each file to hom/orders/{orderId}/... then patches attachments[]
// onto the order in one update (the only field the Block-1+2 rule allows an
// unauthenticated client to set, and only once — see firestore.rules).
// Partial failures still write whichever files succeeded; the thrown error
// carries both `uploaded` and `failed` so the caller can show the customer
// exactly which files need to be re-sent, without hiding that anything
// failed and without pretending the (already-placed) order failed too.
export async function uploadHomOrderFiles(orderId, files) {
  const uploaded = [];
  const failed = [];

  for (const file of files) {
    try {
      const path = `hom/orders/${orderId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      uploaded.push({ name: file.name, url });
    } catch (e) {
      failed.push({ name: file.name, error: e.message });
    }
  }

  if (uploaded.length) {
    await updateDoc(doc(db, "homOrders", orderId), { attachments: uploaded });
  }

  if (failed.length) {
    throw Object.assign(
      new Error(`${failed.length} of ${files.length} file(s) failed to upload.`),
      { uploaded, failed }
    );
  }

  return uploaded;
}
