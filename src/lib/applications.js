// Job applications: apply, candidate replies, employer stage moves, and
// opening CVs with a live access check (no permanent links for new CVs).
// Rules: firestore.rules jobApplications + storage.rules resumes/.
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, Timestamp,
} from "firebase/firestore";
import { getBlob, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { markJobRole } from "./jobRoles";
import { applicationSnapshot } from "../utils/jobProfile.js";
import { stageUpdate } from "../utils/applications.js";
import { validateCvFile } from "./jobProfiles";

const safeName = (n) => n.replace(/[^\w.\- ]+/g, "_").slice(-80);
export const applicationId = (jobId, uid) => `${jobId}_${uid}`;

// Copy a CV into this job's folder (resumes/{uid}/{jobId}/…) so access can
// be checked against THIS job's application. Source: a new File, or the
// candidate's saved profile CV. Returns { resumePath, resumeFileName } or {}.
async function placeCvForJob(uid, jobId, { file = null, profileCv = null }) {
  let blob, fileName, contentType;
  if (file) {
    const err = validateCvFile(file);
    if (err) throw new Error(err);
    blob = file; fileName = file.name; contentType = file.type;
  } else if (profileCv?.path) {
    blob = await getBlob(ref(storage, profileCv.path));
    fileName = profileCv.fileName || "CV"; contentType = profileCv.contentType || blob.type;
  } else {
    return {};
  }
  const resumePath = `resumes/${uid}/${jobId}/${Date.now()}_${safeName(fileName)}`;
  await uploadBytes(ref(storage, resumePath), blob, { contentType });
  return { resumePath, resumeFileName: fileName };
}

// cvChoice: "profile" | "upload" | "none" (none → employer sees the TIN Profile card).
export async function submitApplication(user, job, profile, { message = "", cvChoice = "none", file = null } = {}) {
  const raw = job.raw || job;
  const jobId = raw.id;
  const cv = cvChoice === "upload" ? await placeCvForJob(user.uid, jobId, { file })
    : cvChoice === "profile" ? await placeCvForJob(user.uid, jobId, { profileCv: profile.cv })
    : {};
  const snap = applicationSnapshot(profile);
  const now = new Date();
  await setDoc(doc(db, "jobApplications", applicationId(jobId, user.uid)), {
    jobId,
    applicantUid: user.uid,
    ...snap,
    message: (message || "").trim().slice(0, 1000),
    ...cv,
    // Shown to the candidate even if the job later stops being readable.
    jobSnapshot: { title: raw.jobTitle || "", businessName: raw.businessName || raw.postedByName || "", city: raw.city || "" },
    stage: "submitted",
    stageHistory: [{ stage: "submitted", at: Timestamp.fromDate(now), by: "candidate", byUid: user.uid }],
    applicantStatus: "new", // kept for older screens
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  markJobRole(user.uid, "seeker"); // L3 floating buttons
  return applicationId(jobId, user.uid);
}

export async function loadAppliedJobIds(uid) {
  const snap = await getDocs(query(collection(db, "jobApplications"), where("applicantUid", "==", uid)));
  return new Set(snap.docs.map(d => d.data().jobId));
}

// The candidate's applications with their jobs (job may be null if it's no
// longer readable — the jobSnapshot still shows title/business).
export async function loadMyApplications(uid) {
  const snap = await getDocs(query(collection(db, "jobApplications"), where("applicantUid", "==", uid)));
  const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const jobs = await Promise.all(apps.map(a => getDoc(doc(db, "jobListings", a.jobId)).then(s => (s.exists() ? { id: s.id, ...s.data() } : null)).catch(() => null)));
  return apps
    .map((a, i) => ({ ...a, job: jobs[i] }))
    .sort((x, y) => (y.updatedAt?.seconds || y.createdAt?.seconds || 0) - (x.updatedAt?.seconds || x.createdAt?.seconds || 0));
}

export async function loadApplicants(jobId) {
  const snap = await getDocs(query(collection(db, "jobApplications"), where("jobId", "==", jobId)));
  const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  apps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return apps;
}

// Stage change by either side. Returns the new app object for the UI.
export async function moveApplication(app, stage, by, byUid, opts = {}) {
  const update = stageUpdate(app, stage, by, byUid, { ...opts, at: new Date() });
  const toWrite = {
    ...update,
    stageHistory: update.stageHistory.map(e => ({ ...e, at: e.at instanceof Date ? Timestamp.fromDate(e.at) : e.at })),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "jobApplications", app.id), toWrite);
  return { ...app, ...update };
}

// Candidate asks for another interview time (stage unchanged).
export async function requestReschedule(app, note) {
  const interviewResponse = { type: "reschedule_request", note: (note || "").trim().slice(0, 500), at: Timestamp.fromDate(new Date()) };
  await updateDoc(doc(db, "jobApplications", app.id), { interviewResponse, updatedAt: serverTimestamp() });
  return { ...app, interviewResponse };
}

// Open a CV: new CVs via a live, rules-checked fetch (no lasting link);
// old applications via their saved link. `win` = a tab opened synchronously
// on click (so pop-up blockers allow it).
export async function openApplicationCv(app, win) {
  if (app.resumePath) {
    const blob = await getBlob(ref(storage, app.resumePath));
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url; else window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  if (app.resumeUrl) {
    if (win) win.location.href = app.resumeUrl; else window.open(app.resumeUrl, "_blank", "noopener");
  }
}
