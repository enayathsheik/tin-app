// L9: read / save config/pricing, and the entitlement write that goes in the
// same batch as a profile's first save or a job's creation.
import { Timestamp, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { ENTITLEMENT_DAYS, entitlementDoc, entitlementId, pricingFrom, validUntilFrom } from "../utils/pricing.js";

let cache = null;
export async function loadPricing({ fresh = false } = {}) {
  if (cache && !fresh) return cache;
  try {
    const snap = await getDoc(doc(db, "config", "pricing"));
    cache = pricingFrom(snap.exists() ? snap.data() : null);
  } catch (e) {
    console.warn("[pricing] config not readable, using defaults:", e);
    cache = pricingFrom(null);
  }
  return cache;
}
export const clearPricingCache = () => { cache = null; };

// Admin only (firestore.rules config/pricing).
export async function savePricing(p, adminUid) {
  const clean = pricingFrom({
    profileFee: { list: Number(p.profileFee.list), offer: Number(p.profileFee.offer), launchDiscount: !!p.profileFee.launchDiscount },
    jobPostFee: { list: Number(p.jobPostFee.list), offer: Number(p.jobPostFee.offer), launchDiscount: !!p.jobPostFee.launchDiscount },
    shortlistLimit: Number(p.shortlistLimit),
  });
  await setDoc(doc(db, "config", "pricing"), { ...clean, updatedAt: serverTimestamp(), updatedBy: adminUid || "admin" });
  cache = clean;
  return clean;
}

// Add the entitlement to a batch: grantedAt = server time, validUntil = 365
// days later (rules check both). `fee` = pricing.profileFee / jobPostFee.
export function addEntitlement(batch, kind, uid, refId, fee) {
  batch.set(doc(db, "entitlements", entitlementId(kind, refId)), {
    ...entitlementDoc(kind, uid, refId, fee),
    grantedAt: serverTimestamp(),
    validDays: ENTITLEMENT_DAYS,
    validUntil: Timestamp.fromDate(validUntilFrom(new Date())),
  });
}

// For the admin backfill: an explicit start date (when the profile/job was created).
export function entitlementForBackfill(kind, uid, refId, fee, start) {
  return {
    ...entitlementDoc(kind, uid, refId, fee),
    grantedAt: Timestamp.fromDate(start),
    validDays: ENTITLEMENT_DAYS,
    validUntil: Timestamp.fromDate(new Date(start.getTime() + ENTITLEMENT_DAYS * 86400000)),
    backfilled: true,
  };
}
