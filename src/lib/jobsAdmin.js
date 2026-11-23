// Reads for Admin → TIN Jobs Admin (client SDK as the TIN super admin;
// firestore.rules / storage.rules let only isAdmin() do these reads).
// Read-only: nothing here writes. Shapes: src/utils/jobsAdmin.js.
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { contactDocRef } from "./applications";
import { loadShortlistLimit } from "./shortlist";
import { contactsNeeded } from "../utils/jobsAdmin.js";

const all = async (name) => {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    throw new Error(`Couldn't read ${name}: ${e.message || e}`, { cause: e });
  }
};

// Run `fn` over items, `size` at a time.
async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  return out;
}

// { [applicationId]: contact doc } — missing docs are left out.
export async function loadContacts(appIds) {
  const pairs = await inChunks(appIds, 50, async (id) => {
    const snap = await getDoc(contactDocRef(id));
    return [id, snap.exists() ? snap.data() : null];
  });
  return Object.fromEntries(pairs.filter(([, c]) => c));
}

export async function loadJobsAdmin() {
  const [users, profiles, privates, jobs, applications, limit] = await Promise.all([
    all("users"), all("jobProfiles"), all("jobProfilesPrivate"), all("jobListings"), all("jobApplications"),
    loadShortlistLimit({ fresh: true }),
  ]);
  const storeIds = [...new Set(users.map(u => u.storeId).filter(id => typeof id === "string" && id))];
  const [contacts, storeList] = await Promise.all([
    loadContacts(contactsNeeded({ privates, applications })),
    inChunks(storeIds, 50, async (id) => {
      const snap = await getDoc(doc(db, "stores", id));
      return snap.exists() ? { ...snap.data(), id } : null;
    }),
  ]);
  const stores = Object.fromEntries(storeList.filter(Boolean).map(x => [x.id, x]));
  return { users, profiles, privates, jobs, applications, limit, contacts, stores };
}

// Firebase Storage download URL for a resume ({ path } or an old saved
// { url }, both already checked by resumeSource). storage.rules give it to
// the owner, the admin, and an employer who shortlisted — nobody else.
export const resumeUrl = (r) => (r.path ? getDownloadURL(ref(storage, r.path)) : Promise.resolve(r.url));

// Links for an export, in the same order; "" when there's no resume, or a
// note when the file can't be opened (e.g. it was deleted).
export function resumeLinks(resumes) {
  return inChunks(resumes, 10, async (r) => {
    if (!r) return "";
    try { return await resumeUrl(r); } catch (e) { console.warn("[jobs-admin] resume link failed:", e); return "File not available"; }
  });
}
