// Reads for Admin → TIN Jobs Admin (client SDK as the TIN super admin;
// firestore.rules / storage.rules let only isAdmin() do these reads).
// Writes only one thing: deleteJob (admin-only in firestore.rules). Approvals
// and pause / close reuse storeClaims, storeVerification and employerDesk.
// Shapes: src/utils/jobsAdmin.js.
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { contactDocRef, loadApplicants } from "./applications";
import { closeVacancy } from "./employerDesk";
import { loadShortlistLimit } from "./shortlist";
import { closePlan } from "../utils/employerDesk.js";
import { contactsNeeded, isBusinessStore } from "../utils/jobsAdmin.js";

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

// Ids of the stores that count as businesses. The directory has thousands of
// imported stores and the app has already read them all for the admin
// (`known`, createdAt as ISO text), so only newer ones are read here.
async function businessStoreIds(known) {
  const newest = known.reduce((m, x) => (x.createdAt > m ? x.createdAt : m), "");
  let rows;
  if (!newest) rows = await all("stores");
  else {
    const snap = await getDocs(query(collection(db, "stores"), where("createdAt", ">", Timestamp.fromDate(new Date(newest)))));
    rows = [...known, ...snap.docs.map(d => ({ ...d.data(), id: d.id }))];
  }
  return rows.filter(isBusinessStore).map(x => x.id);
}

export async function loadJobsAdmin(knownStores = []) {
  const [users, profiles, privates, jobs, applications, claims, ownIds, limit] = await Promise.all([
    all("users"), all("jobProfiles"), all("jobProfilesPrivate"), all("jobListings"), all("jobApplications"),
    all("claims"), businessStoreIds(knownStores),
    loadShortlistLimit({ fresh: true }),
  ]);
  const storeIds = [...new Set([...ownIds, ...users.map(u => u.storeId), ...claims.map(c => c.storeId)].filter(id => typeof id === "string" && id))];
  const [contacts, storeList] = await Promise.all([
    loadContacts(contactsNeeded({ privates, applications })),
    inChunks(storeIds, 50, async (id) => {
      const snap = await getDoc(doc(db, "stores", id));
      return snap.exists() ? { ...snap.data(), id } : null;
    }),
  ]);
  const stores = Object.fromEntries(storeList.filter(Boolean).map(x => [x.id, x]));
  return { users, profiles, privates, jobs, applications, claims, limit, contacts, stores };
}

// Delete a job for good. Its open applications are closed first, with the
// note, exactly like closing the job — so nobody waits on a job that's gone.
// The applications themselves stay (candidates still see them in their list).
export async function deleteJob(jobId, adminUid, note) {
  const { close } = closePlan(await loadApplicants(jobId), "closed");
  if (close.length) await closeVacancy(jobId, "closed", close, adminUid, note);
  await deleteDoc(doc(db, "jobListings", jobId));
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
