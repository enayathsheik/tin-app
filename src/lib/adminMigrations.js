// One-time admin data fixes run from Admin → Launch tools (client SDK as the
// TIN admin; firestore.rules lets isAdmin() do these writes).
import { collection, deleteField, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase/config";
import { contactDocRef } from "./applications";
import { legacyContactMigration } from "../utils/applications.js";

const BATCH_MAX = 200; // 2 writes per application → 400 per batch

// L8: move phone / email / CV path from applications made before L8 into
// jobApplications/{id}/private/contact, mark CV presence, and record
// contactUnlockedAt for applications already at Shortlisted or later.
// Safe to run more than once (already-moved applications are skipped).
// Returns { scanned, moved }.
export async function migrateApplicationContacts() {
  const snap = await getDocs(collection(db, "jobApplications"));
  const work = snap.docs
    .map(d => ({ id: d.id, plan: legacyContactMigration({ id: d.id, ...d.data() }) }))
    .filter(x => x.plan);
  for (let i = 0; i < work.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const { id, plan } of work.slice(i, i + BATCH_MAX)) {
      batch.set(contactDocRef(id), { ...plan.contact, createdAt: serverTimestamp() }, { merge: true });
      const parent = { hasCv: plan.hasCv };
      for (const k of plan.removeKeys) parent[k] = deleteField();
      if (plan.unlock) parent.contactUnlockedAt = serverTimestamp();
      batch.update(doc(db, "jobApplications", id), parent);
    }
    await batch.commit();
  }
  return { scanned: snap.size, moved: work.length };
}
