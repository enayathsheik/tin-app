// L2b "Find your business": search all stores (hidden imported ones too),
// claim one, TIN admin approves. Pure helpers: src/utils/storeClaim.js.
// Rules: match /claims and match /stores in firestore.rules.
//
// Search needs the composite index stores (city ASC, storeName ASC) —
// firestore.indexes.json.
import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { buildClaimDoc, cityVariants, mergeSearchResults, nameVariants } from "../utils/storeClaim.js";

const PER_QUERY = 20;

// Stores in `city` whose name starts with `name` (any common capitalisation).
export async function searchStoresForClaim(name, city) {
  const cities = cityVariants(city);
  const names = nameVariants(name);
  if (!cities.length || !names.length) return [];
  const lists = await Promise.all(names.map(async (prefix) => {
    const snap = await getDocs(query(
      collection(db, "stores"),
      where("city", "in", cities),
      where("storeName", ">=", prefix),
      where("storeName", "<=", prefix + ""),
      orderBy("storeName"),
      limit(PER_QUERY),
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }));
  return mergeSearchResults(lists);
}

export async function submitStoreClaim(user, store, form) {
  const ref = await addDoc(collection(db, "claims"), {
    ...buildClaimDoc(user, store, form),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// The signed-in user's own claims, newest first.
export async function loadMyClaims(uid) {
  const snap = await getDocs(query(collection(db, "claims"), where("claimantUid", "==", uid)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

// ── Admin ──────────────────────────────────────────────────────────────

export async function loadClaimsForReview(status = "pending") {
  const snap = await getDocs(query(collection(db, "claims"), where("status", "==", status)));
  const claims = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  // Context for the admin: the store's current state and the claimant's current store link.
  return Promise.all(claims.map(async (c) => {
    const [storeSnap, userSnap] = await Promise.all([
      c.storeId ? getDoc(doc(db, "stores", c.storeId)).catch(() => null) : null,
      c.claimantUid ? getDoc(doc(db, "users", c.claimantUid)).catch(() => null) : null,
    ]);
    return {
      ...c,
      store: storeSnap?.exists?.() ? { id: storeSnap.id, ...storeSnap.data() } : null,
      claimant: userSnap?.exists?.() ? { uid: userSnap.id, ...userSnap.data() } : null,
    };
  }));
}

// One batch: claim approved; store marked claimed and handed to the claimant
// (contributorId, so the existing store rules let them edit its details);
// the claimant's account linked to the store (users/{uid}.storeId).
// Does NOT verify the account — verification stays a separate admin step.
export async function approveClaim(claim, adminUid) {
  if (!claim.claimantUid || !claim.storeId) throw new Error("This claim has no claimant account or store — it can only be rejected.");
  const storeRef = doc(db, "stores", claim.storeId);
  const storeSnap = await getDoc(storeRef);
  if (!storeSnap.exists()) throw new Error("The store no longer exists.");
  const store = storeSnap.data();
  if (store.claimedByUid && store.claimedByUid !== claim.claimantUid) throw new Error("This store was already claimed by another account.");

  const batch = writeBatch(db);
  batch.update(doc(db, "claims", claim.id), { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: adminUid || "admin" });
  batch.update(storeRef, {
    claimedByUid: claim.claimantUid,
    claimedAt: serverTimestamp(),
    claimId: claim.id,
    contributorId: claim.claimantUid,
    previousContributorId: store.contributorId || null,
  });
  batch.set(doc(db, "users", claim.claimantUid), { storeId: claim.storeId }, { merge: true });
  await batch.commit();
}

export async function rejectClaim(claim, adminUid, reason = "") {
  const batch = writeBatch(db);
  batch.update(doc(db, "claims", claim.id), { status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: adminUid || "admin", rejectReason: reason || null });
  await batch.commit();
}
