// L10 test helper: what src/lib/shortlist.js writeFirstShortlist() sends —
// the application's unlocking stage change + slot n + job shortlistCount = n,
// in one batch. `appWrite` already has contactUnlockedAt: serverTimestamp().
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";

export function firstShortlist(db, appId, jobId, appWrite, n, { slotAppId = appId, count = n } = {}) {
  const batch = writeBatch(db);
  batch.update(doc(db, "jobApplications", appId), { ...appWrite, shortlistSlot: n });
  batch.set(doc(db, "jobListings", jobId, "shortlistSlots", String(n)), { appId: slotAppId, createdAt: serverTimestamp() });
  batch.update(doc(db, "jobListings", jobId), { shortlistCount: count });
  return batch.commit();
}
