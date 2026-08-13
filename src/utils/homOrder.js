// HOM Systems — order-save + attachment-upload for the public
// microsite (Block 2). Builds on src/utils/homPricing.js for all math — this
// file only shapes/writes data, it never computes a price itself.
//
// The homOrders payload below is shaped to satisfy firestore.rules'
// isValidHomOrder EXACTLY: pincode lives on `customer` (not `address`) and
// `paymentMethod` is a flat top-level string — both because that's where
// the deployed Block-1 rule looks for them, not an arbitrary schema choice.
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { priceCabinet, priceOrder } from "./homPricing";

function makeOrderNo() {
  return "HOM-" + Date.now().toString(36).toUpperCase();
}

// Freezes exactly the catalog values priceCabinet/priceOrder read, so a
// later admin edit to homConfig/catalog never reprices an already-placed
// order. Deliberately excludes profiles/colours/photos — display-only,
// nothing in homPricing.js reads them.
function freezeCatalogRates(catalog) {
  return {
    bars: catalog.bars,
    glasses: catalog.glasses,
    addons: catalog.addons,
    hinges: catalog.hinges,
    handleRatePerFt: catalog.handleRatePerFt,
    makingPerShutter: catalog.makingPerShutter,
    glassDeductMm: catalog.glassDeductMm,
    gstPct: catalog.gstPct,
    transportFlat: catalog.transportFlat,
  };
}

// Prices `cabinets` (raw priceCabinet inputs) via priceOrder and writes the
// order to Firestore. Throws on any failure — callers must not swallow it
// and must not clear the customer's form on catch (see HomBuilder.jsx).
export async function submitHomOrder({ catalog, cabinets, customer, address, paymentMethod }) {
  // priceCabinet's return value is computed fields ONLY (shutterW,
  // cabinetTotal, etc.) — it does not echo back profileId/colourId/glassId/
  // dimensions/etc. Merging raw input + computed result into one flat
  // object per line is what makes the stored order self-sufficient for
  // Block 3 (ops needs to know which glass/colour/profile/size, not just
  // the price). priceOrder still does the actual summing below — passing
  // it these already-priced lines makes it reuse cabinetTotal rather than
  // recompute (see priceOrder's typeof check), so there's exactly one
  // source of pricing math, not two.
  const cabinetLines = cabinets.map((input) => ({ ...input, ...priceCabinet(catalog, input) }));
  const priced = priceOrder(catalog, cabinetLines);
  const orderNo = makeOrderNo();

  const payload = {
    orderNo,
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
    // Block 4 (Razorpay) reconciles "online" orders and flips this status;
    // "cod" orders wait on admin approval in Block 3.
    // TODO(block4-razorpay): capture payment, verify webhook, flip to "paid".
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
