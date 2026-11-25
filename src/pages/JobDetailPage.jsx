import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { BENEFITS, URGENCY, labelOf } from "../data/jobsTaxonomy.js";
import { fetchJob, fetchPosterLink } from "../lib/jobsFeed";
import { JobApplyModal } from "../components/shared/JobApplyModal";
import { useJobApply } from "../hooks/useJobApply";
import { buildJobPostingJsonLd } from "../utils/jobJsonLd.js";
import { JobsStyles, LaneMarker } from "../components/jobs/jobsUi";
import { LANE_COLOR, LANE_LABEL, card, chip, heading, payLine } from "../components/jobs/jobsStyle";
import { ReportJobButton, SaveJobButton } from "../components/jobs/SaveReportButtons";
import { BusinessCard } from "../components/jobs/BusinessCard";
import { ShareJobButton } from "../components/jobs/ShareJobButton";
import { OG_IMAGE, OG_IMAGE_ALT, jobShareDescription } from "../utils/jobShare.js";

const SITE_URL = "https://tinit.in";

// index.html's static SEO tags aren't managed by react-helmet-async (it only
// tracks tags it renders itself, marked with data-rh) — left alone, they'd
// sit in <head> alongside this page's Helmet-rendered tags of the same
// name/property, and some crawlers/unfurlers take the *first* match rather
// than the last, which would silently win with the generic homepage content.
// Strip them once so this page's tags are the only ones present client-side.
const STALE_STATIC_META_SELECTOR = [
  'meta[name="description"]:not([data-rh])',
  'meta[property="og:title"]:not([data-rh])',
  'meta[property="og:description"]:not([data-rh])',
  'meta[property="og:image"]:not([data-rh])',
  'meta[property="og:url"]:not([data-rh])',
  'meta[property="og:type"]:not([data-rh])',
  'meta[name="twitter:card"]:not([data-rh])',
].join(",");

function Fact({ label, children }) {
  return (
    <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{children}</div>
    </div>
  );
}

const sectionTitle = { fontSize: 12, fontWeight: 700, color: "var(--t2)", textTransform: "uppercase", letterSpacing: ".06em", margin: "18px 0 8px" };

export function JobDetailPage({ user, isGuest, onRequireLogin, toast }) {
  const { jobId } = useParams();
  // One result per jobId; "loading" = we don't have a result for this id yet.
  const [result, setResult] = useState({ jobId: null, job: null, notFound: false });
  const [posterLink, setPosterLink] = useState({ jobId: null, link: null });
  const loading = result.jobId !== jobId;
  const job = loading ? null : result.job;
  const notFound = !loading && result.notFound;

  const applyState = useJobApply(user, isGuest, onRequireLogin);
  const { appliedJobIds, openApply } = applyState;

  useEffect(() => {
    document.querySelectorAll(STALE_STATIC_META_SELECTOR).forEach(el => el.remove());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchJob(jobId).then(j => {
      if (cancelled) return;
      setResult({ jobId, job: j, notFound: !j });
      if (j) fetchPosterLink(j.postedByUid).then(link => { if (!cancelled) setPosterLink({ jobId, link }); });
    }).catch(e => {
      console.error("[job-detail] Failed to load job:", e);
      if (!cancelled) setResult({ jobId, job: null, notFound: true });
    });
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}>Loading…</div>;
  }

  if (notFound || !job) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 8 }}>Job not found</div>
        <Link to="/jobs" style={{ fontSize: 13, color: "var(--acc)", fontWeight: 700, textDecoration: "none" }}>← Back to Jobs</Link>
      </div>
    );
  }

  const isOwnListing = !isGuest && job.postedByUid === user?.uid;
  const alreadyApplied = appliedJobIds.get(job.id);
  const isOpen = job.status === "approved" && job.jobStatus === "live";
  const lane = job.isNeededNow ? "needed-now" : job.lane;
  const laneLink = { professional: "/jobs/professional", skilled: "/jobs/skilled", "needed-now": "/jobs/needed-now" }[lane];

  const orgName = job.businessName || job.postedByName || "TIN";
  const pageTitle = `${job.title} at ${orgName} | TIN Jobs`;
  // L6: pay · place · type first, so a shared link's preview shows them.
  const pageDescription = jobShareDescription(job);
  const pageUrl = `${SITE_URL}/jobs/${job.id}`;
  const ogImage = OG_IMAGE;
  const jsonLd = buildJobPostingJsonLd({
    ...job.raw,
    createdAtISO: job.raw.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  });

  // A job carrying a storeId links straight to that store (only an
  // admin-linked account can set it); otherwise the poster's public profile.
  const cardLink = job.storeId
    ? { href: `/store/${job.storeId}`, label: "View store profile" }
    : (posterLink.jobId === jobId ? posterLink.link : null);
  const sa = job.shortAssignment;
  const pay = payLine(job);
  const location = [job.city, job.state].filter(Boolean).join(", ");
  const typeChips = [
    ...job.workTypeLabels,
    ...(job.legacyJobType ? [job.legacyJobType] : []),
  ];
  const roleChips = [
    ...(job.tradeLabel ? [`${job.tradeLabel} · ${job.tradeLabelHi}`] : []),
    ...job.functionLabels,
    ...(job.legacyCategory ? [job.legacyCategory] : []),
  ];
  const benefits = Object.entries(job.benefits);

  return (
    <div className="tj-scroll">
    <div className="tj-wrap" style={{ maxWidth: 760 }}>
      <JobsStyles />
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TIN Jobs" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={OG_IMAGE_ALT} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 12 }}>
        <Link to="/jobs" style={{ color: "var(--t3)", textDecoration: "none" }}>Jobs</Link>
        {" / "}
        <Link to={laneLink} style={{ color: "var(--t3)", textDecoration: "none" }}>{LANE_LABEL[lane]}</Link>
      </div>

      <div style={{ ...card, padding: 20, borderTop: `3px solid ${LANE_COLOR[lane]}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
          <LaneMarker lane={lane} /> {LANE_LABEL[lane]}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
          <h1 style={{ ...heading, fontSize: 24, margin: 0 }}>{job.title}</h1>
          {job.postedByType === "verified_business" && <span className="badge bv">✓ Verified business</span>}
        </div>
        <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 12 }}>{orgName}{location ? ` · 📍 ${location}` : ""}</div>
        {/* L6: share any approved job (pending ones aren't public yet). */}
        {job.status === "approved" && (
          <div style={{ marginBottom: 12 }}>
            <ShareJobButton job={job} style={{ minHeight: 40, padding: "0 14px", borderRadius: 8, border: "1px solid var(--b3)", background: "var(--s1)", color: "var(--t1)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} />
          </div>
        )}

        {!isOpen && (
          <div style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
            This job isn't taking applications right now.
          </div>
        )}

        <div className="tj-facts" style={{ marginBottom: 12 }}>
          {pay && <Fact label="Pay">{pay}</Fact>}
          {location && <Fact label="Location">{location}</Fact>}
          {job.headcount && <Fact label="People needed">{job.headcount}</Fact>}
          {job.experience && <Fact label="Experience">{job.experience}</Fact>}
          {job.education && <Fact label="Education">{job.education}</Fact>}
          {job.workingHours && <Fact label="Working hours">{job.workingHours}</Fact>}
          {sa?.duration && <Fact label="Duration">{sa.duration}</Fact>}
          {sa?.startDate && <Fact label="Starts">{sa.startDate}</Fact>}
          {sa?.urgency && <Fact label="How urgent">{labelOf(URGENCY, sa.urgency)}</Fact>}
          {sa?.certTools && <Fact label="Certification / tools">{sa.certTools}</Fact>}
        </div>

        {(typeChips.length > 0 || roleChips.length > 0) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {typeChips.map((c, i) => <span key={`t${i}`} style={{ ...chip, fontSize: 12, padding: "3px 10px" }}>{c}</span>)}
            {roleChips.map((c, i) => <span key={`r${i}`} style={{ ...chip, fontSize: 12, padding: "3px 10px" }}>{c}</span>)}
          </div>
        )}

        {job.responsibilities.length > 0 && <>
          <div style={sectionTitle}>What you'll do</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "var(--t2)", lineHeight: 1.6 }}>
            {job.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </>}

        {job.skills.length > 0 && <>
          <div style={sectionTitle}>Skills</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {job.skills.map((s, i) => <span key={i} style={{ ...chip, fontSize: 12, padding: "3px 10px" }}>{s}</span>)}
          </div>
        </>}

        {job.description && <>
          {(job.responsibilities.length > 0 || job.skills.length > 0) && <div style={sectionTitle}>About the job</div>}
          <div style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginTop: job.responsibilities.length || job.skills.length ? 0 : 16, whiteSpace: "pre-wrap" }}>{job.description}</div>
        </>}

        {(benefits.length > 0 || job.evpText) && (
          <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: 14, marginTop: 18 }}>
            <div style={{ ...sectionTitle, margin: "0 0 8px" }}>Why work with {orgName}</div>
            {benefits.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {benefits.map(([k, details]) => (
                  <li key={k} style={{ fontSize: 13, color: "var(--t2)" }}>
                    <span className="badge bv" style={{ marginRight: 6 }}>✓</span>
                    <b>{labelOf(BENEFITS, k)}</b>{details ? ` — ${details}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {job.evpText && <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: benefits.length ? 10 : 0 }}>{job.evpText}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 20 }}>
          {isOwnListing ? (
            <button disabled style={{ padding: "10px 18px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t3)", fontSize: 13, fontWeight: 700, cursor: "default" }}>
              This is your listing
            </button>
          ) : null}
          {isOwnListing ? (
            <Link to={`/jobs/${job.id}/edit`} style={{ padding: "10px 18px", borderRadius: 8, background: "transparent", border: "1px solid var(--b3)", color: "var(--t1)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              ✎ Edit job
            </Link>
          ) : alreadyApplied ? (
            <button disabled style={{ padding: "10px 18px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t3)", fontSize: 13, fontWeight: 700, cursor: "default" }}>
              {alreadyApplied === "shortlisted" ? "✓ You're shortlisted" : alreadyApplied === "declined" ? "You said not interested" : "✓ Applied"}
            </button>
          ) : isOpen ? (
            <button onClick={() => openApply(job.raw)} style={{ padding: "10px 18px", borderRadius: 8, background: "#e85a2a", border: "none", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Apply
            </button>
          ) : null}
          {!isOwnListing && <SaveJobButton jobId={job.id} user={user} isGuest={isGuest} onRequireLogin={onRequireLogin} toast={toast} />}
          {!isOwnListing && <ReportJobButton jobId={job.id} user={user} isGuest={isGuest} onRequireLogin={onRequireLogin} />}
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Anyone can view this job. Applying needs a free TIN account.</div>
      </div>

      <BusinessCard job={job} orgName={orgName} cardLink={cardLink} isOwnListing={isOwnListing} />

      <JobApplyModal {...applyState} />
    </div>
    </div>
  );
}
