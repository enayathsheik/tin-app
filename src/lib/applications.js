// Job applications: apply, candidate replies, employer stage moves, and
// opening CVs with a live access check (no permanent links for new CVs).
// Rules: firestore.rules jobApplications + storage.rules resumes/.
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { getBlob, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { markJobRole } from "./jobRoles";
import { writeFirstShortlist } from "./shortlist";
import { applicationContact, applicationSnapshot } from "../utils/jobProfile.js";
import { isContactUnlocked, stageUpdate } from "../utils/applications.js";
import { validateCvFile } from "./jobProfiles";

const safeName = (n) => n.replace(/[^\w.\- ]+/g, "_").slice(-80);
export const applicationId = (jobId, uid) => `${jobId}_${uid}`;
// L8: phone, email and CV path live here, readable by the employer only once
// the application reached Shortlisted or later (firestore.rules).
export const contactDocRef = (appId) => doc(db, "jobApplications", appId, "private", "contact");

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
  const appId = applicationId(jobId, user.uid);
  // L8: one batch — the application the employer reads now (no contact, no
  // CV path) + the private contact doc they can read once they shortlist.
  const batch = writeBatch(db);
  batch.set(doc(db, "jobApplications", appId), {
    jobId,
    applicantUid: user.uid,
    ...snap,
    message: (message || "").trim().slice(0, 1000),
    hasCv: !!cv.resumePath,
    // Shown to the candidate even if the job later stops being readable.
    jobSnapshot: { title: raw.jobTitle || "", businessName: raw.businessName || raw.postedByName || "", city: raw.city || "" },
    stage: "submitted",
    stageHistory: [{ stage: "submitted", at: Timestamp.fromDate(now), by: "candidate", byUid: user.uid }],
    applicantStatus: "new", // kept for older screens
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(contactDocRef(appId), { ...applicationContact(profile), ...cv, createdAt: serverTimestamp() });
  await batch.commit();
  markJobRole(user.uid, "seeker"); // L3 floating buttons
  return appId;
}

// L8: the applicant's phone / email / CV for this application, or null when
// still locked (not shortlisted yet) or missing. Old applications (before
// L8) carry these on the application itself until the admin migration runs.
export async function loadApplicationContact(app) {
  const legacy = app.applicantPhone || app.applicantEmail || app.resumePath || app.resumeUrl;
  if (legacy) return { applicantPhone: app.applicantPhone || "", applicantEmail: app.applicantEmail || "", resumePath: app.resumePath || "", resumeFileName: app.resumeFileName || "", resumeUrl: app.resumeUrl || "" };
  if (!isContactUnlocked(app)) return null;
  try {
    const snap = await getDoc(contactDocRef(app.id));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("[applications] contact not readable:", e);
    return null;
  }
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
    ...(update.contactUnlockedAt ? { contactUnlockedAt: serverTimestamp() } : {}), // L8
    updatedAt: serverTimestamp(),
  };
  // L10: a first shortlist also takes a shortlist slot (same batch).
  if (update.contactUnlockedAt) {
    const slot = await writeFirstShortlist(app, toWrite);
    return { ...app, ...update, shortlistSlot: slot, _jobShortlistCount: slot };
  }
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
// on click (so pop-up blockers allow it). `app` = application merged with
// its contact (loadApplicationContact) — the CV path lives there since L8.
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
