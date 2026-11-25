// Jobs go live at once; TIN checks them afterwards (Admin → Jobs Review).
// Plain functions, zero React/Firebase imports — unit-tested in
// test/unit/jobModeration.test.js. Writes: src/lib/jobModeration.js.
//
// status: "approved" = public (with jobStatus live) · "taken_down" = hidden by
// TIN, and the employer can't see its applications until it's restored ·
// "pending" = posted before beta, waiting for "Approve all" · "rejected" =
// refused before beta, treated as taken down. firestore.rules isActivePoster()
// and storage.rules use the same two.
export const TAKEN_DOWN = ["taken_down", "rejected"];
export const isTakenDown = (job) => TAKEN_DOWN.includes(job?.status);
export const isWaiting = (job) => job?.status === "pending";
export const takedownReason = (job) => (isTakenDown(job) && typeof job?.takedown?.reason === "string" ? job.takedown.reason : "");

// The one word the poster sees on their own job.
export const jobBadge = (job) => (isTakenDown(job) ? "Taken down" : job?.status !== "approved" ? "Not live yet"
  : { paused: "Paused", filled: "Filled", closed: "Closed" }[job.jobStatus] || "Live");

// What approving or restoring a job writes: a job the employer had closed,
// filled or paused stays that way.
export const approvedFields = (job) => ({
  status: "approved",
  jobStatus: ["live", "paused", "filled", "closed"].includes(job?.jobStatus) ? job.jobStatus : "live",
});

// Job reports nobody has checked yet, one row per job, most reported first
// (then the latest). Jobs already taken down or deleted are left out.
export function groupReports(reports, jobsById) {
  const rows = {};
  for (const r of reports) {
    const job = jobsById[r.jobId];
    if (r.checkedAt || !job || isTakenDown(job)) continue;
    const row = (rows[r.jobId] ||= { job, reports: [], reasons: {}, latest: 0 });
    row.reports.push(r);
    row.reasons[r.reason] = (row.reasons[r.reason] || 0) + 1;
    row.latest = Math.max(row.latest, r.createdAt?.seconds || 0);
  }
  return Object.values(rows).sort((a, b) => b.reports.length - a.reports.length || b.latest - a.latest);
}
