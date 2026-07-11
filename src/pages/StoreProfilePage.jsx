import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

const SITE_URL = "https://tinit.in";
const truncate = (str, len) => (str && str.length > len ? str.slice(0, len - 1).trimEnd() + "…" : str || "");

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

export function StoreProfilePage() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.querySelectorAll(STALE_STATIC_META_SELECTOR).forEach(el => el.remove());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getDoc(doc(db, "stores", storeId)).then(snap => {
      if (cancelled) return;
      if (snap.exists()) setStore({ id: snap.id, ...snap.data() });
      else setNotFound(true);
      setLoading(false);
    }).catch(e => {
      console.error("[store-profile] Failed to load store:", e);
      if (!cancelled) { setNotFound(true); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [storeId]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}>Loading…</div>;
  }

  if (notFound || !store) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 8 }}>Store not found</div>
        <Link to="/" style={{ fontSize: 13, color: "var(--acc)", fontWeight: 700, textDecoration: "none" }}>← Back to Home</Link>
      </div>
    );
  }

  const pageTitle = `${store.storeName} | TIN`;
  const pageDescription = truncate(
    [store.businessType && `${store.businessType} in ${store.city || "India"}`, store.brands && `Brands: ${store.brands}`]
      .filter(Boolean).join(". ") || `${store.storeName} on TIN — India's building materials & construction network.`,
    160
  );
  const pageUrl = `${SITE_URL}/store/${store.id}`;
  const ogImage = store.logo || `${SITE_URL}/og-image.png`;

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 22, color: "#080808" }}>{store.storeName}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "3px 10px",
                color: store.verificationStatus === "verified" ? "#16a34a" : "#d97706",
                background: store.verificationStatus === "verified" ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${store.verificationStatus === "verified" ? "#bbf7d0" : "#fde68a"}`,
              }}>
                {store.verificationStatus === "verified" ? "✓ Verified" : "⏳ Pending Verification"}
              </span>
              {store.gstVerified && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: 10 }}>
                  🏛 GST Verified
                </span>
              )}
              {store.businessType && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#555", background: "#f5f5f5", border: "1px solid #e0e0e0", padding: "3px 10px", borderRadius: 10 }}>
                  {store.businessType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CONTACT BUTTONS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {store.phone && <a href={`tel:${store.phone}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📞 Call</a>}
          {store.whatsapp && <a href={`https://wa.me/91${store.whatsapp}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>💬 WhatsApp</a>}
          {store.instagram && <a href={`https://instagram.com/${store.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: "#fdf4ff", border: "1px solid #e9d5ff", color: "#7c3aed", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📸 Instagram</a>}
          {store.website && <a href={store.website} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#080808", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>🌐 Website</a>}
        </div>

        {/* ADDRESS */}
        {store.address && (
          <div style={{ fontSize: 13, color: "#080808", marginBottom: 14, padding: "10px 14px", background: "#f8f8f8", borderRadius: 8 }}>
            📍 {store.address}{store.city ? `, ${store.city}` : ""}{store.state ? `, ${store.state}` : ""}{store.pincode ? ` - ${store.pincode}` : ""}
          </div>
        )}

        {/* CATEGORIES */}
        {(store.categories || []).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Product Categories</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(store.categories || []).map((c, i) => (
                <div key={i} style={{ background: "#fff3ef", border: "1px solid #fde0d0", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#e85a2a", fontWeight: 600 }}>
                  {c.category}
                  {c.subCategory && <span style={{ fontSize: 10, color: "#555", fontWeight: 400 }}> · {c.subCategory}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BRANDS */}
        {store.brands && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Brands Available</div>
            <div style={{ fontSize: 13, color: "#080808" }}>{store.brands}</div>
          </div>
        )}

        {/* OWNER */}
        {store.ownerName && <div style={{ fontSize: 13, color: "#080808" }}>👤 Owner: <strong>{store.ownerName}</strong></div>}
      </div>
    </div>
  );
}
