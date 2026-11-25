// Admin → Jobs Review: reads and writes (client SDK as the TIN super admin;
// firestore.rules allow only isAdmin() any of the writes). Job reports and
// the blocked list are admin-only reads. Shapes: src/utils/jobModeration.js.
import {
  collection, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { TAKEN_DOWN, approvedFields, groupReports } from "../utils/jobModeration.js";

export const REVIEW_PAGE = 30;
const BATCH_MAX = 400;
const rows = (snap) => snap.docs.map(d => ({ ...d.data(), id: d.id }));
const newestFirst = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);

// Every job, newest first, a page at a time.
export async function loadNewestJobs(cursor = null) {
  const snap = await getDocs(query(collection(db, "jobListings"), orderBy("createdAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(REVIEW_PAGE)));
  return { jobs: rows(snap), cursor: snap.docs[snap.docs.length - 1] || null, hasMore: snap.docs.length === REVIEW_PAGE };
}
export const loadWaitingJobs = async () => rows(await getDocs(query(collection(db, "jobListings"), where("status", "==", "pending")))).sort(newestFirst);
export const loadTakenDownJobs = async () => rows(await getDocs(query(collection(db, "jobListings"), where("status", "in", TAKEN_DOWN)))).sort(newestFirst);

// Unchecked reports, one row per job, most reported first.
export async function loadReportedJobs() {
  const reports = rows(await getDocs(collection(db, "jobReports"))).filter(r => !r.checkedAt);
  const ids = [...new Set(reports.map(r => r.jobId))];
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, "jobListings", id))));
  const jobsById = Object.fromEntries(snaps.filter(s => s.exists()).map(s => [s.id, { ...s.data(), id: s.id }]));
  return groupReports(reports, jobsById);
}
async function inBatches(list, write) {
  for (let i = 0; i < list.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    list.slice(i, i + BATCH_MAX).forEach(x => write(batch, x));
    await batch.commit();
  }
}
export const markReportsChecked = (reports) => inBatches(reports, (b, r) => b.update(doc(db, "jobReports", r.id), { checkedAt: serverTimestamp() }));

// Hides the job and ends the employer's access to its applications, contacts
// and CVs (rules). Nothing is deleted.
export const takeDownJob = (jobId, reason) => updateDoc(doc(db, "jobListings", jobId), { status: "taken_down", takedown: { reason: reason.trim().slice(0, 500), at: serverTimestamp() } });
export const restoreJob = (job) => updateDoc(doc(db, "jobListings", job.id), { ...approvedFields(job), takedown: deleteField() });
// The jobs on the admin's screen, so nothing unseen is approved.
export const approveJobs = (jobs) => inBatches(jobs, (b, j) => b.update(doc(db, "jobListings", j.id), approvedFields(j)));

export const loadBlockedAccounts = async () => rows(await getDocs(query(collection(db, "users"), where("postingBlocked", "==", true))));
export const blockPosting = (uid, reason) => setDoc(doc(db, "users", uid), { postingBlocked: true, postingBlockedReason: reason.trim().slice(0, 500), postingBlockedAt: serverTimestamp() }, { merge: true });
export const unblockPosting = (uid) => updateDoc(doc(db, "users", uid), { postingBlocked: deleteField(), postingBlockedReason: deleteField(), postingBlockedAt: deleteField() });

// The account's own block, if any: { reason } or null.
export async function loadMyPostingBlock(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.data()?.postingBlocked === true ? { reason: snap.data().postingBlockedReason || "" } : null;
  } catch (e) {
    console.warn("[jobs] posting block not readable:", e);
    return null;
  }
}
