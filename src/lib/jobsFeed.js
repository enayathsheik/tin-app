// Firestore reads/writes for the Jobs pages. All job reads are paginated
// (newest first, PAGE_SIZE at a time) — never an unbounded collection scan.
//
// Lane and filters are applied client-side on loaded jobs: old jobs have no
// `lane` field and must not be rewritten, so a server-side lane filter
// would silently drop them. Needs the composite index
// jobListings: status ASC, jobStatus ASC, createdAt DESC (firestore.indexes.json).
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, startAfter, where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { normaliseJob } from "../utils/jobModel.js";

export const PAGE_SIZE = 30;
export const SAVED_LIMIT = 50;

// Normalised job + the raw document (the current apply flow and the poster
// check still read raw field names like jobTitle / postedByUid).
const toJob = (snap) => {
  const raw = { id: snap.id, ...snap.data() };
  return { ...normaliseJob(raw), raw };
};

// One page of public jobs (approved + live), newest first.
// Returns { jobs, cursor, done } — pass `cursor` back for the next page.
export async function fetchLiveJobsPage(cursor = null) {
  const parts = [
    collection(db, "jobListings"),
    where("status", "==", "approved"),
    where("jobStatus", "==", "live"),
    orderBy("createdAt", "desc"),
  ];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limit(PAGE_SIZE));
  const snap = await getDocs(query(...parts));
  return {
    jobs: snap.docs.map(toJob),
    cursor: snap.docs[snap.docs.length - 1] || cursor,
    done: snap.docs.length < PAGE_SIZE,
  };
}

export async function fetchJob(jobId) {
  const snap = await getDoc(doc(db, "jobListings", jobId));
  return snap.exists() ? toJob(snap) : null;
}

// Poster's public TIN profile (profiles/{uid} is world-readable) — used for
// the business card link: their store page if they have one, else their
// public @handle profile. Returns { href, label } or null.
export async function fetchPosterLink(postedByUid) {
  if (!postedByUid) return null;
  try {
    const snap = await getDoc(doc(db, "profiles", postedByUid));
    if (!snap.exists()) return null;
    const p = snap.data();
    if (p.storeId) return { href: `/store/${p.storeId}`, label: "View store profile" };
    if (p.handle) return { href: `/@${p.handle}`, label: "View TIN profile" };
  } catch (e) {
    console.error("[jobs] Failed to load poster profile:", e);
  }
  return null;
}

// ── Saved jobs: users/{uid}/savedJobs/{jobId} ────────────────

const savedRef = (uid, jobId) => doc(db, "users", uid, "savedJobs", jobId);

export async function isJobSaved(uid, jobId) {
  if (!uid || !jobId) return false;
  const snap = await getDoc(savedRef(uid, jobId));
  return snap.exists();
}

export async function setJobSaved(uid, jobId, saved) {
  if (saved) await setDoc(savedRef(uid, jobId), { jobId, savedAt: serverTimestamp() });
  else await deleteDoc(savedRef(uid, jobId));
}

// The user's saved jobs, newest saved first (up to SAVED_LIMIT). Jobs that
// were deleted or are no longer readable are skipped; jobs that are filled /
// closed are still returned (the UI marks them).
export async function fetchSavedJobs(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(
    collection(db, "users", uid, "savedJobs"),
    orderBy("savedAt", "desc"),
    limit(SAVED_LIMIT),
  ));
  const results = await Promise.all(snap.docs.map(async (d) => {
    try { return await fetchJob(d.id); } catch { return null; }
  }));
  return results.filter(Boolean);
}

// ── Reports: jobReports/{jobId}_{uid} ────────────────────────
// Deterministic id: one report per person per job (a second attempt is an
// update, which the rules deny — surfaced as "already reported").

export const REPORT_REASONS = [
  ["scam", "Looks like a scam or fake job"],
  ["asks_money", "Asks for money or fees"],
  ["misleading", "Wrong or misleading details"],
  ["agency", "Recruitment agency, not direct hiring"],
  ["other", "Something else"],
];

// Reports are admin-read-only, so we can't check for an earlier report
// first; a repeat write is an update and comes back permission-denied.
export async function reportJob(uid, jobId, reason) {
  try {
    await setDoc(doc(db, "jobReports", `${jobId}_${uid}`), { jobId, reporterUid: uid, reason, createdAt: serverTimestamp() });
    return "ok";
  } catch (e) {
    if (e?.code === "permission-denied") return "already";
    throw e;
  }
}
