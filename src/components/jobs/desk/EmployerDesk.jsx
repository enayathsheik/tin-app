import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { normaliseJob } from "../../../utils/jobModel.js";
import { ShareJobButton } from "../ShareJobButton";
import { VACANCY_TABS, deskCounts, isNew, isToReply, vacancyTab } from "../../../utils/employerDesk.js";
import { loadDeskJobs, setJobStatus } from "../../../lib/employerDesk";
import { loadApplicants } from "../../../lib/applications";
import { btnPrimary, card, heading } from "../jobsStyle";
import { JobPipeline } from "./JobPipeline";
import { CloseVacancySheet } from "./CloseVacancySheet";

const small = { minHeight: 40, padding: "0 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", fontFamily: "inherit" };
const outline = { ...small, background: "transparent", border: "1px solid var(--b3)", color: "var(--t1)" };
const STATUS_LABEL = { live: "Live", paused: "Paused", filled: "Filled", closed: "Closed" };
// Applicants are loaded up front only for jobs still in play (owner-approved plan).
const loadsUpFront = (j) => j.status === "approved" && ["live", "paused"].includes(vacancyTab(j));
// { [jobId]: applications } — a job whose applicants can't be read shows none.
const fetchApplicantsFor = (list) => Promise.all(list.map(j => loadApplicants(j.id)
  .then(a => [j.id, a])
  .catch(e => { console.error("[desk] applicants failed:", e); return [j.id, []]; })))
  .then(Object.fromEntries);

function ReviewBadge({ job }) {
  if (job.status === "approved") return null;
  const rejected = job.status === "rejected";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap", color: rejected ? "#b91c1c" : "#b45309", background: rejected ? "#fff0f0" : "#fffbeb", border: `1px solid ${rejected ? "#fecaca" : "#fde68a"}` }}>
      {rejected ? "Not approved" : "Waiting for review"}
    </span>
  );
}

// Employer Desk (Jobs redesign phase 5a): numbers, vacancies, and each
// job's applicants (pipeline + list). The poster's own jobs only — team
// access arrives in 5b. Used at /jobs/desk and in the Retailer Dashboard.
export function EmployerDesk({ user }) {
  const uid = user?.uid;
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("job");
  const [jobs, setJobs] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [appsByJob, setAppsByJob] = useState({});
  const [tab, setTab] = useState("live");
  const [closing, setClosing] = useState(null);
  const [error, setError] = useState("");

  const loadApps = useCallback((list) => fetchApplicantsFor(list)
    .then(found => setAppsByJob(prev => ({ ...prev, ...found }))), []);

  const loadPage = useCallback((after = null) => loadDeskJobs(uid, after)
    .then(page => {
      setJobs(prev => (after ? [...(prev || []), ...page.jobs] : page.jobs));
      setCursor(page.cursor); setHasMore(page.hasMore);
      return loadApps(page.jobs.filter(loadsUpFront));
    })
    .catch(e => {
      console.error("[desk] jobs failed:", e);
      setError("Couldn't load your jobs. Please try again.");
      setJobs(prev => prev || []);
    }), [uid, loadApps]);

  useEffect(() => { if (uid) loadPage(); }, [uid, loadPage]);

  // A job opened from a link (?job=…) whose applicants weren't loaded up front.
  const selected = jobs?.find(j => j.id === selectedId) || null;
  const needsApps = selected && !appsByJob[selected.id] ? selected : null;
  useEffect(() => {
    if (!needsApps) return;
    let cancelled = false;
    fetchApplicantsFor([needsApps]).then(found => { if (!cancelled) setAppsByJob(prev => ({ ...prev, ...found })); });
    return () => { cancelled = true; };
  }, [needsApps]);

  const select = (id) => { const p = new URLSearchParams(params); if (id) p.set("job", id); else p.delete("job"); setParams(p); };
  const patchJob = (id, data) => setJobs(js => js.map(j => (j.id === id ? { ...j, ...data } : j)));
  const changeStatus = async (job, jobStatus) => {
    const before = job.jobStatus;
    patchJob(job.id, { jobStatus }); setError("");
    try { await setJobStatus(job.id, jobStatus); }
    catch (e) { console.error("[desk] status failed:", e); patchJob(job.id, { jobStatus: before }); setError("Couldn't update the job: " + (e.message || e)); }
  };
  const startClose = async (job) => {
    if (!appsByJob[job.id]) await loadApps([job]);
    setClosing(job.id);
  };

  if (jobs === null) return <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>Loading…</div>;

  const counts = deskCounts(jobs, appsByJob);
  const actions = (j, compact = false) => {
    const t = vacancyTab(j);
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!compact && j.status === "approved" && <button type="button" onClick={() => select(j.id)} style={{ ...small, background: "#e85a2a", color: "#fff", border: "none" }}>Applicants · {(appsByJob[j.id] || []).length || (loadsUpFront(j) ? 0 : "…")}</button>}
        <Link to={`/jobs/${j.id}`} style={outline}>View</Link>
        {/* L6: share a live job straight from the Desk. */}
        {j.status === "approved" && t === "live" && <ShareJobButton job={normaliseJob(j)} style={outline} />}
        <Link to={`/jobs/${j.id}/edit`} style={outline}>✎ Edit</Link>
        {j.status === "approved" && t === "live" && <button type="button" onClick={() => changeStatus(j, "paused")} style={outline}>Pause</button>}
        {j.status === "approved" && t !== "live" && <button type="button" onClick={() => changeStatus(j, "live")} style={outline}>Reopen</button>}
        {j.status === "approved" && (t === "live" || t === "paused") && <button type="button" onClick={() => startClose(j)} style={{ ...outline, color: "#b45309", borderColor: "#fcd34d" }}>Close</button>}
      </div>
    );
  };
  const closingJob = jobs.find(j => j.id === closing);
  const closeSheet = closingJob && (
    <CloseVacancySheet job={normaliseJob(closingJob)} apps={appsByJob[closingJob.id] || []} employerUid={uid} onClose={() => setClosing(null)}
      onDone={(jobStatus, closedApps) => {
        patchJob(closingJob.id, { jobStatus });
        const m = new Map(closedApps.map(a => [a.id, a]));
        setAppsByJob(p => ({ ...p, [closingJob.id]: (p[closingJob.id] || []).map(a => m.get(a.id) || a) }));
        setClosing(null);
      }} />
  );

  // ── One job: its applicants ──
  if (selected) {
    const nj = normaliseJob(selected);
    const apps = appsByJob[selected.id];
    return (
      <div>
        <button type="button" onClick={() => select(null)} style={{ background: "none", border: "none", padding: 0, minHeight: 40, color: "var(--acc)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← All jobs</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ ...heading, fontSize: 24, margin: 0 }}>{nj.title}</h1>
            <div style={{ fontSize: 13, color: "var(--t3)" }}>{[nj.city, STATUS_LABEL[vacancyTab(selected)]].filter(Boolean).join(" · ")}</div>
          </div>
          <ReviewBadge job={selected} />
        </div>
        <div style={{ margin: "10px 0 14px" }}>{actions(selected, true)}</div>
        {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginBottom: 10 }}>⚠ {error}</div>}
        {apps ? (
          <JobPipeline job={nj} apps={apps} employer={{ uid, name: selected.businessName || user.name || "" }}
            onAppsChange={(list) => setAppsByJob(p => ({ ...p, [selected.id]: list }))} />
        ) : <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>Loading applicants…</div>}
        {closeSheet}
      </div>
    );
  }

  // ── Desk home ──
  const tabJobs = jobs.filter(j => vacancyTab(j) === tab);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h1 style={{ ...heading, fontSize: 26, margin: 0 }}>Employer Desk</h1>
          <div style={{ fontSize: 13, color: "var(--t3)" }}>Your jobs and applicants in one place</div>
        </div>
        <Link to="/jobs/post" style={{ ...btnPrimary, minHeight: 40, display: "inline-flex", alignItems: "center", textDecoration: "none", fontSize: 13 }}>+ Post a job</Link>
      </div>

      <div className="desk-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
        {[["Open jobs", counts.openJobs], ["New applicants", counts.newApplicants], ["Interviews this week", counts.interviewsThisWeek], ["To reply", counts.toReply]].map(([l, v]) => (
          <div key={l} style={{ ...card, padding: "10px 12px" }}>
            <div style={{ ...heading, fontSize: 26, lineHeight: 1, color: v && l !== "Open jobs" ? "var(--acc)" : "var(--t1)" }}>{v}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>
      <style>{"@media(max-width:560px){.desk-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}}"}</style>
      {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginBottom: 10 }}>⚠ {error}</div>}

      {jobs.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>💼</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>No jobs posted yet</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 12 }}>Post a job in five short steps. Applicants show up here.</div>
          <Link to="/jobs/post" style={{ ...btnPrimary, textDecoration: "none" }}>+ Post a job</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 6 }}>
            {VACANCY_TABS.map(t => {
              const n = jobs.filter(j => vacancyTab(j) === t.key).length;
              const on = tab === t.key;
              return (
                <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={on}
                  style={{ minHeight: 40, padding: "0 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                    border: on ? "1px solid var(--acc)" : "1px solid var(--b2)", background: on ? "#e85a2a14" : "var(--s2)", color: on ? "var(--acc)" : "var(--t2)" }}>
                  {t.label} · {n}
                </button>
              );
            })}
          </div>
          {tabJobs.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--t3)", padding: "16px 4px" }}>No {STATUS_LABEL[tab].toLowerCase()} jobs.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {tabJobs.map(j => {
                const nj = normaliseJob(j);
                const apps = appsByJob[j.id] || [];
                const fresh = apps.filter(isNew).length;
                const reply = apps.filter(isToReply).length;
                return (
                  <div key={j.id} style={{ ...card, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <button type="button" onClick={() => select(j.id)} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{nj.title}</div>
                        <div style={{ fontSize: 12, color: "var(--t3)" }}>{[nj.city, nj.headcount > 1 ? `${nj.headcount} people` : "", nj.workTypeLabels[0] || nj.legacyJobType].filter(Boolean).join(" · ")}</div>
                      </button>
                      <ReviewBadge job={j} />
                    </div>
                    {(fresh > 0 || reply > 0) && (
                      <div style={{ display: "flex", gap: 10, fontSize: 12, fontWeight: 700, marginTop: 6 }}>
                        {fresh > 0 && <span style={{ color: "var(--acc)" }}>● {fresh} new</span>}
                        {reply > 0 && <span style={{ color: "#b45309" }}>● {reply} to reply</span>}
                      </div>
                    )}
                    <div style={{ marginTop: 10 }}>{actions(j)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {hasMore && <button type="button" onClick={() => loadPage(cursor)} style={{ ...outline, marginTop: 12 }}>Load more jobs</button>}
        </>
      )}
      {closeSheet}
    </div>
  );
}
