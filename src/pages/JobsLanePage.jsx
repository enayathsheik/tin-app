import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { TRADES } from "../data/jobsTaxonomy.js";
import { laneBySlug } from "../data/jobsLanes.js";
import { FILTER_KEYS, filtersFromSearchParams, jobMatchesFilters } from "../utils/jobFilters.js";
import { useJobsFeed } from "../hooks/useJobsFeed";
import { useJobApply } from "../hooks/useJobApply";
import { JobRow } from "../components/jobs/JobRow";
import { JobFilters } from "../components/jobs/JobFilters";
import { JobsStyles, LaneMarker } from "../components/jobs/jobsUi";
import { LANE_COLOR, btnOutline, card, heading } from "../components/jobs/jobsStyle";
import { JobApplyModal } from "../components/shared/JobApplyModal";

const SITE_URL = "https://tinit.in";

// /jobs/professional · /jobs/skilled · /jobs/needed-now
// Filters live in the URL (?q=&fn=&trade=&type=&city=&exp=&pay=) so a
// filtered list can be shared and opened directly.
export function JobsLanePage({ slug, user, isGuest, onRequireLogin }) {
  const meta = laneBySlug(slug);
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef(null);
  const f = useMemo(() => filtersFromSearchParams(params), [params]);
  const filterKey = FILTER_KEYS.map(k => f[k] || "").join("|");

  const [matchCount, setMatchCount] = useState(null);
  const feed = useJobsFeed({ matchCount, filterKey });
  const filtered = useMemo(
    () => feed.jobs.filter(j => jobMatchesFilters(j, { ...f, lane: meta.lane })),
    [feed.jobs, f, meta.lane],
  );
  if (matchCount !== filtered.length) setMatchCount(filtered.length);

  const applyState = useJobApply(user, isGuest, onRequireLogin);
  const { appliedJobIds, openApply } = applyState;

  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });
  const activeCount = Object.values(f).filter(Boolean).length;
  const color = LANE_COLOR[meta.lane];

  return (
    <div className="tj-scroll">
    <div className="tj-wrap">
      <JobsStyles />
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={`${SITE_URL}${meta.path}`} />
        <link rel="canonical" href={`${SITE_URL}${meta.path}`} />
      </Helmet>

      <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6 }}>
        <Link to="/jobs" style={{ color: "var(--t3)", textDecoration: "none" }}>Jobs</Link> / {meta.heading}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <LaneMarker lane={meta.lane} size={10} />
        <h1 style={{ ...heading, fontSize: 26, margin: 0 }}>{meta.heading}</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 14px", maxWidth: 640 }}>{meta.lead}</p>

      {meta.lane === "skilled" && (
        <div className="tj-trades" style={{ marginBottom: 16 }}>
          {TRADES.map(t => {
            const on = f.trade === t.key;
            return (
              <button key={t.key} className="tj-tile" onClick={() => setFilter("trade", on ? "" : t.key)}
                aria-pressed={on}
                style={{ ...card, padding: "8px 10px", borderColor: on ? color : "var(--b2)", background: on ? "var(--s2)" : "var(--s1)" }}>
                <div style={{ fontSize: 12, color: "var(--t3)" }} lang="hi">{t.labelHi}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{t.label}</div>
              </button>
            );
          })}
        </div>
      )}

      <button className="tj-filters-btn" onClick={() => setFiltersOpen(o => !o)}
        style={{ ...btnOutline, marginBottom: 12, alignItems: "center", gap: 6 }}>
        ⚙ Filters{activeCount ? ` (${activeCount})` : ""} {filtersOpen ? "▲" : "▼"}
      </button>

      <div className="tj-lay">
        <JobFilters lane={meta.lane} f={f} onChange={setFilter} onClear={clearFilters} open={filtersOpen}
          resultCount={feed.jobs.length === 0 && feed.loading ? null : filtered.length}
          onShowResults={() => { setFiltersOpen(false); requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
        <div ref={resultsRef} style={{ minWidth: 0, scrollMarginTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8 }}>
            {feed.jobs.length === 0 && feed.loading ? "Loading…"
              : `${filtered.length} ${filtered.length === 1 ? "role" : "roles"}${feed.done ? "" : ` in the latest ${feed.jobs.length} jobs`}`}
          </div>
          {feed.error ? (
            <div style={{ ...card, padding: 24, textAlign: "center", color: "var(--t3)" }}>Couldn't load jobs right now. Please refresh the page.</div>
          ) : filtered.length === 0 && !feed.loading ? (
            <div style={{ ...card, padding: "40px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>No roles match yet</div>
              <div style={{ fontSize: 13, color: "var(--t3)" }}>{activeCount ? "Try clearing a filter." : "Check back soon, or post one yourself."}</div>
            </div>
          ) : (
            <div className="tj-rows">
              {filtered.map(j => (
                <JobRow key={j.id} job={j}
                  isOwnListing={!isGuest && j.postedByUid === user?.uid}
                  alreadyApplied={appliedJobIds.has(j.id)}
                  onApply={openApply} />
              ))}
            </div>
          )}
          {!feed.done && !feed.error && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={feed.loadMore} disabled={feed.loading} style={btnOutline}>
                {feed.loading ? "Loading…" : "Load more jobs"}
              </button>
            </div>
          )}
        </div>
      </div>

      <JobApplyModal {...applyState} />
    </div>
    </div>
  );
}
