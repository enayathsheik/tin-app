import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/config";

const createExternalConversationFn = httpsCallable(functions, "createExternalConversation");

// failed-precondition messages from functions/conversations.js are already
// plain-language — surfaced as-is rather than mapped, so the two sides of
// the check (client copy vs. server copy) can't drift out of sync.
const DEFAULT_MESSAGE_ERROR = "Couldn't start a conversation with this person. Please try again.";

const SITE_URL = "https://tinit.in";

const ROLE_LABELS = {
  consumer: "Consumer",
  marketChampion: "Market Champion",
  retailer: "Retailer / Distributor",
  architect: "Architect / Designer",
  contractor: "Contractor",
};

// See JobDetailPage.jsx for why this cleanup is needed — index.html's static
// SEO tags aren't managed by react-helmet-async and would otherwise coexist
// with this page's Helmet-rendered tags of the same name/property.
const STALE_STATIC_META_SELECTOR = [
  'meta[name="description"]:not([data-rh])',
  'meta[property="og:title"]:not([data-rh])',
  'meta[property="og:description"]:not([data-rh])',
  'meta[property="og:image"]:not([data-rh])',
  'meta[property="og:url"]:not([data-rh])',
  'meta[property="og:type"]:not([data-rh])',
  'meta[name="twitter:card"]:not([data-rh])',
].join(",");

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#e85a2a" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
    </div>
  );
}

export function PublicProfilePage({ user } = {}) {
  const { handleSeg } = useParams();
  const navigate = useNavigate();
  // Route path is a single dynamic segment (see App.jsx) — only "@handle" URLs
  // belong to this page; anything else falls back to the old catch-all behavior.
  const isHandleUrl = (handleSeg || "").startsWith("@");
  const handle = isHandleUrl ? handleSeg.slice(1) : "";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState(null);

  useEffect(() => {
    document.querySelectorAll(STALE_STATIC_META_SELECTOR).forEach(el => el.remove());
  }, []);

  useEffect(() => {
    if (!isHandleUrl) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    const load = async () => {
      try {
        const h = (handle || "").toLowerCase();
        const handleSnap = await getDoc(doc(db, "handles", h));
        if (!handleSnap.exists()) {
          if (!cancelled) { setNotFound(true); setLoading(false); }
          return;
        }
        const uid = handleSnap.data().uid;
        const profileSnap = await getDoc(doc(db, "profiles", uid));
        if (cancelled) return;
        if (profileSnap.exists()) setProfile({ uid, ...profileSnap.data() });
        else setNotFound(true);
      } catch (e) {
        console.error("[public-profile] Failed to load profile:", e);
        if (!cancelled) setNotFound(true);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [handle, isHandleUrl]);

  const handleMessage = async () => {
    if (!profile?.uid) return;
    setMessaging(true);
    setMessageError(null);
    try {
      const { data } = await createExternalConversationFn({ counterpartyUid: profile.uid });
      navigate(`/conversations/${data.conversationId}`);
    } catch (e) {
      setMessageError(e.message || DEFAULT_MESSAGE_ERROR);
    }
    setMessaging(false);
  };

  if (!isHandleUrl) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}>Loading…</div>;
  }

  if (notFound || !profile) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 8 }}>Profile not found</div>
        <Link to="/" style={{ fontSize: 13, color: "var(--acc)", fontWeight: 700, textDecoration: "none" }}>← Back to Home</Link>
      </div>
    );
  }

  const pageTitle = `@${profile.handle} | TIN`;
  const pageDescription = `${profile.displayName || "@" + profile.handle} — ${ROLE_LABELS[profile.role] || profile.role}${profile.city ? ` in ${profile.city}` : ""} on TIN.`;
  const pageUrl = `${SITE_URL}/@${profile.handle}`;
  const ogImage = profile.photoUrl || `${SITE_URL}/og-image.png`;

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
      </Helmet>
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e85a2a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, overflow: "hidden", flexShrink: 0 }}>
            {profile.photoUrl
              ? <img src={profile.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (profile.displayName || profile.handle || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 20, color: "#080808" }}>{profile.displayName}</div>
            <div style={{ fontSize: 12, color: "#888" }}>@{profile.handle}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "3px 10px", color: "#e85a2a", background: "#fff3ef", border: "1px solid #fde0d0" }}>
            {ROLE_LABELS[profile.role] || profile.role}
          </span>
          {profile.city && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555", background: "#f5f5f5", border: "1px solid #e0e0e0", padding: "3px 10px", borderRadius: 10 }}>
              📍 {profile.city}
            </span>
          )}
        </div>

        {user?.uid && user.uid !== profile.uid && (
          <div style={{ marginBottom: 18 }}>
            <button
              onClick={handleMessage}
              disabled={messaging}
              style={{ padding: "8px 16px", borderRadius: 8, background: "#e85a2a", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: messaging ? "default" : "pointer", opacity: messaging ? 0.6 : 1 }}
            >
              {messaging ? "…" : "Message"}
            </button>
            {messageError && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{messageError}</div>}
          </div>
        )}

        {/* ROLE-SPECIFIC STATS */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
          {profile.role === "marketChampion" && (
            <>
              <Stat label="Points" value={profile.points ?? 0} />
              <Stat label="Stores Added" value={profile.storesAddedCount ?? 0} />
              {(profile.badges || []).length > 0 && <Stat label="Badges" value={profile.badges.length} />}
            </>
          )}
          {(profile.role === "retailer" || profile.role === "architect" || profile.role === "contractor") && (
            <Stat label="Inspi Posts" value={profile.inspiCount ?? 0} />
          )}
          {profile.role === "contractor" && (
            <Stat label="Jobs Posted" value={profile.jobsPostedCount ?? 0} />
          )}
        </div>

        {/* SPECIALIZATIONS (Architect / Contractor) */}
        {(profile.specializationTags || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Specializations</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {profile.specializationTags.map((t, i) => (
                <div key={i} style={{ background: "#fff3ef", border: "1px solid #fde0d0", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#e85a2a", fontWeight: 600 }}>{t}</div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCT CATEGORIES (Retailer) — reuses StoreProfilePage's category-chip pattern */}
        {profile.role === "retailer" && (profile.storeCategories || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Product Categories</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {profile.storeCategories.map((c, i) => (
                <div key={i} style={{ background: "#fff3ef", border: "1px solid #fde0d0", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#e85a2a", fontWeight: 600 }}>
                  {c.category}
                  {c.subCategory && <span style={{ fontSize: 10, color: "#555", fontWeight: 400 }}> · {c.subCategory}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.role === "retailer" && profile.storeId && (
          <Link to={`/store/${profile.storeId}`} style={{ fontSize: 13, color: "#e85a2a", fontWeight: 700, textDecoration: "none" }}>View Store Profile →</Link>
        )}
      </div>
    </div>
  );
}
