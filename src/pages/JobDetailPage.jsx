import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { JobApplyModal } from "../components/shared/JobApplyModal";
import { useJobApply } from "../hooks/useJobApply";
import { buildJobPostingJsonLd } from "../utils/jobJsonLd.js";

const SITE_URL = "https://tinit.in";
const truncate = (str, len) => (str && str.length > len ? str.slice(0, len - 1).trimEnd() + "…" : str || "");

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

export function JobDetailPage({ user, isGuest, onRequireLogin }) {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const applyState = useJobApply(user, isGuest, onRequireLogin);
  const { appliedJobIds, openApply } = applyState;

  useEffect(() => {
    document.querySelectorAll(STALE_STATIC_META_SELECTOR).forEach(el => el.remove());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getDoc(doc(db, "jobListings", jobId)).then(snap => {
      if (cancelled) return;
      if (snap.exists()) setJob({ id: snap.id, ...snap.data() });
      else setNotFound(true);
      setLoading(false);
    }).catch(e => {
      console.error("[job-detail] Failed to load job:", e);
      if (!cancelled) { setNotFound(true); setLoading(false); }
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
  const alreadyApplied = appliedJobIds.has(job.id);

  const orgName = job.businessName || job.postedByName || "TIN";
  const pageTitle = `${job.jobTitle} at ${orgName} | TIN Jobs`;
  const pageDescription = truncate(job.description, 160);
  const pageUrl = `${SITE_URL}/jobs/${job.id}`;
  const ogImage = `${SITE_URL}/og-image.png`;
  const jsonLd = buildJobPostingJsonLd({
    ...job,
    createdAtISO: job.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 100px" }}>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <Link to="/jobs" style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, textDecoration: "none", display: "inline-block", marginBottom: 14 }}>← Back to Jobs</Link>

      <div style={{ background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: "var(--r)", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 10 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 22, color: "var(--t1)" }}>{job.jobTitle}</div>
          {job.postedByType === "verified_business" && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>✓ Verified business</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 12 }}>{job.businessName || job.postedByName || "Individual poster"}</div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "var(--t2)", background: "var(--s2)", borderRadius: 10, padding: "3px 10px" }}>📍 {job.city}{job.state ? `, ${job.state}` : ""}</span>
          <span style={{ fontSize: 12, color: "var(--t2)", background: "var(--s2)", borderRadius: 10, padding: "3px 10px" }}>{job.jobType}</span>
          <span style={{ fontSize: 12, color: "var(--t2)", background: "var(--s2)", borderRadius: 10, padding: "3px 10px" }}>{job.category}</span>
        </div>

        {job.salaryRange && <div style={{ fontSize: 14, fontWeight: 700, color: "var(--acc)", marginBottom: 14 }}>{job.salaryRange}</div>}

        <div style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20, whiteSpace: "pre-wrap" }}>{job.description}</div>

        {isOwnListing ? (
          <button disabled style={{ padding: "10px 18px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t3)", fontSize: 13, fontWeight: 700, cursor: "default" }}>
            This is your listing
          </button>
        ) : alreadyApplied ? (
          <button disabled style={{ padding: "10px 18px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t3)", fontSize: 13, fontWeight: 700, cursor: "default" }}>
            ✓ Applied
          </button>
        ) : (
          <button onClick={() => openApply(job)} style={{ padding: "10px 18px", borderRadius: 8, background: "#e85a2a", border: "none", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Apply
          </button>
        )}
      </div>

      <JobApplyModal {...applyState} />
    </div>
  );
}
