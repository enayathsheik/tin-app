// Candidate job profile reads/writes (jobProfiles/{uid} shareable +
// jobProfilesPrivate/{uid} owner-only). Shapes: src/utils/jobProfile.js.
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { markJobRole } from "./jobRoles";
import { addEntitlement, loadPricing } from "./pricing";
import { feeInForce } from "../utils/pricing.js";
import { profileFromDocs, splitProfile } from "../utils/jobProfile.js";
import { isSearchable, searchFields } from "../utils/candidateSearch.js";

export const CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const CV_MAX_BYTES = 5 * 1024 * 1024;

export function validateCvFile(f) {
  if (!f) return "Choose a file.";
  const name = f.name.toLowerCase();
  const okExt = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
  if (!okExt || !CV_MIME_TYPES.includes(f.type)) return "Please upload a PDF or Word document (.pdf, .doc, .docx).";
  if (f.size > CV_MAX_BYTES) return "The file must be under 5 MB.";
  return null;
}

const safeName = (n) => n.replace(/[^\w.\- ]+/g, "_").slice(-80);

export async function loadJobProfile(user) {
  if (!user?.uid) return profileFromDocs(null, null, user);
  const [pub, priv] = await Promise.all([
    getDoc(doc(db, "jobProfiles", user.uid)),
    getDoc(doc(db, "jobProfilesPrivate", user.uid)),
  ]);
  return profileFromDocs(pub.exists() ? pub.data() : null, priv.exists() ? priv.data() : null, user);
}

export async function saveJobProfile(uid, profile, { isNew = false } = {}) {
  const { pub, priv } = splitProfile(profile);
  const answered = typeof pub.openToEmployers === "boolean" && pub.openToEmployers !== (profile.openToEmployersSaved ?? null);
  const stamp = {
    updatedAt: serverTimestamp(),
    ...(isNew ? { createdAt: serverTimestamp() } : {}),
    ...(answered ? { openToEmployersAt: serverTimestamp() } : {}),
  };
  await Promise.all([
    setDoc(doc(db, "jobProfiles", uid), { ...pub, ...stamp }, { merge: true }),
    setDoc(doc(db, "jobProfilesPrivate", uid), { ...priv, updatedAt: serverTimestamp() }, { merge: true }),
  ]);
  markJobRole(uid, "seeker"); // L3 floating buttons
  if (isNew) await recordProfileEntitlement(uid);
}

// A1: save only the "Let employers find and call me" answer on an existing
// profile. Visibility goes along because the rules check the two together
// (older profiles may not have it stored); the search fields too, so an older
// profile can be found by city and experience straight away.
export async function saveEmployerChoice(uid, openToEmployers, profile) {
  const { visibility } = profile;
  await updateDoc(doc(db, "jobProfiles", uid), {
    ...searchFields(profile), openToEmployers, visibility, searchable: isSearchable({ openToEmployers, visibility }),
    openToEmployersAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

// L9: a new job-seeker profile is free (launch) — record it for 365 days.
// Separate, best-effort write: a profile save never fails because of it
// (e.g. a re-created profile whose entitlement already exists).
async function recordProfileEntitlement(uid) {
  try {
    const pricing = await loadPricing();
    const batch = writeBatch(db);
    addEntitlement(batch, "job_profile", uid, uid, feeInForce(pricing, "profileFee"));
    await batch.commit();
  } catch (e) {
    console.warn("[job-profile] entitlement not recorded:", e);
  }
}

// Upload the candidate's saved CV (resumes/{uid}/profile/…). Returns the cv
// record for jobProfilesPrivate — a storage path, never a download link.
export async function uploadProfileCv(uid, file) {
  const err = validateCvFile(file);
  if (err) throw new Error(err);
  const path = `resumes/${uid}/profile/${Date.now()}_${safeName(file.name)}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return { path, fileName: file.name, contentType: file.type, size: file.size, uploadedAt: new Date().toISOString() };
}
