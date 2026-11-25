// Admin → TIN Jobs Admin: everything about TIN Jobs in one place, for the TIN
// super admin only (src/lib/superAdmin.js decides what's shown; firestore.rules
// and storage.rules decide what can actually be read). Read-only except
// approve / reject (OverviewTab) and job pause / close / delete (JobActions).
import { useEffect, useMemo, useRef, useState } from "react";
import { isSuperAdmin } from "../../../lib/superAdmin";
import { loadContacts, loadJobsAdmin, resumeLinks } from "../../../lib/jobsAdmin";
import {
  BUSINESS_FILTER, BUSINESS_STATES, EMPTY_FILTERS, JOB_FILTER, JOB_STATES, LANE_OPTIONS, PROFILE_OPTIONS, SEEKER_FILTER,
  applicantExport, applicantRow, buildActivity, buildApprovals, buildBusinesses, buildEmployers, buildJobs, buildSeekers,
  businessExport, businessStateLabel, distinct, filterRows, jobExport, jobStateLabel, laneText, seekerExport, shortlistText, summarise,
} from "../../../utils/jobsAdmin.js";
import { stageLabel } from "../../../utils/applications.js";
import { exportSheets } from "../../../utils/exportExcel";
import { CandidatePage } from "./CandidatePage";
import { JobActions } from "./JobActions";
import { JobApplicantsPage } from "./JobApplicantsPage";
import { OverviewTab } from "./OverviewTab";
import { DataTable, Email, FilterBar, Phone, Pill, ResumeButton } from "./bits";
import { dash, fmtDate, linkBtn } from "./format";

const TABS = [["overview", "Overview"], ["businesses", "Businesses"], ["seekers", "Job Seekers"], ["jobs", "Jobs"]];

// `stores` = the directory App.jsx already loaded for the admin.
export function TinJobsAdmin({ stores }) {
  return isSuperAdmin() ? <Dashboard stores={stores} /> : <div style={{ padding: 24, color: "var(--t3)" }}>Only the TIN super admin can open this page.</div>;
}

function Dashboard({ stores: directory }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [load, setLoad] = useState({ key: -1, data: null, error: "" });
  const [tab, setTab] = useState("overview");
  const [filters, setFilters] = useState({ businesses: EMPTY_FILTERS, seekers: EMPTY_FILTERS, jobs: EMPTY_FILTERS });
  const [stack, setStack] = useState([]); // opened candidates / jobs, for Back
  const [decided, setDecided] = useState({}); // approvals just acted on, hidden until the reload
  // Read at load time only: a directory that arrives later doesn't restart the load.
  const directoryRef = useRef(directory);
  useEffect(() => { directoryRef.current = directory; }, [directory]);

  useEffect(() => {
    let cancelled = false;
    loadJobsAdmin(directoryRef.current)
      .then(data => { if (!cancelled) setLoad({ key: reloadKey, data, error: "" }); })
      .catch(e => {
        console.error("[jobs-admin] load failed:", e);
        if (!cancelled) setLoad(l => ({ key: reloadKey, data: l.data, error: e.message || String(e) }));
      });
    return () => { cancelled = true; };
  }, [reloadKey]);
  const loading = load.key !== reloadKey;

  const view = useMemo(() => {
    if (!load.data) return null;
    const { users, applications, stores, claims } = load.data;
    const jobs = buildJobs({ ...load.data });
    const seekers = buildSeekers(load.data);
    const employers = buildEmployers({ users, jobRows: jobs, stores });
    const approvals = buildApprovals({ users, claims, stores });
    const businesses = buildBusinesses({ users, jobRows: jobs, stores, claims, employers, approvals });
    return {
      jobs, seekers, businesses, approvals,
      activity: buildActivity({ users, jobRows: jobs, applications }),
      sum: summarise({ users, seekers, employers, businesses, jobRows: jobs, applications }),
      jobsById: Object.fromEntries(jobs.map(j => [j.id, j])),
      seekersById: Object.fromEntries(seekers.map(x => [x.uid, x])),
      appsByJob: applications.reduce((m, a) => { (m[a.jobId] = m[a.jobId] || []).push(a); return m; }, {}),
    };
  }, [load.data]);

  const push = (kind) => (id) => setStack(st => [...st, { kind, id }]);
  const openCandidate = push("candidate"), openJob = push("job");
  const setF = (t) => (f) => setFilters(all => ({ ...all, [t]: f }));

  if (!view) {
    return load.error
      ? <div role="alert" style={{ padding: 24 }}><div style={{ color: "#b91c1c", marginBottom: 10 }}>⚠ {load.error}</div><button type="button" className="btn-sm btn-out" onClick={() => setReloadKey(k => k + 1)}>Try again</button></div>
      : <div style={{ padding: 24, color: "var(--t3)" }}>Loading…</div>;
  }

  const { jobs, seekers, businesses, activity, sum, jobsById, seekersById, appsByJob } = view;
  const approvals = view.approvals.filter(a => !decided[a.key]);
  const reload = () => setReloadKey(k => k + 1);
  const onDecided = (key) => { setDecided(d => ({ ...d, [key]: true })); reload(); };
  const top = stack[stack.length - 1];
  if (top) {
    return (
      <div>
        <button type="button" className="btn-sm btn-out" style={{ marginBottom: 14 }} onClick={() => setStack(st => st.slice(0, -1))}>← Back</button>
        {top.kind === "candidate" && seekersById[top.id] && <CandidatePage key={top.id} seeker={seekersById[top.id]} jobsById={jobsById} onOpenJob={openJob} />}
        {top.kind === "job" && jobsById[top.id] && <JobApplicantsPage key={top.id} job={jobsById[top.id]} applications={appsByJob[top.id] || NONE} seekersById={seekersById} onOpenCandidate={openCandidate}
          actions={<JobActions job={jobsById[top.id]} onChanged={(deleted) => { if (deleted) setStack(st => st.filter(x => !(x.kind === "job" && x.id === top.id))); reload(); }} />} />}
      </div>
    );
  }

  const st = sum.jobsByState, bs = sum.businessesByState;
  const cards = [
    [sum.seekers, "Job seekers", `${sum.seekersWithProfile} with a job profile`],
    [sum.businesses, "Businesses", [`${bs.approved} approved`, `${bs.pending} pending approval`, `${bs.none} not verified`, ...(bs.rejected ? [`${bs.rejected} rejected`] : [])].join(" · ")],
    [sum.jobs, "Jobs posted", [`${st.open} open`, `${st.paused} paused`, `${st.closed} closed`, `${st.filled} filled`,
      ...(st.pending ? [`${st.pending} in review`] : []), ...(st.rejected ? [`${st.rejected} rejected`] : [])].join(" · ")],
    [sum.applications, "Applications", ""],
    [sum.shortlists, "Shortlists", ""],
    [sum.signupsToday, "New sign-ups today", `${sum.accounts} accounts in all`],
    [sum.signupsWeek, "New sign-ups this week", "Since Monday"],
  ];

  return (
    <div>
      <div className="admin-hd" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div className="admin-title">TIN Jobs Admin</div>
          <div className="admin-sub">Every business, job seeker, job and application. Only you can see this page. Please keep exported files private — resume links in them open without a login.</div>
        </div>
        <button type="button" className="btn-sm btn-out" disabled={loading} onClick={() => setReloadKey(k => k + 1)}>{loading ? "Loading…" : "↻ Refresh"}</button>
      </div>
      {load.error && <div role="alert" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>⚠ {load.error}</div>}

      <div className="admin-stats">
        {cards.map(([v, l, d]) => (
          <div key={l} className="as-card"><div className="as-val">{v.toLocaleString("en-IN")}</div><div className="as-lbl">{l}</div>{d && <div className="as-delta">{d}</div>}</div>
        ))}
      </div>

      <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--b2)", background: tab === id ? "var(--acc)" : "#fff", color: tab === id ? "#fff" : "var(--t1)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {label}{id === "overview" ? (approvals.length ? ` (${approvals.length} to approve)` : "") : ` (${{ seekers, businesses, jobs }[id].length})`}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab approvals={approvals} activity={activity} onChanged={onDecided} onOpenJob={openJob} onOpenCandidate={openCandidate} seekersById={seekersById} />}
      {tab === "seekers" && <SeekersTab seekers={seekers} f={filters.seekers} set={setF("seekers")} onOpen={openCandidate} />}
      {tab === "businesses" && <BusinessesTab businesses={businesses} f={filters.businesses} set={setF("businesses")} />}
      {tab === "jobs" && <JobsTab jobs={jobs} f={filters.jobs} set={setF("jobs")} onOpen={openJob} appsByJob={appsByJob} seekersById={seekersById} onChanged={reload} />}
    </div>
  );
}
const NONE = [];

function SeekersTab({ seekers, f, set, onOpen }) {
  const rows = filterRows(seekers, f, SEEKER_FILTER);
  const doExport = async () => {
    const links = await resumeLinks(rows.map(r => r.resume));
    exportSheets([{ name: "Job seekers", rows: rows.map((r, i) => seekerExport(r, links[i])) }], "tin-job-seekers");
  };
  return (
    <>
      <FilterBar f={f} set={set} searchHint="Search name, mobile, email, skill…" cities={distinct(seekers.map(r => r.city))}
        roles={distinct(seekers.flatMap(SEEKER_FILTER.roles))} roleLabel="All roles / trades" lanes={LANE_OPTIONS} statuses={PROFILE_OPTIONS} statusLabel="All profiles" dateLabel="Joined" count={rows.length} total={seekers.length} onExport={doExport} />
      <DataTable rows={rows} rowKey={r => r.uid} empty="No job seekers found." minWidth={1400} columns={[
        ["Name", r => <button type="button" style={linkBtn} onClick={() => onOpen(r.uid)}>{r.name}</button>],
        ["Mobile", r => <Phone value={r.phone} />],
        ["Email", r => <Email value={r.email} />],
        ["City", r => dash(r.city)],
        ["Lane", r => dash(laneText(r.lane))],
        ["Profile", r => <Pill kind={r.profile}>{r.profile}</Pill>],
        ["Role / skills", r => <>{dash(r.roleText)}{r.skills.length > 0 && <div style={{ fontSize: 11, color: "var(--t3)" }}>{r.skills.slice(0, 5).join(", ")}{r.skills.length > 5 ? "…" : ""}</div>}</>],
        ["Exp. (yrs)", r => dash(r.experienceYears)],
        ["Expected pay", r => <>{dash(r.expectedPay)}{r.payHidden && <div style={{ fontSize: 11, color: "var(--t3)" }}>hidden from employers</div>}</>],
        ["Joined", r => fmtDate(r.joined)],
        ["Resume", r => <ResumeButton resume={r.resume} />],
        ["Applied", r => r.applied],
        ["Shortlisted", r => r.shortlisted],
      ]} />
    </>
  );
}

function BusinessesTab({ businesses, f, set }) {
  const rows = filterRows(businesses, f, BUSINESS_FILTER);
  const doExport = async () => exportSheets([{ name: "Businesses", rows: rows.map(businessExport) }], "tin-businesses");
  return (
    <>
      <FilterBar f={f} set={set} searchHint="Search business, contact, mobile, email…" cities={distinct(businesses.map(r => r.city))}
        roles={distinct(businesses.flatMap(BUSINESS_FILTER.roles))} roleLabel="All business types" statuses={BUSINESS_STATES} dateLabel="Joined" count={rows.length} total={businesses.length} onExport={doExport} />
      <DataTable rows={rows} rowKey={r => r.key} empty="No businesses found." minWidth={1050} columns={[
        ["Business", r => (r.storeId ? <a href={`/store/${r.storeId}`} target="_blank" rel="noreferrer" style={{ color: "var(--acc)", fontWeight: 700 }}>{r.business || "Store page"}</a> : <b>{dash(r.business)}</b>)],
        ["Owner / contact", r => dash(r.contact)],
        ["Mobile", r => <Phone value={r.phone} />],
        ["Email", r => <Email value={r.email} />],
        ["City", r => dash(r.city)],
        ["Type", r => dash(r.type)],
        ["Status", r => <><Pill kind={r.state}>{businessStateLabel(r.state)}</Pill>{r.state === "approved" && <div style={{ fontSize: 11, color: "var(--t3)" }}>{r.verified === "Verified" ? "account verified" : r.verified === "Store verified" ? "store verified" : "business linked"}</div>}</>],
        ["Jobs posted", r => <>{r.jobs}{r.openJobs > 0 && <span style={{ fontSize: 11, color: "var(--t3)" }}> ({r.openJobs} open)</span>}</>],
        ["Shortlists used", r => (r.jobs ? `${r.slots}/${r.slotsTotal}` : "0")],
        ["Joined", r => fmtDate(r.created)],
      ]} />
    </>
  );
}

function JobsTab({ jobs, f, set, onOpen, appsByJob, seekersById, onChanged }) {
  const rows = filterRows(jobs, f, JOB_FILTER);
  // Two sheets: the jobs, and every applicant of those jobs with contact + resume link.
  const doExport = async () => {
    const pairs = rows.flatMap(job => (appsByJob[job.id] || []).map(app => ({ job, app })));
    const contacts = await loadContacts(pairs.map(x => x.app.id));
    const applicants = pairs.map(({ job, app }) => ({ job, row: applicantRow(app, seekersById[app.applicantUid], contacts[app.id], stageLabel) }));
    const links = await resumeLinks(applicants.map(x => x.row.resume));
    exportSheets([
      { name: "Jobs", rows: rows.map(jobExport) },
      { name: "Applicants", rows: applicants.map((x, i) => applicantExport(x.job, x.row, links[i])) },
    ], "tin-jobs");
  };
  return (
    <>
      <FilterBar f={f} set={set} searchHint="Search title, employer, city…" cities={distinct(jobs.map(r => r.city))}
        roles={distinct(jobs.flatMap(JOB_FILTER.roles))} roleLabel="All roles / trades" statuses={JOB_STATES.map(x => [x.key, x.label])} dateLabel="Posted" count={rows.length} total={jobs.length} onExport={doExport} />
      <DataTable rows={rows} rowKey={r => r.id} empty="No jobs found." minWidth={1080} columns={[
        ["Title", r => <button type="button" style={linkBtn} onClick={() => onOpen(r.id)}>{r.title}</button>],
        ["Business", r => dash(r.employer)],
        ["City", r => dash(r.city)],
        ["Role", r => dash(r.roles.join(", "))],
        ["Status", r => <Pill kind={r.state}>{jobStateLabel(r.state)}</Pill>],
        ["Posted", r => fmtDate(r.created)],
        ["Applications", r => r.applicants],
        ["Shortlists used", r => <span style={{ fontWeight: r.full ? 800 : 400 }}>{shortlistText(r)}</span>],
        ["Actions", r => <JobActions job={r} onChanged={onChanged} />],
      ]} />
    </>
  );
}
