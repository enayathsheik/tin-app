// Admin → Jobs Review. Jobs go live at once, so this is the check afterwards:
// new jobs (newest first), job reports (most reported first), take down with a
// reason / restore, and block an account from posting. Jobs still waiting from
// before beta can all be approved at once. Enforced by firestore.rules.
import { useCallback, useEffect, useState } from "react";
import { REPORT_REASONS } from "../../lib/jobsFeed";
import {
  approveJobs, blockPosting, loadBlockedAccounts, loadNewestJobs, loadReportedJobs, loadTakenDownJobs, loadWaitingJobs,
  markReportsChecked, restoreJob, takeDownJob, unblockPosting,
} from "../../lib/jobModeration";
import { normaliseJob } from "../../utils/jobModel.js";
import { isTakenDown, isWaiting, jobBadge, takedownReason } from "../../utils/jobModeration.js";

const danger = { color: "#b91c1c", border: "1px solid #fecaca", background: "#fff" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 };
const box = { background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--rl)", padding: 14 };
const REASONS = { takedown: REPORT_REASONS.filter(([k]) => k !== "other").map(([, l]) => l), block: ["Fake or scam jobs", "Asks people for money", "Recruitment agency, not direct hiring"] };
const when = (t) => (t?.toDate ? t.toDate().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const reasonLabel = (k) => REPORT_REASONS.find(([x]) => x === k)?.[1] || "Something else";

// One-step "why?" form: a reason is always needed, and the employer sees it.
function ReasonForm({ kind, action, hint, busy, onCancel, onSubmit }) {
  const [reason, setReason] = useState("");
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(reason); }} style={{ marginTop: 10, background: "#fff", border: "1px solid #fecaca", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {REASONS[kind].map(r => <button key={r} type="button" className="btn-sm btn-out" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => setReason(r)}>{r}</button>)}
      </div>
      <textarea className="fta" rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (the employer sees this)" aria-label="Reason the employer sees" />
      <div style={{ fontSize: 11, color: "var(--t3)", margin: "4px 0 8px" }}>{hint}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" className="btn-sm" disabled={busy || !reason.trim()} style={{ background: "#b91c1c", color: "#fff", opacity: reason.trim() ? 1 : 0.5 }}>{busy ? "Saving…" : action}</button>
        <button type="button" className="btn-sm btn-out" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function JobBody({ j }) {
  // Wizard jobs keep their content in responsibilities/skills/pay (description
  // is empty): show it all, so the admin sees what the public sees.
  const n = normaliseJob(j);
  return (
    <>
      {n.payText && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--acc)", marginTop: 4 }}>{n.payText}{n.pay?.incentives ? ` · ${n.pay.incentives}` : ""}</div>}
      {(n.industryLabel || n.lane === "skilled" || n.headcount > 1) && (
        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
          {[n.lane === "skilled" ? `Skilled${n.tradeLabel ? ` · ${n.tradeLabel}` : ""}` : null, n.industryLabel, n.headcount > 1 ? `${n.headcount} people` : null].filter(Boolean).join(" · ")}
        </div>
      )}
      {n.description && <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 6, whiteSpace: "pre-wrap" }}>{n.description}</div>}
      {n.responsibilities.length > 0 && <ul style={{ fontSize: 12, color: "var(--t2)", margin: "6px 0 0", paddingLeft: 16 }}>{n.responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul>}
      {n.skills.length > 0 && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Skills: {n.skills.join(", ")}</div>}
      {n.evpText && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Why join: {n.evpText}</div>}
    </>
  );
}

function JobCard({ j, blocked, act, busy, children }) {
  const [form, setForm] = useState("");
  const down = isTakenDown(j);
  const badge = jobBadge(j);
  const run = (fn) => act(fn).then(ok => { if (ok) setForm(""); });
  return (
    <div style={box} data-job={j.id}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <a href={`/jobs/${j.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{j.jobTitle || "(untitled job)"}</a>
        <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", color: down ? "#b91c1c" : badge === "Live" ? "#15803d" : "#b45309" }}>{badge}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{[j.businessName || j.postedByName, j.city, j.jobType].filter(Boolean).join(" · ")}</div>
      <div style={{ fontSize: 11, color: "var(--t3)" }}>Posted {when(j.createdAt)} · {j.postedByType === "verified_business" ? <b style={{ color: "#16a34a" }}>✓ Verified business</b> : "Not verified"}</div>
      {children}
      <JobBody j={j} />
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>Contact: {j.contactPhone || "—"}</div>
      {!j.notAgencyDeclaration && <div style={{ fontSize: 11, marginTop: 4, color: "#dc2626", fontWeight: 600 }}>⚠ Agency declaration missing</div>}
      {down && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 6 }}>Taken down{j.takedown?.at ? ` ${when(j.takedown.at)}` : ""}: {takedownReason(j) || "no reason saved"}</div>}
      {blocked && <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginTop: 6 }}>🚫 This account is blocked from posting</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {isWaiting(j) && <button type="button" className="btn-sm btn-ok" disabled={busy} onClick={() => run(() => approveJobs([j]))}>✓ Approve</button>}
        {down ? <button type="button" className="btn-sm btn-ok" disabled={busy} onClick={() => run(() => restoreJob(j))}>↩ Restore</button>
          : <button type="button" className="btn-sm" style={danger} disabled={busy} onClick={() => setForm(form === "down" ? "" : "down")}>✕ Take down</button>}
        {blocked ? <button type="button" className="btn-sm btn-out" disabled={busy} onClick={() => run(() => unblockPosting(j.postedByUid))}>Unblock account</button>
          : j.postedByUid && <button type="button" className="btn-sm btn-out" disabled={busy} onClick={() => setForm(form === "block" ? "" : "block")}>🚫 Block from posting</button>}
      </div>
      {form === "down" && <ReasonForm kind="takedown" action="Take down" busy={busy} onCancel={() => setForm("")} onSubmit={r => run(() => takeDownJob(j.id, r))}
        hint="Hides the job and closes its applicants’ details to the employer. You can restore it." />}
      {form === "block" && <ReasonForm kind="block" action="Block from posting" busy={busy} onCancel={() => setForm("")} onSubmit={r => run(() => blockPosting(j.postedByUid, r))}
        hint="They can’t post, edit or reopen jobs, or shortlist from search. Their other jobs stay up until you take them down." />}
    </div>
  );
}

const EMPTY = { newest: { jobs: [], cursor: null, hasMore: false }, reported: [], waiting: [], down: [], blocked: [] };

export function JobsReviewSection() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [notice, setNotice] = useState("");

  // Each list on its own, so one that fails doesn't hide the rest.
  const load = useCallback(async () => {
    const failed = [];
    const get = (name, p, empty) => p.catch(e => { console.error(`[jobs-review] ${name} failed:`, e); failed.push(name); return empty; });
    const [newest, reported, waiting, down, blocked] = await Promise.all([
      get("new jobs", loadNewestJobs(), EMPTY.newest), get("reports", loadReportedJobs(), []), get("waiting jobs", loadWaitingJobs(), []),
      get("taken-down jobs", loadTakenDownJobs(), []), get("blocked accounts", loadBlockedAccounts(), []),
    ]);
    setData({ newest, reported, waiting, down, blocked });
    setError(failed.length ? `Couldn't load: ${failed.join(", ")}. Please refresh.` : "");
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const act = async (fn) => {
    setBusy(true); setError(""); setNotice("");
    let ok = true;
    try { await fn(); await load(); } catch (e) {
      console.error("[jobs-review] action failed:", e);
      setError("Didn't work: " + (e.message || e));
      ok = false;
    }
    setBusy(false);
    return ok;
  };
  const more = async () => {
    setBusy(true);
    try {
      const r = await loadNewestJobs(data.newest.cursor);
      setData(d => ({ ...d, newest: { ...r, jobs: [...d.newest.jobs, ...r.jobs] } }));
    } catch (e) { setError("Couldn't load more: " + (e.message || e)); }
    setBusy(false);
  };
  const approveAll = async () => {
    const n = data.waiting.length;
    if (await act(() => approveJobs(data.waiting))) setNotice(`✓ ${n} ${n === 1 ? "job is" : "jobs are"} approved.`);
    setConfirmAll(false);
  };

  if (!data) return <div style={{ padding: 24, color: "var(--t3)" }}>Loading…</div>;
  const blockedIds = new Set(data.blocked.map(u => u.id));
  const cardProps = (j) => ({ j, act, busy, blocked: blockedIds.has(j.postedByUid) });
  const TABS = [["new", "New jobs", null], ["reports", "Reports", data.reported.length], ["waiting", "Waiting from before", data.waiting.length], ["down", "Taken down", data.down.length], ["blocked", "Blocked accounts", data.blocked.length]];
  const none = (text) => <div className="val-ok-banner"><span>✓</span><div>{text}</div></div>;

  return (
    <div>
      <div className="admin-hd">
        <div className="admin-title">Jobs Review</div>
        <div className="admin-sub">Jobs go live straight away. Check them here, and take down any that break the rules.</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(([k, l, n]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => { setTab(k); setConfirmAll(false); }}
            style={{ minHeight: 38, padding: "0 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              border: tab === k ? "1px solid var(--acc)" : "1px solid var(--b2)", background: tab === k ? "#e85a2a14" : "var(--s2)", color: tab === k ? "var(--acc)" : k === "reports" && n ? "#b91c1c" : "var(--t2)" }}>
            {l}{n ? ` · ${n}` : ""}
          </button>
        ))}
      </div>
      {error && <div role="alert" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}
      {notice && <div role="status" style={{ color: "#15803d", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{notice}</div>}

      {tab === "new" && (data.newest.jobs.length === 0 ? none("No jobs yet.") : <>
        <div style={grid}>{data.newest.jobs.map(j => <JobCard key={j.id} {...cardProps(j)} />)}</div>
        {data.newest.hasMore && <button type="button" className="btn-sm btn-out" style={{ marginTop: 14 }} disabled={busy} onClick={more}>Show older jobs</button>}
      </>)}

      {tab === "reports" && (data.reported.length === 0 ? none("No reports to check.") : (
        <div style={grid}>
          {data.reported.map(r => (
            <JobCard key={r.job.id} {...cardProps(r.job)}>
              <div style={{ background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", margin: "8px 0", fontSize: 12, color: "#b91c1c" }}>
                <b>⚑ Reported by {r.reports.length} {r.reports.length === 1 ? "person" : "people"}</b>
                {Object.entries(r.reasons).map(([k, n]) => <div key={k}>{reasonLabel(k)}{n > 1 ? ` × ${n}` : ""}</div>)}
                <button type="button" className="btn-sm btn-out" disabled={busy} style={{ marginTop: 6, padding: "4px 10px" }} onClick={() => act(() => markReportsChecked(r.reports))}>✓ Checked, job is fine</button>
              </div>
            </JobCard>
          ))}
        </div>
      ))}

      {tab === "waiting" && (data.waiting.length === 0 ? none("No jobs are waiting.") : <>
        <div style={{ ...box, marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: "var(--t2)", flex: "1 1 260px" }}>These were sent for approval before jobs went live straight away. Take down any you don’t want first.</div>
          {confirmAll ? <>
            <button type="button" className="btn-sm btn-ok" disabled={busy} onClick={approveAll}>{busy ? "Approving…" : `Yes, approve ${data.waiting.length}`}</button>
            <button type="button" className="btn-sm btn-out" disabled={busy} onClick={() => setConfirmAll(false)}>Cancel</button>
          </> : <button type="button" className="btn-sm btn-ok" disabled={busy} onClick={() => setConfirmAll(true)}>✓ Approve all pending jobs ({data.waiting.length})</button>}
        </div>
        <div style={grid}>{data.waiting.map(j => <JobCard key={j.id} {...cardProps(j)} />)}</div>
      </>)}

      {tab === "down" && (data.down.length === 0 ? none("No jobs are taken down.") : <div style={grid}>{data.down.map(j => <JobCard key={j.id} {...cardProps(j)} />)}</div>)}

      {tab === "blocked" && (data.blocked.length === 0 ? none("No accounts are blocked.") : (
        <div style={{ display: "grid", gap: 8, maxWidth: 640 }}>
          {data.blocked.map(u => (
            <div key={u.id} style={{ ...box, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{u.jobBusiness?.name || u.name || u.id}</div>
                <div style={{ fontSize: 12, color: "var(--t3)" }}>{[u.name, u.phone, u.email].filter(Boolean).join(" · ")}</div>
                <div style={{ fontSize: 12, color: "#b91c1c" }}>Blocked {when(u.postingBlockedAt)}: {u.postingBlockedReason}</div>
              </div>
              <button type="button" className="btn-sm btn-out" disabled={busy} onClick={() => act(() => unblockPosting(u.id))}>Unblock</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
