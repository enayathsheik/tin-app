import { useState } from "react";
import { BULK_SET } from "../../../data/jobsTaxonomy.js";
import { currentStage, isContactUnlocked, isFinal, isFromSearch, shouldMarkViewed, stageLabel, unlocksContact } from "../../../utils/applications.js";
import { BOARD_COLUMNS, bulkPlan, defaultNote, groupByColumn, isNew, nextAction } from "../../../utils/employerDesk.js";
import { bulkMoveApplications } from "../../../lib/employerDesk";
import { moveApplication } from "../../../lib/applications";
import { useIsDesktop } from "../../../hooks/useIsDesktop";
import { StagePill } from "../ApplicationBits";
import { ApplicantDetail } from "./ApplicantDetail";
import { ShareJobButton } from "../ShareJobButton";
import { ShortlistMeter } from "./ShortlistMeter";
import { useShortlistLimit } from "../../../hooks/useShortlistLimit";
import { ShortlistFullError, shortlistCountOf } from "../../../utils/shortlist.js";
import { Sheet } from "./Sheet";
import { card } from "../jobsStyle";

const pillBtn = (on) => ({
  minHeight: 40, padding: "0 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
  border: on ? "1px solid var(--acc)" : "1px solid var(--b2)", background: on ? "#e85a2a14" : "var(--s2)", color: on ? "var(--acc)" : "var(--t2)",
});
const LIST_FILTERS = [["all", "All"], ["new", "New"], ["open", "Open"], ["closed", "Closed"]];
const sub = (a) => [a.profileSnapshot?.role, a.profileSnapshot?.experienceYears != null && a.profileSnapshot?.experienceYears !== "" ? `${a.profileSnapshot.experienceYears} yrs` : "", a.profileSnapshot?.city].filter(Boolean).join(" · ");

// Applicants of one job: pipeline board (phone: one column at a time) and
// list with bulk updates. Every move opens or uses the application sheet.
export function JobPipeline({ job, apps, employer, onAppsChange, onJobPatch = () => {} }) {
  const isDesktop = useIsDesktop();
  const shortlistLimit = useShortlistLimit(); // L10
  const [view, setView] = useState("board");
  const [col, setCol] = useState(() => (apps.some(isNew) ? "new" : BOARD_COLUMNS.find(c => groupByColumn(apps)[c.key].length)?.key || "new"));
  const [openId, setOpenId] = useState(null);
  const [startWith, setStartWith] = useState(null);
  const [filter, setFilter] = useState("all");
  const [checked, setChecked] = useState(() => new Set());
  const [bulkStage, setBulkStage] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { ok, text }

  // L10: a first shortlist returns the job's new shortlist count.
  const replace = (updated) => {
    if (updated._jobShortlistCount) onJobPatch({ shortlistCount: updated._jobShortlistCount });
    onAppsChange(apps.map(a => (a.id === updated.id ? updated : a)));
  };
  const replaceMany = (list) => { const m = new Map(list.map(a => [a.id, a])); onAppsChange(apps.map(a => m.get(a.id) || a)); };

  const open = (a, how = null) => {
    setOpenId(a.id); setStartWith(how);
    if (shouldMarkViewed(a)) moveApplication(a, "app_viewed", "employer", employer.uid).then(replace).catch(e => console.warn("[desk] mark viewed failed:", e));
  };
  const quickMove = async (a, to) => {
    setBusy(true); setNotice(null);
    try { replace(await moveApplication(a, to, "employer", employer.uid)); setNotice({ ok: true, text: `${a.applicantName || "Applicant"} → ${stageLabel(to)}` }); }
    catch (e) {
      console.error("[desk] move failed:", e);
      setNotice({ ok: false, text: e instanceof ShortlistFullError ? e.message : "Couldn't update: " + (e.message || e) });
      if (e instanceof ShortlistFullError) onJobPatch({ shortlistCount: e.limit });
    }
    setBusy(false);
  };
  const runNext = (a) => {
    const n = nextAction(a);
    if (!n) open(a);
    else if (n.action === "invite") open(a, "invite");
    else quickMove(a, n.stage);
  };

  const groups = groupByColumn(apps);
  const opened = apps.find(a => a.id === openId) || null;

  const renderCard = (a) => {
    const n = nextAction(a);
    return (
      <div key={a.id} style={{ ...card, padding: 10, display: "grid", gap: 6 }}>
        <button type="button" onClick={() => open(a)} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "grid", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{a.applicantName || "Applicant"}</span>
          {sub(a) && <span style={{ fontSize: 12, color: "var(--t3)" }}>{sub(a)}</span>}
          <span style={{ fontSize: 11, color: "var(--t3)" }}>{isFromSearch(a) ? "🔎 Found in search · " : ""}{stageLabel(currentStage(a))}{a.interviewResponse?.type === "reschedule_request" && ["int_invited", "int_rescheduled"].includes(currentStage(a)) ? " · asked for another time" : ""}</span>
        </button>
        {!isFinal(currentStage(a)) && (
          <div style={{ display: "flex", gap: 6 }}>
            {n && <button type="button" disabled={busy} onClick={() => runNext(a)} style={{ flex: 1, minHeight: 40, borderRadius: 8, border: "none", background: "#e85a2a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{n.label}</button>}
            <button type="button" onClick={() => open(a)} style={{ flex: n ? "0 0 auto" : 1, minHeight: 40, padding: "0 12px", borderRadius: 8, border: "1px solid var(--b3)", background: "transparent", color: "var(--t1)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Move…</button>
          </div>
        )}
      </div>
    );
  };

  // ── List view ──
  const listed = apps.filter(a => {
    const s = currentStage(a);
    return filter === "all" || (filter === "new" && s === "submitted") || (filter === "open" && !isFinal(s)) || (filter === "closed" && isFinal(s));
  });
  const toggle = (id) => setChecked(c => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = listed.length > 0 && listed.every(a => checked.has(a.id));
  const toggleAll = () => setChecked(c => { const n = new Set(c); listed.forEach(a => (allOn ? n.delete(a.id) : n.add(a.id))); return n; });
  const pickBulk = (s) => { setBulkStage(s); setBulkNote(defaultNote(s, job.lane)); };
  const selected = apps.filter(a => checked.has(a.id));
  const plan = bulkStage ? bulkPlan(selected, bulkStage) : null;
  // L10: how many of the bulk move would be first shortlists, vs slots left.
  const firstTimers = plan ? plan.update.filter(a => unlocksContact(bulkStage) && !isContactUnlocked(a)).length : 0;
  const slotsLeft = Math.max(0, shortlistLimit - shortlistCountOf(job));
  const willSkip = Math.max(0, firstTimers - slotsLeft);
  const applyBulk = async () => {
    if (!plan?.update.length) return;
    setBusy(true); setNotice(null);
    try {
      const res = await bulkMoveApplications(plan.update, bulkStage, employer.uid, bulkNote);
      replaceMany(res);
      if (res.jobShortlistCount) onJobPatch({ shortlistCount: res.jobShortlistCount });
      const over = res.overLimit?.length || 0; // L10
      if (over) onJobPatch({ shortlistCount: shortlistLimit });
      const skip = plan.skipped.closed + plan.skipped.same + plan.skipped.notFitting;
      const moved = res.length;
      setNotice({ ok: !over, text: `${moved} moved to ${stageLabel(bulkStage)}${skip ? ` · ${skip} skipped` : ""}${over ? ` · ${over} not shortlisted: you've used all ${shortlistLimit} shortlists for this job. Post another job to shortlist more.` : "."}` });
      setChecked(new Set()); setBulkStage(""); setBulkNote("");
    } catch (e) {
      console.error("[desk] bulk update failed:", e);
      setNotice({ ok: false, text: "Nothing was changed: " + (e.message || e) });
    }
    setBusy(false);
  };

  return (
    <div>
      <ShortlistMeter job={job} limit={shortlistLimit} />
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["board", "Pipeline"], ["list", "List · bulk"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} style={pillBtn(view === k)}>{l}</button>
        ))}
      </div>
      {notice && <div role="status" style={{ fontSize: 13, marginBottom: 10, padding: 8, borderRadius: 8, color: notice.ok ? "#15803d" : "#b91c1c", background: notice.ok ? "#f0fdf4" : "#fff0f0" }}>{notice.text}</div>}

      {apps.length === 0 ? (
        <div style={{ ...card, padding: "28px 16px", textAlign: "center", color: "var(--t3)", fontSize: 14 }}>
          No applicants yet. Share the job to reach more people:{" "}
          <ShareJobButton job={job} label="Share job" style={{ background: "none", border: "none", padding: 0, color: "var(--acc)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }} />
        </div>
      ) : view === "board" ? (
        isDesktop ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${BOARD_COLUMNS.length}, minmax(170px, 1fr))`, gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {BOARD_COLUMNS.map(c => (
              <div key={c.key} style={{ background: "var(--s2)", borderRadius: 10, padding: 8, display: "grid", gap: 8, alignContent: "start", minHeight: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--t2)", display: "flex", justifyContent: "space-between" }}><span>{c.label}</span><span>{groups[c.key].length}</span></div>
                {groups[c.key].map(a => renderCard(a))}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4 }}>
              {BOARD_COLUMNS.map(c => (
                <button key={c.key} type="button" onClick={() => setCol(c.key)} aria-pressed={col === c.key} style={pillBtn(col === c.key)}>
                  {c.label} · {groups[c.key].length}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {groups[col].length ? groups[col].map(a => renderCard(a)) : <div style={{ fontSize: 13, color: "var(--t3)", padding: 12 }}>Nobody here.</div>}
            </div>
          </>
        )
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {LIST_FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} style={pillBtn(filter === k)}>{l}</button>)}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--t2)", minHeight: 40 }}>
            <input type="checkbox" checked={allOn} onChange={toggleAll} style={{ width: 20, height: 20 }} /> Select all ({listed.length})
          </label>
          <div style={{ display: "grid", gap: 6 }}>
            {listed.map(a => (
              <div key={a.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
                <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.applicantName || "applicant"}`} style={{ width: 22, height: 22, flexShrink: 0 }} />
                <button type="button" onClick={() => open(a)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{a.applicantName || "Applicant"}</div>
                  {sub(a) && <div style={{ fontSize: 12, color: "var(--t3)" }}>{sub(a)}</div>}
                </button>
                <StagePill stage={currentStage(a)} />
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <div style={{ position: "sticky", bottom: 0, marginTop: 12, ...card, padding: 12, boxShadow: "0 -4px 16px #0001", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{selected.length} selected · move to:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {BULK_SET.map(s => <button key={s} type="button" onClick={() => pickBulk(s)} aria-pressed={bulkStage === s} style={pillBtn(bulkStage === s)}>{stageLabel(s)}</button>)}
              </div>
              {bulkStage && (
                <>
                  <textarea className="fta" rows={bulkNote ? 3 : 2} value={bulkNote} onChange={e => setBulkNote(e.target.value)} placeholder="Note for the candidates (optional)" aria-label="Note for the candidates" />
                  {willSkip > 0 && (
                    <div role="status" style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 8px" }}>
                      {slotsLeft === 0 ? `You've used all ${shortlistLimit} shortlists for this job` : `Only ${slotsLeft} of ${shortlistLimit} shortlists left`} — {willSkip} will be skipped. Post another job to shortlist more.
                    </div>
                  )}
                  {plan && (plan.skipped.closed + plan.skipped.same + plan.skipped.notFitting) > 0 && (
                    <div style={{ fontSize: 12, color: "var(--t3)" }}>
                      {[plan.skipped.closed && `${plan.skipped.closed} already closed`, plan.skipped.same && `${plan.skipped.same} already there`,
                        plan.skipped.notFitting && `${plan.skipped.notFitting} ${bulkStage === "not_shortlisted" ? "past the interview stage" : "not interviewed yet"}`].filter(Boolean).join(" · ")} — skipped.
                    </div>
                  )}
                  <button type="button" disabled={busy || !plan?.update.length} onClick={applyBulk}
                    style={{ minHeight: 46, borderRadius: 10, border: "none", background: plan?.update.length ? "#e85a2a" : "var(--s2)", color: plan?.update.length ? "#fff" : "var(--t3)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {busy ? "Updating…" : `Move ${plan?.update.length || 0} to ${stageLabel(bulkStage)}`}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {opened && (
        <Sheet title={opened.applicantName || "Applicant"} onClose={() => setOpenId(null)}>
          <ApplicantDetail key={`${opened.id}-${startWith}`} app={opened} job={job} employer={employer} onChange={replace} startWith={startWith} />
        </Sheet>
      )}
    </div>
  );
}
