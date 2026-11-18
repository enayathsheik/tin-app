// Firestore writes for the Post-a-job wizard and reads for the store page's
// "Open jobs". Field shapes come from src/utils/jobDraft.js (unit-tested);
// approval logic mirrors firestore.rules (jobListings create/update):
//  - create: verified account → approved + live, otherwise pending;
//  - edit:   verified account keeps the current status; an unverified
//            poster's content edit goes back to pending (owner decision);
//            Live/Filled/Closed-only changes never need re-approval.
import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "../firebase/config";
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
  const status = verified ? "approved" : "pending";
  const fields = buildJobFields(draft, { storeId: store?.id || null });
  const ref = await addDoc(collection(db, "jobListings"), {
    ...fields,
    postedByUid: user.uid,
    postedByName: user.name || "",
    postedByType: verified ? "verified_business" : "individual",
    status,
    // jobStatus tracks live/filled/closed independent of moderation status,
    // and only makes sense once the listing is actually approved/visible.
    ...(status === "approved" ? { jobStatus: "live" } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await rememberBusiness(user.uid, draft);
  return { id: ref.id, status };
}

// Returns { status, changed } — changed=false means nothing to save.
export async function updateJob(user, before, draft, store) {
  const fields = buildJobFields(draft, { storeId: store?.id || null });
  if (before.storeId && !fields.storeId) delete fields.storeId; // never drop an existing link from the client
  const changed = changedContentKeys(before, fields);
  if (!changed.length) return { status: before.status, changed: false };

  const verified = isVerifiedAccount(user);
  const status = verified ? before.status : "pending";
  const update = { ...Object.fromEntries(changed.map(k => [k, fields[k]])), updatedAt: serverTimestamp() };
  if (status !== before.status) update.status = status;
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
