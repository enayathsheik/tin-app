import { useEffect, useState } from "react";
import { loadAppliedJobIds } from "../lib/applications";
import { loadJobProfile } from "../lib/jobProfiles";

// Shared apply-to-job state for every page with an Apply button (job lists,
// job detail, saved jobs). The sheet itself is <JobApplyModal {...state} />:
// one tap when the profile has the basics, otherwise a short form that also
// fills the profile (Phase 4, docs/JOBS_BLUEPRINT.md §4).
export function useJobApply(user, isGuest, onRequireLogin) {
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [applyingJob, setApplyingJob] = useState(null);
  const [profile, setProfile] = useState(null); // null = not loaded yet

  const uid = user?.uid;
  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    loadAppliedJobIds(uid)
      .then(ids => { if (!cancelled) setAppliedJobIds(ids); })
      .catch(e => console.error("[jobs] Failed to load applied jobs:", e));
    return () => { cancelled = true; };
  }, [uid]);

  const openApply = (job) => {
    if (isGuest || !uid) { onRequireLogin(); return; }
    const raw = job?.raw || job;
    if (raw.postedByUid === uid) return;      // can't apply to your own listing
    if (appliedJobIds.has(raw.id)) return;     // already applied
    setApplyingJob(raw);
    if (!profile) {
      loadJobProfile(user)
        .then(setProfile)
        .catch(e => { console.error("[jobs] Failed to load job profile:", e); setProfile({ error: true }); });
    }
  };

  const closeApply = () => setApplyingJob(null);
  const markApplied = (jobId) => setAppliedJobIds(ids => new Set(ids).add(jobId));

  return { user, appliedJobIds, applyingJob, profile, setProfile, openApply, closeApply, markApplied };
}
