// L3: employer / job-seeker signals for the floating buttons. A few `limit 1`
// reads once per signed-in user, cached for the session; posting a job,
// saving a job profile or applying updates the cache straight away
// (markJobRole), so the buttons change without a reload.
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { isEmployerByAccount } from "../utils/jobRoles.js";

const cache = new Map(); // uid → { employer, seeker }
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

export function markJobRole(uid, role) {
  if (!uid) return;
  const cur = cache.get(uid) || { employer: false, seeker: false };
  if (cur[role]) return;
  cache.set(uid, { ...cur, [role]: true });
  notify();
}

async function hasAny(q) {
  try { return !(await getDocs(q)).empty; } catch (e) { console.warn("[job-roles] check failed:", e); return false; }
}

async function loadRoles(user) {
  const uid = user.uid;
  const employer = isEmployerByAccount(user)
    || await hasAny(query(collection(db, "jobListings"), where("postedByUid", "==", uid), limit(1)));
  let seeker = false;
  try { seeker = (await getDoc(doc(db, "jobProfiles", uid))).exists(); } catch (e) { console.warn("[job-roles] profile check failed:", e); }
  if (!seeker) seeker = await hasAny(query(collection(db, "jobApplications"), where("applicantUid", "==", uid), limit(1)));
  return { employer, seeker };
}

// Returns { employer, seeker } or null while loading / signed out.
export function useJobRoles(user) {
  const uid = user?.uid;
  const accountEmployer = isEmployerByAccount(user);
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  useEffect(() => {
    if (!uid || cache.has(uid) || user?.role === "admin" || user?.role === "hom_admin") return;
    let cancelled = false;
    loadRoles(user).then(r => {
      if (cancelled) return;
      const cur = cache.get(uid) || {};
      cache.set(uid, { employer: r.employer || !!cur.employer, seeker: r.seeker || !!cur.seeker });
      notify();
    });
    return () => { cancelled = true; };
  // `user` identity changes on every App render; uid and the account flag are what matter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, accountEmployer]);
  if (!uid) return null;
  const r = cache.get(uid);
  if (!r) return null;
  return { employer: r.employer || accountEmployer, seeker: r.seeker };
}
