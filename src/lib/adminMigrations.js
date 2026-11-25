// One-time admin data fixes run from Admin → Launch tools (client SDK as the
// TIN admin; firestore.rules lets isAdmin() do these writes).
import { collection, deleteField, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase/config";
import { contactDocRef } from "./applications";
import { legacyContactMigration } from "../utils/applications.js";
import { entitlementForBackfill, loadPricing } from "./pricing";
import { entitlementId } from "../utils/pricing.js";
import { searchFields } from "../utils/candidateSearch.js";

const BATCH_MAX = 200; // 2 writes per application → 400 per batch

// L8: move phone / email / CV path from applications made before L8 into
// jobApplications/{id}/private/contact, mark CV presence, and record
// contactUnlockedAt for applications already at Shortlisted or later.
// Safe to run more than once (already-moved applications are skipped).
// Returns { scanned, moved }.
export async function migrateApplicationContacts() {
  const snap = await getDocs(collection(db, "jobApplications"));
  const work = snap.docs
    .map(d => ({ id: d.id, plan: legacyContactMigration({ id: d.id, ...d.data() }) }))
    .filter(x => x.plan);
  for (let i = 0; i < work.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const { id, plan } of work.slice(i, i + BATCH_MAX)) {
      batch.set(contactDocRef(id), { ...plan.contact, createdAt: serverTimestamp() }, { merge: true });
      const parent = { hasCv: plan.hasCv };
      for (const k of plan.removeKeys) parent[k] = deleteField();
      if (plan.unlock) parent.contactUnlockedAt = serverTimestamp();
      batch.update(doc(db, "jobApplications", id), parent);
    }
    await batch.commit();
  }
  return { scanned: snap.size, moved: work.length };
}

// A1: fill cityKey / expBand on job profiles saved before Find candidates.
// Never touches the person's "Let employers find and call me" answer (the
// rules allow the admin only these two fields). Safe to run more than once.
export async function backfillSearchFields() {
  const snap = await getDocs(collection(db, "jobProfiles"));
  const work = snap.docs
    .map(d => ({ id: d.id, now: d.data(), want: searchFields(d.data()) }))
    .filter(x => x.now.cityKey !== x.want.cityKey || x.now.expBand !== x.want.expBand);
  for (let i = 0; i < work.length; i += 400) {
    const batch = writeBatch(db);
    for (const { id, want } of work.slice(i, i + 400)) batch.update(doc(db, "jobProfiles", id), want);
    await batch.commit();
  }
  const said = (v) => snap.docs.filter(d => d.data().openToEmployers === v).length;
  return { scanned: snap.size, filled: work.length, yes: said(true), no: said(false) };
}

// L9: record an entitlement (365 days from when it was created) for every
// job-seeker profile and job post made before L9 that doesn't have one yet.
// Safe to run more than once. Returns { profiles, jobs, created }.
export async function backfillEntitlements() {
  const [pricing, profiles, jobs, existing] = await Promise.all([
    loadPricing({ fresh: true }),
    getDocs(collection(db, "jobProfiles")),
    getDocs(collection(db, "jobListings")),
    getDocs(collection(db, "entitlements")),
  ]);
  const have = new Set(existing.docs.map(d => d.id));
  const when = (data) => data.createdAt?.toDate?.() || new Date();
  const todo = [
    ...profiles.docs.map(d => ({ kind: "job_profile", uid: d.id, refId: d.id, fee: pricing.profileFee, start: when(d.data()) })),
    ...jobs.docs.filter(d => d.data().postedByUid).map(d => ({ kind: "job_post", uid: d.data().postedByUid, refId: d.id, fee: pricing.jobPostFee, start: when(d.data()) })),
  ].filter(x => !have.has(entitlementId(x.kind, x.refId)));
  for (let i = 0; i < todo.length; i += 400) {
    const batch = writeBatch(db);
    for (const x of todo.slice(i, i + 400)) {
      batch.set(doc(db, "entitlements", entitlementId(x.kind, x.refId)), entitlementForBackfill(x.kind, x.uid, x.refId, x.fee, x.start));
    }
    await batch.commit();
  }
  return { profiles: profiles.size, jobs: jobs.size, created: todo.length };
}
