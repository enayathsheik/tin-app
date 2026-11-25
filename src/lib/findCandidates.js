// Find candidates (A3): the employer's search over jobProfiles and the
// shortlistCandidate Cloud Function. Every filter is in the query; the rules
// allow employer accounts only people on search, 20 at a time
// (firestore.rules jobProfiles, indexes in firestore.indexes.json).
import { collection, doc, getDocs, limit, orderBy, query, setDoc, startAfter, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/config";
import { candidateFilters } from "../utils/candidateSearch.js";
import { normaliseJob } from "../utils/jobModel.js";

export const CANDIDATE_PAGE = 20;

export async function searchCandidates(filters, cursor = null) {
  const parts = [
    ...candidateFilters(filters).map(([field, op, value]) => where(field, op, value)),
    orderBy("updatedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(CANDIDATE_PAGE),
  ];
  const snap = await getDocs(query(collection(db, "jobProfiles"), ...parts));
  return {
    people: snap.docs.map(d => ({ ...d.data(), uid: d.id })),
    cursor: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === CANDIDATE_PAGE,
  };
}

// The employer's own live, approved jobs (what they may shortlist for).
export async function loadMyLiveJobs(uid) {
  const snap = await getDocs(query(
    collection(db, "jobListings"),
    where("postedByUid", "==", uid), where("status", "==", "approved"), where("jobStatus", "==", "live"),
    orderBy("createdAt", "desc"), limit(50),
  ));
  return snap.docs.map(d => ({ ...normaliseJob({ id: d.id, ...d.data() }), shortlistCount: d.data().shortlistCount || 0 }));
}

// Someone who posted before job details were remembered on the account isn't
// an employer account to the rules yet: remember their latest job's business.
export async function rememberJobBusiness(uid, job) {
  const j = normaliseJob(job);
  await setDoc(doc(db, "users", uid), { jobBusiness: { name: j.businessName || "", industry: j.industry || "", city: j.city || "" } }, { merge: true });
}

const BUSY = "Couldn't shortlist right now. Please check your connection and try again.";
export class ShortlistError extends Error {
  constructor(message, code) { super(message); this.name = "ShortlistError"; this.code = code; }
}

// → { status: "shortlisted" | "already", applicationId, created, used, limit, leftToday }
// (limit and leftToday only when beta mode is off)
export async function shortlistFromSearch(jobId, candidateUid) {
  try {
    const res = await httpsCallable(functions, "shortlistCandidate", { timeout: 65000 })({ jobId, candidateUid });
    return res.data;
  } catch (e) {
    console.error("[find-candidates] shortlist failed:", e?.code, e?.message);
    // The function sends a plain sentence with its own code; anything else is technical.
    const code = e?.details?.code;
    throw new ShortlistError(code && e.message ? e.message : BUSY, code || "");
  }
}
