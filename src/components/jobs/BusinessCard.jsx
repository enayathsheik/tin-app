import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { fetchStoreOpenJobs } from "../../lib/jobsPost";
import { fetchPosterOpenJobs } from "../../lib/employerDesk";
import { card, chip } from "./jobsStyle";

// Business card on a job page (phase 5a): the linked store's name, logo and
// city when the job carries an (admin-linked) storeId, otherwise the
// poster's public profile link. Plus up to 3 more open jobs by the same
// business. Nothing is invented: missing details are just left out.
export function BusinessCard({ job, orgName, cardLink, isOwnListing }) {
  const key = `${job.id}|${job.storeId || ""}`;
  const [data, setData] = useState({ key: null, store: null, more: [] });

  useEffect(() => {
    let cancelled = false;
    const storeP = job.storeId
      ? getDoc(doc(db, "stores", job.storeId)).then(s => (s.exists() ? s.data() : null)).catch(() => null)
      : Promise.resolve(null);
    const moreP = (job.storeId ? fetchStoreOpenJobs(job.storeId, 4) : job.postedByUid ? fetchPosterOpenJobs(job.postedByUid, 4) : Promise.resolve([]))
      .catch(e => { console.warn("[business-card] more jobs failed:", e.message); return []; });
    Promise.all([storeP, moreP]).then(([store, more]) => {
      if (!cancelled) setData({ key, store, more: more.filter(j => j.id !== job.id).slice(0, 3) });
    });
    return () => { cancelled = true; };
  }, [key, job.id, job.storeId, job.postedByUid]);

  const ready = data.key === key;
  const store = ready ? data.store : null;
  const more = ready ? data.more : [];
  const name = store?.storeName || orgName;
  const meta = [
    store?.verificationStatus === "verified" || job.postedByType === "verified_business" ? "✓ TIN verified business" : "Posted on TIN",
    store?.businessType || job.industryLabel,
    store?.city,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ ...card, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {store?.logo
          ? <img src={store.logo} alt="" width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          : <div className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>{(name[0] || "T").toUpperCase()}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{name}</div>
          <div style={{ fontSize: 12, color: "var(--t3)" }}>{meta}</div>
        </div>
        {cardLink && (
          <Link to={cardLink.href} style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", textDecoration: "none", whiteSpace: "nowrap" }}>{cardLink.label} →</Link>
        )}
      </div>
      {isOwnListing && (
        <Link to={`/jobs/desk?job=${job.id}`} style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>
          Your applicants are in the Employer Desk →
        </Link>
      )}
      {more.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>More open jobs at {name}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {more.map(j => (
              <Link key={j.id} to={`/jobs/${j.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--b2)", textDecoration: "none" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{j.title}</span>
                {j.city && <span style={chip}>📍 {j.city}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
