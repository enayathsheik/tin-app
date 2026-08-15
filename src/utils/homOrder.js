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

// Multi-site delivery (additive): every cabinet already carries an optional
// `projectLabel` (see HomBuilder.jsx's Dimensions plate). This is the ONE
// place that turns a raw label into the resolved site identity — used here
// to build `sites[]`/stamp each cabinet's siteId, by HomBuilder.jsx to
// group cabinets for the per-site address form, and by homChits.js to
// group cabinets back out per delivery chit — so a cabinet's site
// membership is computed exactly once, the same way, everywhere.
export const DEFAULT_SITE_LABEL = "Site 1";

export function resolveSiteLabel(projectLabel) {
  return (projectLabel || "").trim() || DEFAULT_SITE_LABEL;
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
// pricing math, stored whole, not re-derived here. Pricing/pooling is
// completely unaffected by sites below — priceOrder pools bars across
// EVERY cabinet in the order regardless of which site it's going to; sites
// only ever change how the ALREADY-PRICED cabinets get grouped for
// delivery afterward (see homChits.js's buildDeliveryChits).
//
// `ownerUid` (Block 5 — login gate): the caller MUST already be signed in
// before this is called (see HomBuilder.jsx's placeOrder — it shows the
// auth gate and returns early if there's no user yet) and must pass that
// user's uid here. firestore.rules' homOrders create rule now REQUIRES
// request.auth != null && request.resource.data.ownerUid ==
// request.auth.uid, so an order written without a matching ownerUid is
// rejected at the rules layer, not just skipped client-side.
//
// `sites` (multi-site delivery, additive): one entry per distinct project/
// site label in use, each `{ siteId, label, address: {flat,street,area,
// city,pincode} }` — HomBuilder.jsx always sends at least one (defaulting
// to DEFAULT_SITE_LABEL when no cabinet was given a label), so this never
// receives an empty array. Every cabinet gets stamped with siteId ==
// resolveSiteLabel(its own projectLabel), which — since HomBuilder derives
// each site's siteId the exact same way — always matches one of the
// entries in `sites`. The top-level `customer.pincode`/`address` fields
// are kept, additively, as a mirror of sites[0] so nothing that only knows
// about the old single-address shape (existing admin UI, old chits) breaks;
// `sites` is the authoritative multi-site data going forward.
export async function submitHomOrder({ catalog, cabinets, customer, sites, paymentMethod, ownerUid }) {
  const priced = priceOrder(catalog, cabinets);
  const orderNo = makeOrderNo();

  const normalizedSites = sites.map((site) => ({
    siteId: site.siteId,
    label: site.label,
    address: {
      flat: site.address?.flat || "",
      street: site.address?.street || "",
      area: site.address?.area || "",
      city: site.address?.city || "",
      pincode: (site.address?.pincode || "").trim(),
    },
  }));
  const primarySite = normalizedSites[0];

  const cabinetsWithSite = priced.cabinets.map((c) => ({
    ...c,
    siteId: resolveSiteLabel(c.projectLabel),
  }));

  const payload = {
    orderNo,
    ownerUid,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      email: (customer.email || "").trim(),
      // Lives here, not on `address` — see file header. Mirrors the
      // primary (first) site's pincode — see the `sites` comment above.
      pincode: primarySite.address.pincode,
      // Free-text production notes (additive, optional) — same shape as
      // email above: a plain trimmed string on `customer`, never required
      // by isValidHomOrder (it only checks name/phone/pincode).
      notes: (customer.notes || "").trim(),
    },
    // Backward-compat mirror of the primary site's address lines — see the
    // `sites` comment above. `sites` is the authoritative data.
    address: {
      flat: primarySite.address.flat,
      street: primarySite.address.street,
      area: primarySite.address.area,
      city: primarySite.address.city,
    },
    sites: normalizedSites,
    cabinets: cabinetsWithSite,
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
