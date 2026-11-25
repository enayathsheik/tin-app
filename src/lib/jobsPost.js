// Firestore writes for the Post-a-job wizard and reads for the store page's
// "Open jobs". Field shapes come from src/utils/jobDraft.js (unit-tested);
// firestore.rules (jobListings create/update) enforce the same:
//  - create: every job goes live at once, verified account or not (owner
//            decision for beta); "verified_business" only if really verified;
//  - edit:   never changes the status — live stays live, and a job TIN took
//            down stays down.
import {
  collection, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { markJobRole } from "./jobRoles";
import { addEntitlement, loadPricing } from "./pricing";
import { feeInForce } from "../utils/pricing.js";
import { normaliseJob } from "../utils/jobModel.js";
import { buildJobFields, changedContentKeys, rememberedBusiness } from "../utils/jobDraft.js";

export const isVerifiedAccount = (user) => user?.verificationStatus === "verified";

// The account's admin-set store link (users/{uid}.storeId → stores/{id}).
export async function loadLinkedStore(user) {
  if (!user?.storeId) return null;
  try {
    const snap = await getDoc(doc(db, "stores", user.storeId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.error("[post-job] Failed to load linked store:", e);
    return null;
  }
}

export async function loadJobForEdit(jobId) {
  const snap = await getDoc(doc(db, "jobListings", jobId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Remember the business details on the account for next time. Best-effort:
// a failure here never blocks posting.
async function rememberBusiness(uid, draft) {
  try {
    await setDoc(doc(db, "users", uid), { jobBusiness: rememberedBusiness(draft) }, { merge: true });
  } catch (e) {
    console.warn("[post-job] Could not remember business details:", e);
  }
}

// Returns { id, status }.
export async function createJob(user, draft, store) {
  const verified = isVerifiedAccount(user);
  const status = "approved";
  const fields = buildJobFields(draft, { storeId: store?.id || null });
  // L9: the job and its free-post entitlement (365 days) in one batch.
  const ref = doc(collection(db, "jobListings"));
  const pricing = await loadPricing();
  const batch = writeBatch(db);
  batch.set(ref, {
    ...fields,
    postedByUid: user.uid,
    postedByName: user.name || "",
    postedByType: verified ? "verified_business" : "individual",
    status,
    jobStatus: "live", // live/paused/filled/closed, separate from TIN's status
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  addEntitlement(batch, "job_post", user.uid, ref.id, feeInForce(pricing, "jobPostFee"));
  await batch.commit();
  await rememberBusiness(user.uid, draft);
  markJobRole(user.uid, "employer"); // L3 floating buttons
  return { id: ref.id, status };
}

// Returns { status, changed } — changed=false means nothing to save.
export async function updateJob(user, before, draft, store) {
  const status = before.status;
  const fields = buildJobFields(draft, { storeId: store?.id || null });
  if (before.storeId && !fields.storeId) delete fields.storeId; // never drop an existing link from the client
  const changed = changedContentKeys(before, fields);
  if (!changed.length) return { status, changed: false };
  const update = { ...Object.fromEntries(changed.map(k => [k, fields[k]])), updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "jobListings", before.id), update);
  await rememberBusiness(user.uid, draft);
  return { status, changed: true };
}

// Live jobs carrying this store's id, newest first (bounded). Needs the
// composite index jobListings: storeId, status, jobStatus, createdAt desc.
export async function fetchStoreOpenJobs(storeId, max = 20) {
  const snap = await getDocs(query(
    collection(db, "jobListings"),
    where("storeId", "==", storeId),
    where("status", "==", "approved"),
    where("jobStatus", "==", "live"),
    orderBy("createdAt", "desc"),
    limit(max),
  ));
  return snap.docs.map(d => normaliseJob({ id: d.id, ...d.data() }));
}
