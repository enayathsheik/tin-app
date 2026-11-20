// Employer Desk reads/writes (Jobs redesign phase 5a). Rules:
// firestore.rules jobListings (poster update, jobStatus incl. "paused") and
// jobApplications (employer branch: employer stages, timeline grows by one,
// never out of a closed stage). Bulk + close use batched writes, so a batch
// either fully passes those rules or changes nothing.
import {
  collection, doc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, Timestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { stageUpdate } from "../utils/applications.js";
import { normaliseJob } from "../utils/jobModel.js";

export const DESK_PAGE_SIZE = 20;
const BATCH_MAX = 400; // well under Firestore's 500 writes per batch

// The poster's jobs, newest first, 20 at a time.
export async function loadDeskJobs(uid, cursor = null) {
  const parts = [where("postedByUid", "==", uid), orderBy("createdAt", "desc")];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limit(DESK_PAGE_SIZE));
  const snap = await getDocs(query(collection(db, "jobListings"), ...parts));
  return {
    jobs: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    cursor: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === DESK_PAGE_SIZE,
  };
}

// Up to `max` other live jobs by the same poster (job page business card).
export async function fetchPosterOpenJobs(postedByUid, max = 4) {
  const snap = await getDocs(query(
    collection(db, "jobListings"),
    where("postedByUid", "==", postedByUid),
    where("status", "==", "approved"),
    where("jobStatus", "==", "live"),
    orderBy("createdAt", "desc"),
    limit(max),
  ));
  return snap.docs.map(d => normaliseJob({ id: d.id, ...d.data() }));
}

// Firestore shape of a stage change (history `at` as Timestamps).
function toWrite(update) {
  return {
    ...update,
    stageHistory: update.stageHistory.map(e => ({ ...e, at: e.at instanceof Date ? Timestamp.fromDate(e.at) : e.at })),
    updatedAt: serverTimestamp(),
  };
}

// Move many applications to one stage with the same note. `apps` must
// already be filtered (bulkPlan / closePlan). `jobUpdate` (optional) is
// written in the LAST batch so the job only changes once every application
// before it has been updated. Returns the updated app objects.
async function writeStageBatches(apps, stage, byUid, note, jobUpdate = null) {
  const at = new Date();
  const updated = apps.map(a => ({ app: a, update: stageUpdate(a, stage, "employer", byUid, { note, at }) }));
  const chunks = [];
  for (let i = 0; i < updated.length; i += BATCH_MAX) chunks.push(updated.slice(i, i + BATCH_MAX));
  if (!chunks.length) chunks.push([]);
  for (let i = 0; i < chunks.length; i++) {
    const batch = writeBatch(db);
    for (const { app, update } of chunks[i]) batch.update(doc(db, "jobApplications", app.id), toWrite(update));
    if (jobUpdate && i === chunks.length - 1) batch.update(doc(db, "jobListings", jobUpdate.id), jobUpdate.data);
    await batch.commit();
  }
  return updated.map(({ app, update }) => ({ ...app, ...update }));
}

export function bulkMoveApplications(apps, stage, byUid, note = "") {
  return writeStageBatches(apps, stage, byUid, note);
}

// Close a vacancy: the job becomes "filled" or "closed" and the given open
// applications move to "closed" with the note — one batch for any normal
// shop (up to 400 applications).
export function closeVacancy(jobId, jobStatus, appsToClose, byUid, note = "") {
  return writeStageBatches(appsToClose, "closed", byUid, note, {
    id: jobId, data: { jobStatus, updatedAt: serverTimestamp() },
  });
}

export function setJobStatus(jobId, jobStatus) {
  return updateDoc(doc(db, "jobListings", jobId), { jobStatus, updatedAt: serverTimestamp() });
}
