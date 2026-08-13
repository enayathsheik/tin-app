// HOM Systems admin-tab Firestore operations (Block 3). No pricing math
// lives here — see src/utils/homPricing.js, which the caller (HomAdminTab)
// reads the frozen order snapshot through, never this file.
import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";

const MAX_PHOTO_MB = 5;

// ── CATALOG ──
export async function loadCatalog() {
  const snap = await getDoc(doc(db, "homConfig", "catalog"));
  return snap.exists() ? snap.data() : null;
}

// Full-document save — the admin tab always loads the whole catalog first
// and edits it in memory, so this writes it back whole. merge:true is
// defensive only (never clobber a field this UI doesn't know about), not
// load-bearing, since every known field is always present in `catalog`.
export async function saveCatalog(catalog) {
  await setDoc(doc(db, "homConfig", "catalog"), catalog, { merge: true });
}

// Uploads to hom/catalog/{type}/{itemId}/... and returns the download URL.
// Throws (does not swallow) on any failure — the caller must not silently
// drop a failed photo from the item's photos[] array.
export async function uploadCatalogPhoto(type, itemId, file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" isn't an image.`);
  }
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
    throw new Error(`"${file.name}" is over ${MAX_PHOTO_MB}MB.`);
  }
  const path = `hom/catalog/${type}/${itemId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ── VENDORS ──
export async function loadVendors() {
  const snap = await getDocs(collection(db, "homVendors"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveVendor(vendorId, data) {
  if (vendorId) {
    await updateDoc(doc(db, "homVendors", vendorId), data);
    return vendorId;
  }
  const docRef = await addDoc(collection(db, "homVendors"), { ...data, active: true, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function setVendorActive(vendorId, active) {
  await updateDoc(doc(db, "homVendors", vendorId), { active });
}

// ── ORDERS ──
// Uses the Block-1 composite index (status ASC, createdAt DESC) — see
// firestore.indexes.json.
export async function loadOrders(statusFilter) {
  const base = collection(db, "homOrders");
  const q = statusFilter && statusFilter !== "all"
    ? query(base, where("status", "==", statusFilter), orderBy("createdAt", "desc"))
    : query(base, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function rejectOrder(orderId) {
  await updateDoc(doc(db, "homOrders", orderId), { status: "rejected" });
}

// Approves a COD order (or confirms an online-paid one) and assigns both
// vendors in one step — this is a manual decision every time, never
// auto-routed (see HomAdminTab: the two dropdowns are always empty until
// the admin picks). Creates the two homSupplierOrders entries the same
// moment the order is confirmed, so the queue and the supplier logs never
// drift apart. TODO(block4-email): this is exactly where the
// vendor-notification email would fire, once Block 4 wires up sending.
export async function approveAndAssignOrder(order, { profileVendor, glassVendor }) {
  await updateDoc(doc(db, "homOrders", order.id), {
    status: "confirmed",
    profileMakerId: profileVendor.id,
    glassSupplierId: glassVendor.id,
  });

  await addDoc(collection(db, "homSupplierOrders"), {
    type: "profile",
    orderNo: order.orderNo,
    homOrderId: order.id,
    vendorId: profileVendor.id,
    vendorName: profileVendor.name,
    region: profileVendor.region || "",
    items: order.cabinets.map((c) => ({
      profileId: c.profileId, colourId: c.colourId, shutterW: c.shutterW, shutterH: c.shutterH,
      totalShutters: c.totalShutters, barLabel: c.barLabel,
    })),
    status: "to_send",
    createdAt: serverTimestamp(),
  });

  await addDoc(collection(db, "homSupplierOrders"), {
    type: "glass",
    orderNo: order.orderNo,
    homOrderId: order.id,
    vendorId: glassVendor.id,
    vendorName: glassVendor.name,
    region: glassVendor.region || "",
    items: order.cabinets.map((c) => ({
      glassId: c.glassId, addons: c.addons || [], shutterW: c.shutterW, shutterH: c.shutterH,
      totalShutters: c.totalShutters, glassArea: c.glassArea,
    })),
    status: "to_send",
    createdAt: serverTimestamp(),
  });
}

export const ORDER_STATUS_LIFECYCLE = ["confirmed", "in_production", "glass_ordered", "ready", "dispatched", "delivered"];

export async function advanceOrderStatus(orderId, nextStatus) {
  await updateDoc(doc(db, "homOrders", orderId), { status: nextStatus });
}

// ── SUPPLIER ORDER LOGS ──
export async function loadSupplierOrders(type) {
  const snap = await getDocs(query(collection(db, "homSupplierOrders"), where("type", "==", type), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
