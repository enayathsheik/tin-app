// Employer Desk → Find candidates (A3). Anyone who said yes to "Let employers
// find and call me" and is looking. No phone, email, CV or pay here: those
// unlock when the employer shortlists the person for one of their live jobs.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CITIES } from "../../../data/constants";
import { AVAIL, FUNCS, LANES, TRADES, labelOf } from "../../../data/jobsTaxonomy.js";
import { EMPTY_CANDIDATE_FILTERS, EXP_BANDS, candidateSnapshot } from "../../../utils/candidateSearch.js";
import { isEmployerAccount } from "../../../utils/jobRoles.js";
import { rememberJobBusiness, searchCandidates } from "../../../lib/findCandidates";
import { LANE_COLOR, btnPrimary, card, chip, fieldLabel, heading } from "../jobsStyle";
import { TinProfileCard } from "../ApplicationBits";
import { Sheet } from "./Sheet";
import { ShortlistForJob } from "./ShortlistForJob";

const outline = { minHeight: 44, padding: "0 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "var(--t1)", border: "1px solid var(--b3)" };
const primary = { ...outline, background: "#e85a2a", color: "#fff", border: "none" };

const workOf = (p) => [
  p.role,
  ...(p.trades || []).map(k => labelOf(TRADES, k)),
  ...(p.lane === "professional" ? (p.functions || []).map(k => labelOf(FUNCS, k)) : []),
].filter(Boolean).slice(0, 4).join(", ");
const yearsOf = (p) => (p.experienceYears == null || p.experienceYears === "" ? "" : `${p.experienceYears} ${Number(p.experienceYears) === 1 ? "yr" : "yrs"}`);

// `jobs` = the Desk's loaded jobs; `unlockedFor` = { candidateUid: [job title] }.
export function FindCandidates({ user, jobs, unlockedFor, onBack, onShortlisted, onOpenJob }) {
  const [f, setF] = useState(EMPTY_CANDIDATE_FILTERS);
  const [cityText, setCityText] = useState("");
  const [res, setRes] = useState({ key: null, people: [], cursor: null, hasMore: false, error: "" });
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(null);      // the person whose profile is open
  const [picking, setPicking] = useState(null); // the person being shortlisted
  const [attempt, setAttempt] = useState(0);
  const uid = user.uid;
  const employer = isEmployerAccount(user) || user.role === "admin";
  const allowed = employer || jobs.length > 0;
  const key = allowed ? JSON.stringify([f, attempt]) : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const start = employer ? Promise.resolve() : rememberJobBusiness(uid, jobs[0]);
    start.then(() => searchCandidates(JSON.parse(key)[0]))
      .then(r => { if (!cancelled) setRes({ key, error: "", ...r }); })
      .catch(e => {
        console.error("[find-candidates] search failed:", e);
        if (!cancelled) setRes({ key, people: [], cursor: null, hasMore: false, error: e?.code === "failed-precondition" ? "Search is still being set up. Please try again in a few minutes." : "Couldn't search right now. Please try again." });
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` holds the filters; the account doesn't change here
  }, [key]);

  const loading = allowed && res.key !== key;
  const loadMore = async () => {
    setMore(true);
    try {
      const r = await searchCandidates(f, res.cursor);
      setRes(p => (p.key !== key ? p : { ...p, ...r, people: [...p.people, ...r.people.filter(x => !p.people.some(y => y.uid === x.uid))] }));
    } catch (e) {
      console.error("[find-candidates] next page failed:", e);
      setRes(p => ({ ...p, error: "Couldn't load more. Please try again." }));
    }
    setMore(false);
  };
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const setLane = (lane) => setF(p => ({ ...p, lane, trade: lane === "skilled" ? p.trade : "", fn: lane === "professional" ? p.fn : "" }));
  const applyCity = () => setF(p => (p.city === cityText.trim() ? p : { ...p, city: cityText.trim() }));
  const clear = () => { setF(EMPTY_CANDIDATE_FILTERS); setCityText(""); };
  const active = Object.values(f).some(Boolean);
  // You can't shortlist yourself.
  const people = loading ? [] : res.people.filter(p => p.uid !== uid);

  const top = (
    <>
      <button type="button" onClick={onBack} style={{ background: "none", border: "none", padding: 0, minHeight: 40, color: "var(--acc)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← Employer Desk</button>
      <h1 style={{ ...heading, fontSize: 26, margin: 0 }}>Find candidates</h1>
      <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 12 }}>People who asked employers to contact them. Shortlist someone for your job to see their phone, email and CV.</div>
    </>
  );
  if (!allowed) {
    return <div>{top}
      <div style={{ ...card, padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 10 }}>Find candidates is for businesses that are hiring. Post a job to start.</div>
        <Link to="/jobs/post" style={{ ...btnPrimary, textDecoration: "none" }}>+ Post a job</Link>
      </div>
    </div>;
  }

  return (
    <div>
      {top}
      <div style={{ ...card, padding: 12, marginBottom: 14 }}>
        <div role="group" aria-label="Kind of work" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[{ key: "", label: "Everyone" }, ...LANES].map(l => (
            <button key={l.key} type="button" aria-pressed={f.lane === l.key} onClick={() => setLane(l.key)}
              style={{ minHeight: 40, padding: "0 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${f.lane === l.key ? "var(--acc)" : "var(--b2)"}`, background: f.lane === l.key ? "#e85a2a14" : "var(--s2)", color: f.lane === l.key ? "var(--acc)" : "var(--t2)" }}>{l.label}</button>
          ))}
        </div>
        <div className="fc-grid">
          {f.lane === "skilled" && <label><div style={fieldLabel}>Trade</div>
            <select className="fi" value={f.trade} onChange={set("trade")}><option value="">Any trade</option>{TRADES.map(o => <option key={o.key} value={o.key}>{o.label} · {o.labelHi}</option>)}</select></label>}
          {f.lane === "professional" && <label><div style={fieldLabel}>Function</div>
            <select className="fi" value={f.fn} onChange={set("fn")}><option value="">Any function</option>{FUNCS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>}
          <form onSubmit={e => { e.preventDefault(); applyCity(); }}>
            <label><div style={fieldLabel}>City</div>
              <input className="fi" list="fc-cities" placeholder="Any city" value={cityText} onChange={e => setCityText(e.target.value)} onBlur={applyCity} enterKeyHint="search" /></label>
            <datalist id="fc-cities">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
          </form>
          <label><div style={fieldLabel}>Experience</div>
            <select className="fi" value={f.exp} onChange={set("exp")}><option value="">Any experience</option>{EXP_BANDS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}</select></label>
          <label><div style={fieldLabel}>Can start</div>
            <select className="fi" value={f.avail} onChange={set("avail")}><option value="">Any time</option>{AVAIL.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
        </div>
        {active && <button type="button" onClick={clear} style={{ background: "none", border: "none", padding: 0, marginTop: 8, minHeight: 36, color: "var(--acc)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Clear filters</button>}
      </div>
      <style>{".fc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(min-width:760px){.fc-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}"}</style>

      {res.error && !loading && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginBottom: 10 }}>⚠ {res.error} <button type="button" onClick={() => setAttempt(n => n + 1)} style={{ background: "none", border: "none", color: "var(--acc)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button></div>}
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>Searching…</div>
        : people.length === 0 && !res.error && !res.hasMore ? (
          <div style={{ ...card, padding: "32px 16px", textAlign: "center", fontSize: 14, color: "var(--t3)" }}>
            {active ? "Nobody matches these filters yet. Try fewer filters." : "Nobody is on employer search yet. People choose this in their job profile, so check back soon."}
          </div>
        ) : (
          <div className="fc-list">
            {people.map(p => {
              const jobsFor = unlockedFor[p.uid];
              return (
                <div key={p.uid} style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 8, borderTop: `3px solid ${LANE_COLOR[p.lane] || "var(--b2)"}` }}>
                  <button type="button" onClick={() => setOpen(p)} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--t1)" }}>{p.name || "Candidate"}</div>
                    {workOf(p) && <div style={{ fontSize: 13, color: "var(--t2)" }}>{workOf(p)}</div>}
                    <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{[p.city && `📍 ${p.city}`, yearsOf(p)].filter(Boolean).join(" · ")}</div>
                  </button>
                  {labelOf(AVAIL, p.availability) && <div><span style={chip}>{labelOf(AVAIL, p.availability)}</span></div>}
                  {jobsFor && <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>✓ Shortlisted for {jobsFor.join(", ")}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                    <button type="button" onClick={() => setPicking(p)} style={{ ...primary, flex: 1 }}>Shortlist for job…</button>
                    <button type="button" onClick={() => setOpen(p)} style={outline}>Profile</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      <style>{".fc-list{display:grid;gap:10px}@media(min-width:760px){.fc-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1040px){.fc-list{grid-template-columns:repeat(3,minmax(0,1fr))}}"}</style>
      {!loading && res.hasMore && <button type="button" disabled={more} onClick={loadMore} style={{ ...outline, marginTop: 12 }}>{more ? "Loading…" : "Show more"}</button>}

      {open && !picking && (
        <Sheet title={open.name || "Candidate"} onClose={() => setOpen(null)}>
          <div style={{ fontSize: 13, color: "var(--t2)", background: "var(--s2)", borderRadius: 8, padding: "8px 10px" }}>🔒 Phone, email and CV unlock when you shortlist this person for one of your live jobs.</div>
          <TinProfileCard app={{ applicantName: open.name, profileSnapshot: candidateSnapshot(open) }} />
          <button type="button" onClick={() => setPicking(open)} style={{ ...primary, width: "100%", marginTop: 14 }}>Shortlist for job…</button>
        </Sheet>
      )}
      {picking && (
        <Sheet title={`Shortlist ${picking.name || "candidate"}`} onClose={() => { setPicking(null); setOpen(null); }}>
          <ShortlistForJob key={picking.uid} person={picking} user={user} jobs={jobs} onShortlisted={onShortlisted} onOpenJob={onOpenJob} />
        </Sheet>
      )}
    </div>
  );
}
