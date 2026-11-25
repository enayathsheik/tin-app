// L10: writes for a first shortlist — the application's stage change (with
// contact unlock, L8), a numbered slot jobListings/{job}/shortlistSlots/{n}
// and the job's shortlistCount, all in ONE batch (firestore.rules checks
// them together). One batch per applicant: rules may look up at most 20
// documents per batch. The limit comes from config/pricing (admin, L9);
// Infinity in beta mode.
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase/config";
import { ShortlistFullError, shortlistCountOf, shortlistLimitNow } from "../utils/shortlist.js";

let limitCache = null;
export async function loadShortlistLimit({ fresh = false } = {}) {
  if (limitCache != null && !fresh) return limitCache;
  try {
    const snap = await getDoc(doc(db, "config", "pricing"));
    limitCache = shortlistLimitNow(snap.exists() ? snap.data() : null);
  } catch (e) {
    console.warn("[shortlist] config not readable, using default:", e);
    limitCache = shortlistLimitNow(null);
  }
  return limitCache;
}
export const clearShortlistLimitCache = () => { limitCache = null; };

// `appWrite` = the Firestore fields for the application's stage change
// (already converted: Timestamps, serverTimestamp for contactUnlockedAt).
// Returns the slot number (= the job's new shortlistCount).
export async function writeFirstShortlist(app, appWrite) {
  const jobRef = doc(db, "jobListings", app.jobId);
  const [jobSnap, limit] = await Promise.all([getDoc(jobRef), loadShortlistLimit({ fresh: true })]);
  const count = shortlistCountOf(jobSnap.data());
  if (count >= limit) throw new ShortlistFullError(limit);
  const n = count + 1;
  const batch = writeBatch(db);
  batch.update(doc(db, "jobApplications", app.id), { ...appWrite, shortlistSlot: n });
  batch.set(doc(db, "jobListings", app.jobId, "shortlistSlots", String(n)), { appId: app.id, createdAt: serverTimestamp() });
  batch.update(jobRef, { shortlistCount: n });
  await batch.commit();
  return n;
}
