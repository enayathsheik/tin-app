import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { FUNCS, INDUSTRIES, TRADES, labelOf } from "../data/jobsTaxonomy.js";
import { JOBS_HOME_META } from "../data/jobsLanes.js";
import { jobMatchesFilters } from "../utils/jobFilters.js";
import { useJobsFeed } from "../hooks/useJobsFeed";
import { useJobApply } from "../hooks/useJobApply";
import { JobRow } from "../components/jobs/JobRow";
import { JobsStyles, LaneMarker } from "../components/jobs/jobsUi";
import { LANE_COLOR, btnOutline, card, chip, heading, payLine } from "../components/jobs/jobsStyle";
import { JobApplyModal } from "../components/shared/JobApplyModal";

const SITE_URL = "https://tinit.in";
const OPEN_ROLES_SHOWN = 12;
const TABS = [["", "All"], ["professional", "Professional"], ["skilled", "Skilled"]];
const SAMPLE_TRADES = ["mason", "electrician", "carpenter", "plumber", "tile_layer", "painter"];

// /jobs — Jobs home: search, the two lane cards, the Needed Now strip, open
// roles with lane tabs, and browse by function. ("Browse by industry" waits
// for Phase 3 / decision D2 — jobs don't record an industry yet.)
export function JobsPage({ user, isGuest, onRequireLogin }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const ind = INDUSTRIES.some(o => o.key === params.get("ind")) ? params.get("ind") : "";
  const [qInput, setQInput] = useState(q);
  const [tab, setTab] = useState("");

  const feed = useJobsFeed();
  const applyState = useJobApply(user, isGuest, onRequireLogin);
  const { appliedJobIds, openApply } = applyState;

  const neededNow = useMemo(() => feed.jobs.filter(j => j.isNeededNow).slice(0, 10), [feed.jobs]);
  const openRoles = useMemo(() => feed.jobs.filter(j => jobMatchesFilters(j, { lane: tab, q, ind })), [feed.jobs, tab, q, ind]);
  // Carry the home search + industry into "see all" lane links.
  const laneQuery = (() => { const p = new URLSearchParams(); if (q) p.set("q", q); if (ind) p.set("ind", ind); const t = p.toString(); return t ? `?${t}` : ""; })();
  const pickIndustry = (key) => {
    const next = new URLSearchParams(params);
    if (key) next.set("ind", key); else next.delete("ind");
    setParams(next, { replace: true });
    document.getElementById("tj-open-roles")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (qInput.trim()) next.set("q", qInput.trim()); else next.delete("q");
    setParams(next, { replace: true });
    document.getElementById("tj-open-roles")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="tj-scroll">
    <div className="tj-wrap">
      <JobsStyles />
      <Helmet>
        <title>{JOBS_HOME_META.title}</title>
        <meta name="description" content={JOBS_HOME_META.description} />
        <meta property="og:title" content={JOBS_HOME_META.title} />
        <meta property="og:description" content={JOBS_HOME_META.description} />
        <meta property="og:url" content={`${SITE_URL}/jobs`} />
        <link rel="canonical" href={`${SITE_URL}/jobs`} />
      </Helmet>

      {/* HERO */}
      <div style={{ marginBottom: 18 }}>
        <div className="hero-eyebrow" style={{ marginBottom: 6 }}>TIN Jobs</div>
        <h1 style={{ ...heading, fontSize: "clamp(26px,5vw,38px)", lineHeight: 1.05, margin: "0 0 6px" }}>
          Work that builds India — <span style={{ color: "var(--acc)" }}>from one day to a career</span>
        </h1>
        <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px", maxWidth: 620 }}>
          Hiring across building materials, construction, interiors & exteriors. Free to browse.
        </p>
        <form onSubmit={submitSearch} style={{ display: "flex", gap: 8, maxWidth: 560 }}>
          <input className="fi" placeholder="Search role, company, skill or city" value={qInput} onChange={e => setQInput(e.target.value)} aria-label="Search jobs" />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>Search</button>
        </form>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
          <Link to="/jobs/profile" style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>👤 My job profile · <span lang="hi">मेरी प्रोफ़ाइल</span> →</Link>
          {!isGuest && <Link to="/jobs/applications" style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>📋 My applications →</Link>}
          {!isGuest && <Link to="/jobs/saved" style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>★ Saved jobs →</Link>}
          {!isGuest && <Link to="/jobs/desk" style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>💼 Employer Desk →</Link>}
        </div>
      </div>

      {/* LANE CARDS */}
      <div className="tj-lanes" style={{ marginBottom: 22 }}>
        <Link to="/jobs/professional" className="tj-tile" style={{ ...card, padding: 16, textDecoration: "none", borderTop: `3px solid ${LANE_COLOR.professional}`, display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <LaneMarker lane="professional" /><span style={{ ...heading, fontSize: 20 }}>Professional</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 10 }}>Office, showroom, design, sales, engineering, accounts, management.</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)" }}>Browse professional roles →</span>
        </Link>
        <Link to="/jobs/skilled" className="tj-tile" style={{ ...card, padding: 16, textDecoration: "none", borderTop: `3px solid ${LANE_COLOR.skilled}`, display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <LaneMarker lane="skilled" /><span style={{ ...heading, fontSize: 20 }}>Skilled workforce</span>
            <span lang="hi" style={{ fontSize: 13, color: "var(--t3)" }}>कारीगर · मिस्त्री</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {TRADES.filter(t => SAMPLE_TRADES.includes(t.key)).map(t => (
              <span key={t.key} style={chip}>{t.label} · <span lang="hi">{t.labelHi}</span></span>
            ))}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)" }}>Browse trades →</span>
        </Link>
      </div>

      {/* NEEDED NOW */}
      <section style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8 }}>
          <h2 style={{ ...heading, fontSize: 20, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <LaneMarker lane="needed-now" /> Needed now
          </h2>
          <Link to="/jobs/needed-now" style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>See all →</Link>
        </div>
        {neededNow.length === 0 ? (
          <div style={{ ...card, padding: 14, fontSize: 13, color: "var(--t3)" }}>
            {feed.loading ? "Loading…" : "No short assignments right now. Day work, project crews and temporary roles show up here."}
          </div>
        ) : (
          <div className="tj-strip">
            {neededNow.map(j => (
              <Link key={j.id} to={`/jobs/${j.id}`} style={{ ...card, padding: 12, textDecoration: "none", borderTop: `3px solid ${LANE_COLOR["needed-now"]}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 2 }}>{j.title}</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8 }}>{j.businessName || j.postedByName}{j.city ? ` · ${j.city}` : ""}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {j.headcount && <span style={chip}>👥 {j.headcount} {j.headcount > 1 ? "people" : "person"}</span>}
                  {j.shortAssignment?.duration && <span style={chip}>⏱ {j.shortAssignment.duration}</span>}
                  {j.shortAssignment?.startDate && <span style={chip}>Starts {j.shortAssignment.startDate}</span>}
                </div>
                {payLine(j) && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{payLine(j)}</div>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* OPEN ROLES */}
      <section id="tj-open-roles" style={{ marginBottom: 22, scrollMarginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <h2 style={{ ...heading, fontSize: 20, margin: 0 }}>Open roles{q ? ` for "${q}"` : ""}{ind ? ` · ${labelOf(INDUSTRIES, ind)}` : ""}</h2>
          <div className="nav-tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k || "all"} role="tab" aria-selected={tab === k} className={`ntab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
        </div>
        {(q || ind) && (
          <button onClick={() => { setQInput(""); setParams(new URLSearchParams(), { replace: true }); }}
            style={{ background: "none", border: "none", color: "var(--acc)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 8 }}>
            ✕ Clear {q && ind ? "search and industry" : q ? "search" : "industry"}
          </button>
        )}
        {feed.error ? (
          <div style={{ ...card, padding: 24, textAlign: "center", color: "var(--t3)" }}>Couldn't load jobs right now. Please refresh the page.</div>
        ) : openRoles.length === 0 ? (
          <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>{feed.loading ? "Loading…" : "No jobs found"}</div>
            {!feed.loading && <div style={{ fontSize: 13, color: "var(--t3)" }}>{feed.jobs.length === 0 ? "No listings yet — check back soon, or be the first to post one." : "Try another search or tab."}</div>}
          </div>
        ) : (
          <div className="tj-rows">
            {openRoles.slice(0, OPEN_ROLES_SHOWN).map(j => (
              <JobRow key={j.id} job={j}
                isOwnListing={!isGuest && j.postedByUid === user?.uid}
                alreadyApplied={appliedJobIds.get(j.id)}
                onApply={openApply} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
          {tab && <Link to={`/jobs/${tab}${laneQuery}`} style={{ ...btnOutline, textDecoration: "none" }}>See all {tab === "skilled" ? "skilled" : "professional"} roles →</Link>}
          {!tab && openRoles.length > OPEN_ROLES_SHOWN && (
            <Link to={`/jobs/professional${laneQuery}`} style={{ ...btnOutline, textDecoration: "none" }}>More professional roles →</Link>
          )}
          {!tab && openRoles.length > OPEN_ROLES_SHOWN && (
            <Link to={`/jobs/skilled${laneQuery}`} style={{ ...btnOutline, textDecoration: "none" }}>More skilled roles →</Link>
          )}
          {openRoles.length <= OPEN_ROLES_SHOWN && !feed.done && !feed.error && (
            <button onClick={feed.loadMore} disabled={feed.loading} style={btnOutline}>{feed.loading ? "Loading…" : "Load more jobs"}</button>
          )}
        </div>
      </section>

      {/* BROWSE BY INDUSTRY (decision D2, Phase 3). Old jobs have no
          industry, so they only appear with no industry picked. */}
      <section style={{ marginBottom: 22 }}>
        <h2 style={{ ...heading, fontSize: 20, margin: "0 0 8px" }}>Browse by industry</h2>
        <div className="tj-tiles">
          {INDUSTRIES.map(o => {
            const on = ind === o.key;
            return (
              <button key={o.key} className="tj-tile" aria-pressed={on} onClick={() => pickIndustry(on ? "" : o.key)}
                style={{ ...card, padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "var(--t1)", borderColor: on ? "var(--acc)" : "var(--b2)" }}>
                {on ? "✓ " : ""}{o.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* BROWSE BY FUNCTION */}
      <section style={{ marginBottom: 22 }}>
        <h2 style={{ ...heading, fontSize: 20, margin: "0 0 8px" }}>Browse by function</h2>
        <div className="tj-tiles">
          {FUNCS.filter(fn => fn.key !== "other").map(fn => (
            <button key={fn.key} className="tj-tile" onClick={() => navigate(`/jobs/professional?fn=${fn.key}`)}
              style={{ ...card, padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>
              {fn.label}
            </button>
          ))}
        </div>
      </section>

      <JobApplyModal {...applyState} />
    </div>
    </div>
  );
}
