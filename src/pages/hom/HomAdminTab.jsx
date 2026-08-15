// HOM Systems admin tab (Block 3) — rendered inside the normal TIN app
// shell for a user whose role is "admin" (full TIN admin) or "hom_admin"
// (scoped role, sees only this tab — see App.jsx). Reuses the microsite's
// design tokens (HOM_STYLES) so the brand reads the same everywhere, but
// this component and everything under it is TIN-shell content, not the
// standalone public microsite.
import { Component, useEffect, useMemo, useState } from "react";
import { HOM_STYLES } from "./homStyles";
import { HomBrandMark } from "./HomBrandMark";
import {
  loadCatalog, saveCatalog, uploadCatalogPhoto,
  loadVendors, saveVendor, setVendorActive,
  loadOrders, rejectOrder, approveAndAssignOrder, advanceOrderStatus, ORDER_STATUS_LIFECYCLE,
  loadSupplierOrders,
} from "../../utils/homAdmin";
import { buildProductionChit, buildProfileChit, buildGlassChit, buildDeliveryChits } from "./homChits";

const SECTIONS = [
  ["orders", "Orders"],
  ["rates", "Rate List"],
  ["catalogue", "Catalogue"],
  ["vendors", "Vendors"],
  ["logs", "Logs"],
];

function fmtINR(n) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

// Rate List / Catalogue are built entirely around the post-overhaul shape
// (brands[] with per-brand regularBars/handleTypes, hingeCategories[],
// liftUp) — there's no sensible way to render them against the pre-overhaul
// shape (flat bars[]/hinges[]), so we gate on it rather than guess. Run
// `node scripts/seed-hom-catalog.mjs` against the target project to reshape.
function hasNewCatalogShape(catalog) {
  return Array.isArray(catalog?.brands);
}

function CatalogNeedsSeedNotice() {
  return (
    <div className="hm-error-banner">
      This catalog document is still in the old shape (no <code>brands[]</code>). Run{" "}
      <code>node scripts/seed-hom-catalog.mjs --service-account=…</code> against this project to
      reshape it before Rate List / Catalogue can be edited here.
    </div>
  );
}

// Belt-and-suspenders: hasNewCatalogShape + the per-field defaults below
// should prevent any crash, but a single bad/edited-by-hand field must never
// blank the whole TIN app shell — catches it and shows a readable message
// scoped to just this sub-tab instead.
class HomAdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("HOM admin tab section crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="hm-error-banner">
          This section hit an error and couldn't render: {this.state.error.message || String(this.state.error)}.
          Try another tab, or reload the page.
        </div>
      );
    }
    return this.props.children;
  }
}

export function HomAdminTab({ user }) {
  const [section, setSection] = useState("orders");
  const [catalog, setCatalog] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await loadCatalog();
        if (!cancelled) setCatalog(c);
      } catch (e) {
        if (!cancelled) setLoadErr(e.message || "Failed to load the catalog.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="hom-root" style={{ minHeight: "100%", overflowY: "auto", padding: 24 }}>
      <style>{HOM_STYLES}</style>
      <div className="hm-admin-shell">
        <div className="hm-topbar" style={{ border: "none", padding: "0 0 16px" }}>
          <HomBrandMark />
          <div className="hm-topbar-right">{user?.role === "admin" ? "Full Admin" : "HOM Admin"} — {user?.email || user?.name}</div>
        </div>

        <div className="hm-admin-nav">
          {SECTIONS.map(([id, label]) => (
            <button key={id} className={`hm-admin-navbtn ${section === id ? "on" : ""}`} onClick={() => setSection(id)}>{label}</button>
          ))}
        </div>

        {loadErr && <div className="hm-error-banner">{loadErr}</div>}
        {loading && <div style={{ padding: 40, textAlign: "center", color: "#6b6d76" }}>Loading…</div>}

        {!loading && !loadErr && catalog && (
          <HomAdminErrorBoundary key={section}>
            {section === "orders" && <OrdersSection catalog={catalog} />}
            {section === "rates" && (
              hasNewCatalogShape(catalog)
                ? <RatesSection catalog={catalog} onSaved={setCatalog} />
                : <CatalogNeedsSeedNotice />
            )}
            {section === "catalogue" && (
              hasNewCatalogShape(catalog)
                ? <CatalogueSection catalog={catalog} onSaved={setCatalog} />
                : <CatalogNeedsSeedNotice />
            )}
            {section === "vendors" && <VendorsSection />}
            {section === "logs" && <LogsSection />}
          </HomAdminErrorBoundary>
        )}
      </div>
    </div>
  );
}

// Fresh 8/10/12/16ft bar rows for a newly-added brand or handle type —
// mirrors the seeded shape (only 10ft available) so the admin fills in
// rates via the Bars table rather than hand-adding rows.
function freshBarSet() {
  return [
    { label: "8 ft", lengthMm: 2438, available: false, ratePerBar: 0 },
    { label: "10 ft", lengthMm: 3048, available: true, ratePerBar: 0 },
    { label: "12 ft", lengthMm: 3658, available: false, ratePerBar: 0 },
    { label: "16 ft", lengthMm: 4877, available: false, ratePerBar: 0 },
  ];
}

function BarsTable({ bars, onChange }) {
  return (
    <table className="hm-table">
      <thead><tr><th>Label</th><th>Length (mm)</th><th>Available</th><th>₹ / bar</th></tr></thead>
      <tbody>
        {bars.map((b, i) => (
          <tr key={i}>
            <td>{b.label}</td>
            <td><input className="hm-input" type="number" value={b.lengthMm} onChange={(e) => onChange(i, { lengthMm: Number(e.target.value) })} /></td>
            <td><input type="checkbox" checked={b.available} onChange={(e) => onChange(i, { available: e.target.checked })} /></td>
            <td><input className="hm-input" type="number" value={b.ratePerBar} onChange={(e) => onChange(i, { ratePerBar: Number(e.target.value) })} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ══ RATE LIST ══
// Every ₹ figure lives here: per-brand regular-profile bars, per-brand
// per-handle-type bars, hinge-category brand rates, lift-up hydraulic
// rates, and the flat cross-cutting rates. Structural editing (brand/
// profile-type/handle-type/colour/glass/addon names, active flags, photos)
// lives in Catalogue below.
function RatesSection({ catalog, onSaved }) {
  const [draft, setDraft] = useState(() => structuredClone(catalog));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const upd = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); setOk(""); };

  const updBrand = (brandIdx, patch) => {
    setDraft((d) => { const brands = [...d.brands]; brands[brandIdx] = { ...brands[brandIdx], ...patch }; return { ...d, brands }; });
    setDirty(true); setOk("");
  };
  const updRegularBar = (brandIdx, barIdx, patch) => {
    const brand = draft.brands[brandIdx];
    const regularBars = [...(brand.regularBars || [])];
    regularBars[barIdx] = { ...regularBars[barIdx], ...patch };
    updBrand(brandIdx, { regularBars });
  };
  const updHandleType = (brandIdx, htIdx, patch) => {
    const brand = draft.brands[brandIdx];
    const handleTypes = [...(brand.handleTypes || [])];
    handleTypes[htIdx] = { ...handleTypes[htIdx], ...patch };
    updBrand(brandIdx, { handleTypes });
  };
  const updHandleBar = (brandIdx, htIdx, barIdx, patch) => {
    const ht = (draft.brands[brandIdx].handleTypes || [])[htIdx];
    const bars = [...(ht.bars || [])];
    bars[barIdx] = { ...bars[barIdx], ...patch };
    updHandleType(brandIdx, htIdx, { bars });
  };

  const updHingeCategoryBrand = (catIdx, brandIdx, patch) => {
    setDraft((d) => {
      const hingeCategories = [...(d.hingeCategories || [])];
      const brands = [...(hingeCategories[catIdx].brands || [])];
      brands[brandIdx] = { ...brands[brandIdx], ...patch };
      hingeCategories[catIdx] = { ...hingeCategories[catIdx], brands };
      return { ...d, hingeCategories };
    });
    setDirty(true); setOk("");
  };

  const updHydraulic = (i, patch) => {
    setDraft((d) => {
      const hydraulicSystems = [...(d.liftUp?.hydraulicSystems || [])];
      hydraulicSystems[i] = { ...hydraulicSystems[i], ...patch };
      return { ...d, liftUp: { ...d.liftUp, hydraulicSystems } };
    });
    setDirty(true); setOk("");
  };
  const updLiftUp = (patch) => { setDraft((d) => ({ ...d, liftUp: { ...d.liftUp, ...patch } })); setDirty(true); setOk(""); };

  const save = async () => {
    setSaving(true); setErr(""); setOk("");
    try {
      await saveCatalog(draft);
      onSaved(draft);
      setDirty(false);
      setOk("Rates saved — this only prices NEW orders. Every order already placed keeps its own frozen price.");
    } catch (e) {
      setErr(e.message || "Failed to save rates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="hm-section-title">Rate List</div>
      <div className="hm-section-sub">Editing rates here never changes an already-placed order — each order froze its own catalogSnapshot at checkout.</div>

      {(draft.brands || []).map((brand, brandIdx) => (
        <div className="hm-plate" style={{ marginBottom: 14 }} key={brand.id}>
          <div className="hm-plate-hd"><span className="hm-plate-title">{brand.name} — Regular Profile Bars</span></div>
          <div className="hm-plate-body">
            <BarsTable bars={brand.regularBars || []} onChange={(barIdx, patch) => updRegularBar(brandIdx, barIdx, patch)} />

            {(brand.handleTypes || []).map((ht, htIdx) => (
              <div key={ht.id} style={{ marginTop: 16 }}>
                <div className="hm-detail-block-hd">{brand.name} — {ht.name} Bars</div>
                <BarsTable bars={ht.bars || []} onChange={(barIdx, patch) => updHandleBar(brandIdx, htIdx, barIdx, patch)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {(draft.hingeCategories || []).map((cat, catIdx) => (
        <div className="hm-plate" style={{ marginBottom: 14 }} key={cat.id}>
          <div className="hm-plate-hd"><span className="hm-plate-title">Hinges — {cat.name}</span></div>
          <div className="hm-plate-body">
            <table className="hm-table">
              <thead><tr><th>Brand</th><th>₹ / hinge</th><th>Active</th></tr></thead>
              <tbody>
                {(cat.brands || []).map((b, brandIdx) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td><input className="hm-input" type="number" value={b.rate} onChange={(e) => updHingeCategoryBrand(catIdx, brandIdx, { rate: Number(e.target.value) })} /></td>
                    <td><input type="checkbox" checked={b.active !== false} onChange={(e) => updHingeCategoryBrand(catIdx, brandIdx, { active: e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="hm-plate" style={{ marginBottom: 14 }}>
        <div className="hm-plate-hd"><span className="hm-plate-title">Lift-Up Hydraulics</span></div>
        <div className="hm-plate-body">
          <table className="hm-table">
            <thead><tr><th>System</th><th>₹ / shutter</th><th>Active</th></tr></thead>
            <tbody>
              {(draft.liftUp?.hydraulicSystems || []).map((h, i) => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td><input className="hm-input" type="number" value={h.rate} onChange={(e) => updHydraulic(i, { rate: Number(e.target.value) })} /></td>
                  <td><input type="checkbox" checked={h.active !== false} onChange={(e) => updHydraulic(i, { active: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hm-field" style={{ maxWidth: 200, marginTop: 12 }}>
            <div className="hm-field-label">Qty per shutter</div>
            <input className="hm-input" type="number" value={draft.liftUp?.qtyPerShutter ?? 0} onChange={(e) => updLiftUp({ qtyPerShutter: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <div className="hm-plate">
        <div className="hm-plate-hd"><span className="hm-plate-title">Other rates</span></div>
        <div className="hm-plate-body">
          <div className="hm-field-grid">
            <div className="hm-field"><div className="hm-field-label">Making ₹/shutter</div><input className="hm-input" type="number" value={draft.makingPerShutter ?? 0} onChange={(e) => upd({ makingPerShutter: Number(e.target.value) })} /></div>
            <div className="hm-field"><div className="hm-field-label">Glass deduct (mm)</div><input className="hm-input" type="number" value={draft.glassDeductMm ?? 0} onChange={(e) => upd({ glassDeductMm: Number(e.target.value) })} /></div>
            <div className="hm-field"><div className="hm-field-label">Kerf (mm)</div><input className="hm-input" type="number" value={draft.kerfMm ?? 0} onChange={(e) => upd({ kerfMm: Number(e.target.value) })} /></div>
            <div className="hm-field"><div className="hm-field-label">GST %</div><input className="hm-input" type="number" value={draft.gstPct ?? 0} onChange={(e) => upd({ gstPct: Number(e.target.value) })} /></div>
            <div className="hm-field"><div className="hm-field-label">Transport flat ₹</div><input className="hm-input" type="number" value={draft.transportFlat ?? 0} onChange={(e) => upd({ transportFlat: Number(e.target.value) })} /></div>
          </div>
        </div>
      </div>

      <div className="hm-save-bar">
        <button className="hm-btn hm-btn-acc" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save Rates"}</button>
        {dirty && <span className="hm-dirty-flag">Unsaved changes</span>}
        {ok && <span style={{ color: "#1f9d55", fontSize: 12, fontWeight: 600 }}>{ok}</span>}
      </div>
      {err && <div className="hm-error-banner" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  );
}

// ══ CATALOGUE ══
// Structural editing — names, active flags, photos — for every catalog
// entry. Numeric rates (bar/hinge/hydraulic ₹) live in Rate List above;
// this section only carries `rate` for glasses/addons, matching the
// pre-overhaul convention of editing those two together with their name.
const FLAT_CATALOG_TYPES = [
  { key: "colours", label: "Colours", hasRate: false, hasPhotos: true },
  { key: "glasses", label: "Glass", hasRate: true, hasPhotos: true },
  { key: "addons", label: "Add-ons", hasRate: true, hasPhotos: false },
];

function newItemId(prefix) {
  return `${prefix.slice(0, 3)}-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
}

function PhotoEditor({ photos, uploading, onUpload, onRemove }) {
  return (
    <>
      <div className="hm-photo-row">
        {(photos || []).map((url) => (
          <div className="hm-photo-thumb" key={url}>
            <img src={url} alt="" />
            <button className="hm-photo-rm" onClick={() => onRemove(url)}>×</button>
          </div>
        ))}
      </div>
      <label className="hm-btn hm-btn-ghost hm-btn-sm" style={{ display: "inline-block", marginTop: 8, cursor: "pointer" }}>
        {uploading ? "Uploading…" : "+ Photo"}
        <input
          type="file" accept="image/*" multiple style={{ display: "none" }}
          disabled={uploading}
          onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.target.value = ""; }}
        />
      </label>
    </>
  );
}

function CatalogueSection({ catalog, onSaved }) {
  const [draft, setDraft] = useState(() => structuredClone(catalog));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [uploadingKey, setUploadingKey] = useState(null);

  const markDirty = () => { setDirty(true); setOk(""); };

  // ── flat lists (colours/glasses/addons) ──
  const updFlatItem = (typeKey, id, patch) => {
    setDraft((d) => ({ ...d, [typeKey]: (d[typeKey] || []).map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
    markDirty();
  };
  const addFlatItem = (typeKey, hasRate) => {
    const base = { id: newItemId(typeKey), name: "New item", photos: typeKey === "addons" ? undefined : [], active: typeKey !== "addons" ? true : undefined };
    if (hasRate) base.rate = 0;
    setDraft((d) => ({ ...d, [typeKey]: [...(d[typeKey] || []), base] }));
    markDirty();
  };

  // Upload failures never advance silently — surfaced as a hard error, and
  // the photo is never added to an item's photos[] unless the upload (and
  // the getDownloadURL that follows it) actually succeeded.
  const uploadPhotos = async (storageType, storageId, currentPhotos, files, uploadingTag) => {
    const room = 5 - (currentPhotos?.length || 0);
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (!picked.length) { setErr("This item already has 5 photos — remove one first."); return null; }
    setUploadingKey(uploadingTag);
    setErr("");
    try {
      const urls = [];
      for (const file of picked) urls.push(await uploadCatalogPhoto(storageType, storageId, file));
      return [...(currentPhotos || []), ...urls];
    } catch (e) {
      setErr(e.message || "Photo upload failed.");
      return null;
    } finally {
      setUploadingKey(null);
    }
  };

  const handleFlatPhotoUpload = async (typeKey, id, files) => {
    const item = (draft[typeKey] || []).find((it) => it.id === id);
    const photos = await uploadPhotos(typeKey, id, item.photos, files, `flat-${typeKey}-${id}`);
    if (photos) updFlatItem(typeKey, id, { photos });
  };
  const removeFlatPhoto = (typeKey, id, url) => {
    const item = (draft[typeKey] || []).find((it) => it.id === id);
    updFlatItem(typeKey, id, { photos: (item.photos || []).filter((p) => p !== url) });
  };

  // ── brands (+ nested profile types / handle types) ──
  const updBrand = (brandIdx, patch) => {
    setDraft((d) => { const brands = [...(d.brands || [])]; brands[brandIdx] = { ...brands[brandIdx], ...patch }; return { ...d, brands }; });
    markDirty();
  };
  const addBrand = () => {
    setDraft((d) => ({
      ...d,
      brands: [...(d.brands || []), { id: newItemId("brand"), name: "New Brand", active: true, profileTypes: [], regularBars: freshBarSet(), handleTypes: [] }],
    }));
    markDirty();
  };

  const updProfileType = (brandIdx, ptIdx, patch) => {
    const brand = draft.brands[brandIdx];
    const profileTypes = [...(brand.profileTypes || [])];
    profileTypes[ptIdx] = { ...profileTypes[ptIdx], ...patch };
    updBrand(brandIdx, { profileTypes });
  };
  const addProfileType = (brandIdx) => {
    const brand = draft.brands[brandIdx];
    updBrand(brandIdx, { profileTypes: [...(brand.profileTypes || []), { id: newItemId("prof"), name: "New Profile Type", photos: [], active: true }] });
  };

  const updHandleType = (brandIdx, htIdx, patch) => {
    const brand = draft.brands[brandIdx];
    const handleTypes = [...(brand.handleTypes || [])];
    handleTypes[htIdx] = { ...handleTypes[htIdx], ...patch };
    updBrand(brandIdx, { handleTypes });
  };
  const addHandleType = (brandIdx) => {
    const brand = draft.brands[brandIdx];
    updBrand(brandIdx, { handleTypes: [...(brand.handleTypes || []), { id: newItemId("hdl"), name: "New Handle Type", photos: [], active: true, bars: freshBarSet() }] });
  };

  // ── hinge categories (+ nested brands) ──
  const updHingeCategory = (catIdx, patch) => {
    setDraft((d) => { const hingeCategories = [...(d.hingeCategories || [])]; hingeCategories[catIdx] = { ...hingeCategories[catIdx], ...patch }; return { ...d, hingeCategories }; });
    markDirty();
  };
  const addHingeCategory = () => {
    setDraft((d) => ({ ...d, hingeCategories: [...(d.hingeCategories || []), { id: newItemId("cat"), name: "New Category", brands: [] }] }));
    markDirty();
  };
  const updHingeCategoryBrand = (catIdx, brandIdx, patch) => {
    const cat = draft.hingeCategories[catIdx];
    const brands = [...(cat.brands || [])];
    brands[brandIdx] = { ...brands[brandIdx], ...patch };
    updHingeCategory(catIdx, { brands });
  };
  const addHingeCategoryBrand = (catIdx) => {
    const cat = draft.hingeCategories[catIdx];
    updHingeCategory(catIdx, { brands: [...(cat.brands || []), { id: newItemId("hb"), name: "New Brand", rate: 0, active: true }] });
  };

  // ── lift-up hydraulic systems ──
  const updHydraulic = (i, patch) => {
    setDraft((d) => { const hydraulicSystems = [...(d.liftUp?.hydraulicSystems || [])]; hydraulicSystems[i] = { ...hydraulicSystems[i], ...patch }; return { ...d, liftUp: { ...d.liftUp, hydraulicSystems } }; });
    markDirty();
  };
  const addHydraulic = () => {
    setDraft((d) => ({ ...d, liftUp: { ...d.liftUp, hydraulicSystems: [...(d.liftUp?.hydraulicSystems || []), { id: newItemId("lift"), name: "New Hydraulic System", rate: 0, active: true }] } }));
    markDirty();
  };

  const save = async () => {
    setSaving(true); setErr(""); setOk("");
    try {
      await saveCatalog(draft);
      onSaved(draft);
      setDirty(false);
      setOk("Catalogue saved. Deactivated items vanish from the microsite immediately but stay intact on past orders.");
    } catch (e) {
      setErr(e.message || "Failed to save catalogue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="hm-section-title">Catalogue</div>
      <div className="hm-section-sub">Brands, profile types, handle types, colours, glass, add-ons, hinge categories, and lift-up systems. Photo uploads happen immediately; every other edit saves with the button below.</div>

      <div className="hm-plate" style={{ marginBottom: 14 }}>
        <div className="hm-plate-hd">
          <span className="hm-plate-title">Brands</span>
          <span className="hm-plate-sub"><button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={addBrand}>+ Add Brand</button></span>
        </div>
        <div className="hm-plate-body">
          {(draft.brands || []).map((brand, brandIdx) => (
            <div className="hm-catalog-item" key={brand.id}>
              <div className="hm-catalog-item-hd">
                <input className="hm-input" style={{ maxWidth: 240 }} value={brand.name} onChange={(e) => updBrand(brandIdx, { name: e.target.value })} />
                <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={brand.active !== false} onChange={(e) => updBrand(brandIdx, { active: e.target.checked })} /> Active
                </label>
                <span style={{ fontSize: 10, color: "#6b6d76", marginLeft: "auto" }}>{brand.id}</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="hm-detail-block-hd">Profile Types <button className="hm-btn hm-btn-ghost hm-btn-sm" style={{ marginLeft: 8 }} onClick={() => addProfileType(brandIdx)}>+ Add</button></div>
                {(brand.profileTypes || []).map((pt, ptIdx) => (
                  <div className="hm-catalog-item" key={pt.id} style={{ marginLeft: 14 }}>
                    <div className="hm-catalog-item-hd">
                      <input className="hm-input" style={{ maxWidth: 240 }} value={pt.name} onChange={(e) => updProfileType(brandIdx, ptIdx, { name: e.target.value })} />
                      <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="checkbox" checked={pt.active !== false} onChange={(e) => updProfileType(brandIdx, ptIdx, { active: e.target.checked })} /> Active
                      </label>
                      <span style={{ fontSize: 10, color: "#6b6d76", marginLeft: "auto" }}>{pt.id}</span>
                    </div>
                    <PhotoEditor
                      photos={pt.photos}
                      uploading={uploadingKey === `pt-${brandIdx}-${ptIdx}`}
                      onUpload={async (files) => {
                        const photos = await uploadPhotos("profileTypes", `${brand.id}_${pt.id}`, pt.photos, files, `pt-${brandIdx}-${ptIdx}`);
                        if (photos) updProfileType(brandIdx, ptIdx, { photos });
                      }}
                      onRemove={(url) => updProfileType(brandIdx, ptIdx, { photos: (pt.photos || []).filter((p) => p !== url) })}
                    />
                  </div>
                ))}
                {(brand.profileTypes || []).length === 0 && <div className="hm-sched-empty">No profile types yet.</div>}
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="hm-detail-block-hd">Handle Types <button className="hm-btn hm-btn-ghost hm-btn-sm" style={{ marginLeft: 8 }} onClick={() => addHandleType(brandIdx)}>+ Add</button></div>
                {(brand.handleTypes || []).map((ht, htIdx) => (
                  <div className="hm-catalog-item" key={ht.id} style={{ marginLeft: 14 }}>
                    <div className="hm-catalog-item-hd">
                      <input className="hm-input" style={{ maxWidth: 240 }} value={ht.name} onChange={(e) => updHandleType(brandIdx, htIdx, { name: e.target.value })} />
                      <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="checkbox" checked={ht.active !== false} onChange={(e) => updHandleType(brandIdx, htIdx, { active: e.target.checked })} /> Active
                      </label>
                      <span style={{ fontSize: 10, color: "#6b6d76", marginLeft: "auto" }}>{ht.id}</span>
                    </div>
                    <PhotoEditor
                      photos={ht.photos}
                      uploading={uploadingKey === `ht-${brandIdx}-${htIdx}`}
                      onUpload={async (files) => {
                        const photos = await uploadPhotos("handleTypes", `${brand.id}_${ht.id}`, ht.photos, files, `ht-${brandIdx}-${htIdx}`);
                        if (photos) updHandleType(brandIdx, htIdx, { photos });
                      }}
                      onRemove={(url) => updHandleType(brandIdx, htIdx, { photos: (ht.photos || []).filter((p) => p !== url) })}
                    />
                  </div>
                ))}
                {(brand.handleTypes || []).length === 0 && <div className="hm-sched-empty">No handle types yet.</div>}
              </div>
            </div>
          ))}
          {(draft.brands || []).length === 0 && <div className="hm-sched-empty">No brands yet.</div>}
        </div>
      </div>

      {FLAT_CATALOG_TYPES.map(({ key, label, hasRate, hasPhotos }) => (
        <div className="hm-plate" key={key} style={{ marginBottom: 14 }}>
          <div className="hm-plate-hd">
            <span className="hm-plate-title">{label}</span>
            <span className="hm-plate-sub"><button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => addFlatItem(key, hasRate)}>+ Add</button></span>
          </div>
          <div className="hm-plate-body">
            {(draft[key] || []).map((item) => (
              <div className="hm-catalog-item" key={item.id}>
                <div className="hm-catalog-item-hd">
                  <input className="hm-input" style={{ maxWidth: 240 }} value={item.name} onChange={(e) => updFlatItem(key, item.id, { name: e.target.value })} />
                  {hasRate && <input className="hm-input" style={{ maxWidth: 100 }} type="number" value={item.rate} onChange={(e) => updFlatItem(key, item.id, { rate: Number(e.target.value) })} placeholder="₹ rate" />}
                  {"active" in item && (
                    <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={item.active !== false} onChange={(e) => updFlatItem(key, item.id, { active: e.target.checked })} /> Active
                    </label>
                  )}
                  <span style={{ fontSize: 10, color: "#6b6d76", marginLeft: "auto" }}>{item.id}</span>
                </div>
                {hasPhotos && (
                  <PhotoEditor
                    photos={item.photos}
                    uploading={uploadingKey === `flat-${key}-${item.id}`}
                    onUpload={(files) => handleFlatPhotoUpload(key, item.id, files)}
                    onRemove={(url) => removeFlatPhoto(key, item.id, url)}
                  />
                )}
              </div>
            ))}
            {(draft[key] || []).length === 0 && <div className="hm-sched-empty">Nothing here yet.</div>}
          </div>
        </div>
      ))}

      <div className="hm-plate" style={{ marginBottom: 14 }}>
        <div className="hm-plate-hd"><span className="hm-plate-title">Hinge Categories</span><span className="hm-plate-sub"><button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={addHingeCategory}>+ Add Category</button></span></div>
        <div className="hm-plate-body">
          {(draft.hingeCategories || []).map((cat, catIdx) => (
            <div className="hm-catalog-item" key={cat.id}>
              <div className="hm-catalog-item-hd">
                <input className="hm-input" style={{ maxWidth: 240 }} value={cat.name} onChange={(e) => updHingeCategory(catIdx, { name: e.target.value })} />
                <span style={{ fontSize: 10, color: "#6b6d76", marginLeft: "auto" }}>{cat.id}</span>
              </div>
              <div className="hm-detail-block-hd" style={{ marginTop: 8 }}>Brands <button className="hm-btn hm-btn-ghost hm-btn-sm" style={{ marginLeft: 8 }} onClick={() => addHingeCategoryBrand(catIdx)}>+ Add</button></div>
              {(cat.brands || []).map((b, brandIdx) => (
                <div className="hm-catalog-item-hd" key={b.id} style={{ marginLeft: 14, marginBottom: 6 }}>
                  <input className="hm-input" style={{ maxWidth: 200 }} value={b.name} onChange={(e) => updHingeCategoryBrand(catIdx, brandIdx, { name: e.target.value })} />
                  <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="checkbox" checked={b.active !== false} onChange={(e) => updHingeCategoryBrand(catIdx, brandIdx, { active: e.target.checked })} /> Active
                  </label>
                  <span style={{ fontSize: 10, color: "#6b6d76" }}>rate set in Rate List</span>
                </div>
              ))}
              {(cat.brands || []).length === 0 && <div className="hm-sched-empty">No brands yet.</div>}
            </div>
          ))}
          {(draft.hingeCategories || []).length === 0 && <div className="hm-sched-empty">No hinge categories yet.</div>}
        </div>
      </div>

      <div className="hm-plate" style={{ marginBottom: 14 }}>
        <div className="hm-plate-hd"><span className="hm-plate-title">Lift-Up Hydraulic Systems</span><span className="hm-plate-sub"><button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={addHydraulic}>+ Add</button></span></div>
        <div className="hm-plate-body">
          {(draft.liftUp?.hydraulicSystems || []).map((h, i) => (
            <div className="hm-catalog-item-hd" key={h.id} style={{ marginBottom: 6 }}>
              <input className="hm-input" style={{ maxWidth: 240 }} value={h.name} onChange={(e) => updHydraulic(i, { name: e.target.value })} />
              <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={h.active !== false} onChange={(e) => updHydraulic(i, { active: e.target.checked })} /> Active
              </label>
              <span style={{ fontSize: 10, color: "#6b6d76" }}>rate set in Rate List</span>
            </div>
          ))}
          {(draft.liftUp?.hydraulicSystems || []).length === 0 && <div className="hm-sched-empty">Nothing here yet.</div>}
        </div>
      </div>

      <div className="hm-save-bar">
        <button className="hm-btn hm-btn-acc" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save Catalogue"}</button>
        {dirty && <span className="hm-dirty-flag">Unsaved changes</span>}
        {ok && <span style={{ color: "#1f9d55", fontSize: 12, fontWeight: 600 }}>{ok}</span>}
      </div>
      {err && <div className="hm-error-banner" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  );
}

// ══ VENDORS ══
function VendorsSection() {
  const [vendors, setVendors] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", type: "profile", region: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const refresh = async () => {
    try { setVendors(await loadVendors()); } catch (e) { setErr(e.message || "Failed to load vendors."); }
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await loadVendors();
        if (!cancelled) setVendors(v);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load vendors.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startEdit = (v) => { setEditingId(v.id); setForm({ name: v.name, type: v.type, region: v.region || "", email: v.email || "", phone: v.phone || "" }); };
  const resetForm = () => { setEditingId(null); setForm({ name: "", type: "profile", region: "", email: "", phone: "" }); };

  const submit = async () => {
    if (!form.name.trim()) { setErr("Vendor name is required."); return; }
    setSaving(true); setErr("");
    try {
      await saveVendor(editingId, { name: form.name.trim(), type: form.type, region: form.region.trim(), email: form.email.trim(), phone: form.phone.trim() });
      resetForm();
      await refresh();
    } catch (e) {
      setErr(e.message || "Failed to save vendor.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v) => {
    setErr("");
    try { await setVendorActive(v.id, !v.active); await refresh(); } catch (e) { setErr(e.message || "Failed to update vendor status."); }
  };

  if (!vendors) return <div style={{ padding: 20, color: "#6b6d76" }}>Loading vendors…</div>;

  const renderList = (type, title) => (
    <div className="hm-plate" style={{ marginBottom: 14 }}>
      <div className="hm-plate-hd"><span className="hm-plate-title">{title}</span></div>
      <div className="hm-plate-body">
        <table className="hm-table">
          <thead><tr><th>Name</th><th>Region</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {vendors.filter((v) => v.type === type).map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td><td>{v.region}</td><td>{v.email}</td><td>{v.phone}</td>
                <td><span className={`hm-badge ${v.active ? "hm-badge-ok" : "hm-badge-neutral"}`}>{v.active ? "Active" : "Inactive"}</span></td>
                <td>
                  <button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => startEdit(v)}>Edit</button>{" "}
                  <button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => toggleActive(v)}>{v.active ? "Deactivate" : "Activate"}</button>
                </td>
              </tr>
            ))}
            {vendors.filter((v) => v.type === type).length === 0 && <tr><td colSpan={6} style={{ color: "#6b6d76" }}>No vendors yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div className="hm-section-title">Vendors</div>
      <div className="hm-section-sub">Profile makers and glass suppliers, used for manual order assignment — never auto-routed.</div>

      {renderList("profile", "Profile Makers")}
      {renderList("glass", "Glass Suppliers")}

      <div className="hm-plate">
        <div className="hm-plate-hd"><span className="hm-plate-title">{editingId ? "Edit Vendor" : "Add Vendor"}</span></div>
        <div className="hm-plate-body">
          <div className="hm-field-grid">
            <div className="hm-field"><div className="hm-field-label">Name <span className="req">*</span></div><input className="hm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="hm-field">
              <div className="hm-field-label">Type</div>
              <select className="hm-vendor-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="profile">Profile maker</option>
                <option value="glass">Glass supplier</option>
              </select>
            </div>
            <div className="hm-field"><div className="hm-field-label">Region</div><input className="hm-input" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="e.g. Bengaluru North" /></div>
            <div className="hm-field"><div className="hm-field-label">Email</div><input className="hm-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className="hm-field"><div className="hm-field-label">Phone</div><input className="hm-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <div className="hm-save-bar">
            <button className="hm-btn hm-btn-acc" disabled={saving} onClick={submit}>{saving ? "Saving…" : editingId ? "Save Changes" : "+ Add Vendor"}</button>
            {editingId && <button className="hm-btn hm-btn-ghost" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      </div>
      {err && <div className="hm-error-banner" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  );
}

// ══ ORDERS ══
const STATUS_LABELS = {
  new: "New", confirmed: "Confirmed", in_production: "In Production", glass_ordered: "Glass Ordered",
  ready: "Ready", dispatched: "Dispatched", delivered: "Delivered", rejected: "Rejected",
};
const NEXT_STATUS_LABEL = {
  confirmed: "In Production", in_production: "Glass Ordered", glass_ordered: "Ready", ready: "Dispatched", dispatched: "Delivered",
};

function OrdersSection({ catalog }) {
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [vendors, setVendors] = useState(null);
  const [assignPick, setAssignPick] = useState({ profile: "", glass: "" });
  const [busy, setBusy] = useState(false);
  const [chit, setChit] = useState(null);

  const refresh = async (f) => {
    try { setOrders(await loadOrders(f)); } catch (e) { setErr(e.message || "Failed to load orders."); }
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await loadOrders(filter);
        if (!cancelled) setOrders(o);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load orders.");
      }
    })();
    return () => { cancelled = true; };
  }, [filter]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await loadVendors();
        if (!cancelled) setVendors(v);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load vendors.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = orders?.find((o) => o.id === selectedId) || null;
  const profileVendors = (vendors || []).filter((v) => v.type === "profile" && v.active);
  const glassVendors = (vendors || []).filter((v) => v.type === "glass" && v.active);

  const doApprove = async () => {
    const pv = vendors.find((v) => v.id === assignPick.profile);
    const gv = vendors.find((v) => v.id === assignPick.glass);
    if (!pv || !gv) { setErr("Pick both a profile maker and a glass supplier before approving."); return; }
    setBusy(true); setErr("");
    try {
      await approveAndAssignOrder(selected, { profileVendor: pv, glassVendor: gv });
      setAssignPick({ profile: "", glass: "" });
      await refresh(filter);
    } catch (e) {
      setErr(e.message || "Failed to approve/assign this order.");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    setBusy(true); setErr("");
    try { await rejectOrder(selected.id); await refresh(filter); } catch (e) { setErr(e.message || "Failed to reject this order."); } finally { setBusy(false); }
  };

  const doAdvance = async () => {
    const idx = ORDER_STATUS_LIFECYCLE.indexOf(selected.status);
    const nextKey = ORDER_STATUS_LIFECYCLE[idx + 1];
    if (!nextKey) return;
    setBusy(true); setErr("");
    try { await advanceOrderStatus(selected.id, nextKey); await refresh(filter); } catch (e) { setErr(e.message || "Failed to advance order status."); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="hm-section-title">Orders</div>
      <div className="hm-section-sub">Queue ordered by status, most recent first (Block-1 composite index).</div>

      <div style={{ marginBottom: 14 }}>
        <select className="hm-vendor-select" style={{ maxWidth: 240 }} value={filter} onChange={(e) => { setFilter(e.target.value); setSelectedId(null); }}>
          <option value="all">All statuses</option>
          {["new", ...ORDER_STATUS_LIFECYCLE, "rejected"].map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
        </select>
      </div>

      {!orders && <div style={{ padding: 20, color: "#6b6d76" }}>Loading orders…</div>}
      {orders && orders.length === 0 && <div className="hm-sched-empty">No orders in this status.</div>}

      {orders && orders.length > 0 && (
        <table className="hm-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hm-order-row" onClick={() => setSelectedId(o.id)} style={selectedId === o.id ? { background: "#faf6f2" } : undefined}>
                <td>{o.orderNo}</td>
                <td>{o.customer?.name}</td>
                <td><span className="hm-badge hm-badge-neutral">{STATUS_LABELS[o.status] || o.status}</span></td>
                <td>{o.paymentMethod === "cod" ? "COD" : "Online"} · <span style={{ color: "#6b6d76" }}>{o.paymentStatus}</span></td>
                <td>{fmtINR(o.pricingSnapshot?.grand)}</td>
                <td>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="hm-order-detail">
          <div className="hm-detail-grid">
            <div className="hm-detail-block">
              <div className="hm-detail-block-hd">Customer</div>
              <div>{selected.customer?.name}</div>
              <div>{selected.customer?.phone}</div>
              {selected.customer?.email && <div>{selected.customer.email}</div>}
              <div style={{ marginTop: 6, fontSize: 11, color: "#6b6d76" }}>
                {[selected.address?.flat, selected.address?.street, selected.address?.area, selected.address?.city].filter(Boolean).join(", ")} — PIN {selected.customer?.pincode}
              </div>
            </div>
            <div className="hm-detail-block">
              <div className="hm-detail-block-hd">Price (frozen at checkout)</div>
              <div>Basic {fmtINR(selected.pricingSnapshot?.basic)}</div>
              <div>GST ({selected.pricingSnapshot?.gstPct}%) {fmtINR(selected.pricingSnapshot?.gst)}</div>
              <div>Transport {fmtINR(selected.pricingSnapshot?.transport)}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>Total {fmtINR(selected.pricingSnapshot?.grand)}</div>
            </div>
          </div>

          {/* Block 6 (additive, multi-site delivery) — orders placed before
              this shipped have no `sites` array at all; this block simply
              doesn't render for them, leaving the Customer block above as
              the sole address display, exactly as it always was. */}
          {selected.sites?.length > 0 && (
            <div className="hm-detail-block" style={{ marginBottom: 16 }}>
              <div className="hm-detail-block-hd">Sites ({selected.sites.length})</div>
              {selected.sites.map((site) => {
                const addr = site.address || {};
                const defaultSiteId = selected.sites[0].siteId;
                const cabsForSite = (selected.cabinets || []).filter((c) => (c.siteId || defaultSiteId) === site.siteId);
                return (
                  <div key={site.siteId} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px dashed var(--hm-line)" }}>
                    <div style={{ fontWeight: 700 }}>{site.label}</div>
                    <div style={{ fontSize: 11, color: "#6b6d76" }}>
                      {[addr.flat, addr.street, addr.area, addr.city].filter(Boolean).join(", ")} — PIN {addr.pincode}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b6d76", marginTop: 2 }}>{cabsForSite.length} cabinet{cabsForSite.length === 1 ? "" : "s"}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="hm-detail-block" style={{ marginBottom: 16 }}>
            <div className="hm-detail-block-hd">Cabinets ({selected.cabinets?.length || 0})</div>
            <table className="hm-table">
              <thead><tr><th>#</th><th>Profile</th><th>Glass</th><th>Size</th><th>Qty</th><th>Shutters</th><th>Bar</th>{selected.sites?.length > 1 && <th>Site</th>}<th>Price</th></tr></thead>
              <tbody>
                {(selected.cabinets || []).map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{c.brandId} / {c.profileTypeId}</td>
                    <td>{c.glassId}</td>
                    <td>{c.shutterW}×{c.shutterH}mm</td>
                    <td>{c.qty}</td>
                    <td>{c.totalShutters}</td>
                    <td>{c.regularBar?.label}{!c.regularBar?.ok && " ⚠"}{c.handleBar && ` + ${c.handleBar.label}${!c.handleBar.ok ? " ⚠" : ""}`}</td>
                    {selected.sites?.length > 1 && <td>{c.siteId}</td>}
                    <td>{fmtINR(c.indicativeTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected.attachments?.length > 0 && (
            <div className="hm-detail-block" style={{ marginBottom: 16 }}>
              <div className="hm-detail-block-hd">Attachments</div>
              {selected.attachments.map((a, i) => <div key={i}><a href={a.url} target="_blank" rel="noreferrer">{a.name}</a></div>)}
            </div>
          )}

          {/* COD orders wait for a manual human decision — carry-over from Block 2:
              this is order.paymentStatus === 'cod_pending_approval', NOT order.status. */}
          {selected.status === "new" && selected.paymentStatus === "cod_pending_approval" && (
            <div className="hm-detail-block" style={{ marginBottom: 16 }}>
              <div className="hm-detail-block-hd">Approve &amp; Assign (Cash on Delivery)</div>
              <div className="hm-field-grid">
                <div className="hm-field">
                  <div className="hm-field-label">Profile maker</div>
                  <select className="hm-vendor-select" value={assignPick.profile} onChange={(e) => setAssignPick((p) => ({ ...p, profile: e.target.value }))}>
                    <option value="">Select…</option>
                    {profileVendors.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.region}</option>)}
                  </select>
                </div>
                <div className="hm-field">
                  <div className="hm-field-label">Glass supplier</div>
                  <select className="hm-vendor-select" value={assignPick.glass} onChange={(e) => setAssignPick((p) => ({ ...p, glass: e.target.value }))}>
                    <option value="">Select…</option>
                    {glassVendors.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.region}</option>)}
                  </select>
                </div>
              </div>
              <div className="hm-save-bar">
                <button className="hm-btn hm-btn-acc" disabled={busy || !assignPick.profile || !assignPick.glass} onClick={doApprove}>Approve &amp; Assign</button>
                <button className="hm-btn hm-btn-danger" disabled={busy} onClick={doReject}>Reject</button>
              </div>
            </div>
          )}

          {/* Online payment is parked (TODO(block4-payment) — no gateway
              wired up yet; the microsite currently only lets a customer
              submit "cod"). An order sitting here would be stuck with no
              way forward until a future block reconciles it — shouldn't
              occur in practice today, but the banner stays honest rather
              than implying an automatic resolution that doesn't exist. */}
          {selected.status === "new" && selected.paymentStatus === "pending_payment" && (
            <div className="hm-error-banner" style={{ marginBottom: 16, background: "#fff7ed", borderColor: "#f59e0b", color: "#92400e" }}>
              Awaiting online payment. Online payment isn't wired up yet (TODO(block4-payment)) — no admin action is available for this order.
            </div>
          )}

          {ORDER_STATUS_LIFECYCLE.includes(selected.status) && selected.status !== "delivered" && (
            <div className="hm-save-bar">
              <button className="hm-btn hm-btn-acc" disabled={busy} onClick={doAdvance}>Advance to "{NEXT_STATUS_LABEL[selected.status]}"</button>
            </div>
          )}

          {selected.status !== "new" && selected.status !== "rejected" && (
            <div className="hm-save-bar">
              <button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => setChit({ kind: "production", order: selected })}>Production Chit</button>
              <button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => setChit({ kind: "profile", order: selected })}>Profile Order</button>
              <button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => setChit({ kind: "glass", order: selected })}>Glass Chit</button>
              <button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => setChit({ kind: "delivery", order: selected })}>Delivery Labels</button>
            </div>
          )}
        </div>
      )}

      {err && <div className="hm-error-banner" style={{ marginTop: 12 }}>{err}</div>}
      {chit && <ChitModal kind={chit.kind} order={chit.order} catalog={catalog} onClose={() => setChit(null)} />}
    </div>
  );
}

function ChitModal({ kind, order, catalog, onClose }) {
  const data = useMemo(() => {
    if (kind === "production") return buildProductionChit(order, catalog);
    if (kind === "profile") return buildProfileChit(order, catalog);
    if (kind === "glass") return buildGlassChit(order);
    if (kind === "delivery") return buildDeliveryChits(order);
    return null;
  }, [kind, order, catalog]);

  const titles = { production: "Production Chit", profile: "Profile Order", glass: "Glass Chit", delivery: "Delivery Labels" };

  return (
    <div className="hm-chit-overlay" onClick={onClose}>
      <div className="hm-chit-paper" onClick={(e) => e.stopPropagation()}>
        <button className="hm-chit-close hm-btn hm-btn-ghost hm-btn-sm" onClick={onClose}>Close</button>
        <div className="hm-chit-hd">
          <HomBrandMark />
          <div>
            <div className="hm-chit-title">{titles[kind]}</div>
            <div className="hm-chit-order">{order.orderNo}</div>
          </div>
        </div>

        {kind === "production" && data.cabinets.map((c) => (
          <div key={c.index} style={{ marginBottom: 14, borderBottom: "1px solid var(--hm-line)", paddingBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Cabinet {c.index} — {c.brandName} {c.profileName} / {c.colourName} / {c.glassName}</div>
            <div style={{ fontSize: 12 }}>Shutter {c.shutterSize} · {c.totalShutters} shutters · qty {c.qty} · Bar: {c.barLabel}{!c.barOk && " (custom cut needed)"}{c.handleBarLabel && ` · Handle bar: ${c.handleBarLabel}${!c.handleBarOk ? " (custom cut needed)" : ""}`}</div>
            <ul style={{ marginLeft: 18, fontSize: 12 }}>
              {c.pieces.map((p, i) => <li key={i}>{p.qty} × {p.label} — {p.lengthMm}mm</li>)}
            </ul>
          </div>
        ))}

        {kind === "profile" && data.lines.map((l) => (
          <div key={l.index} style={{ marginBottom: 14, borderBottom: "1px solid var(--hm-line)", paddingBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Cabinet {l.index} — {l.brandName} {l.profileName} / {l.colourName}</div>
            <ul style={{ marginLeft: 18, fontSize: 12 }}>
              {l.pieces.map((p, i) => <li key={i}>{p.qty} × {p.label} — {p.lengthMm}mm</li>)}
            </ul>
          </div>
        ))}

        {kind === "glass" && (
          <table className="hm-table">
            <thead><tr><th>#</th><th>Glass</th><th>Add-ons</th><th>Cut size</th><th>Qty</th><th>Area</th></tr></thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.index}>
                  <td>{l.index}</td><td>{l.glassName}</td><td>{l.addonNames.join(", ") || "—"}</td>
                  <td>{l.cutSize}</td><td>{l.totalShutters}</td><td>{l.glassArea} sqft</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Block 6 — one delivery chit PER SITE, each carrying its own
            logo + order no + site label header (per spec: a site's chit is
            a standalone printable document once the sheet is cut apart) —
            not just the shared modal header above, which stays "Delivery
            Labels" / order no only regardless of site count. */}
        {kind === "delivery" && data.map((site) => (
          <div key={site.siteId} style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px dashed var(--hm-line)" }}>
            <div className="hm-chit-hd" style={{ marginBottom: 10, paddingBottom: 8 }}>
              <HomBrandMark />
              <div>
                <div className="hm-chit-title">Delivery — {site.label}</div>
                <div className="hm-chit-order">{site.orderNo}</div>
              </div>
            </div>
            {site.packages.map((pkg) => (
              <div className="hm-chit-label" key={pkg.index}>
                <div style={{ fontSize: 11, color: "#6b6d76" }}>Package {pkg.index} of {pkg.packageOf}</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{site.orderNo} · {site.label}</div>
                <div style={{ marginTop: 6 }}>{site.customerName} · {site.customerPhone}</div>
                <div>{site.siteAddress}</div>
                <div>PIN: {site.pincode}</div>
                <div style={{ marginTop: 6, fontSize: 12 }}>{pkg.shutterSize} · {pkg.totalShutters} shutters · qty {pkg.qty}</div>
              </div>
            ))}
          </div>
        ))}

        <button className="hm-btn hm-btn-acc hm-chit-print-btn" style={{ marginTop: 12 }} onClick={() => window.print()}>Print</button>
      </div>
    </div>
  );
}

// ══ LOGS ══
function LogsSection() {
  const [profileLog, setProfileLog] = useState(null);
  const [glassLog, setGlassLog] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [p, g] = await Promise.all([loadSupplierOrders("profile"), loadSupplierOrders("glass")]);
        setProfileLog(p); setGlassLog(g);
      } catch (e) {
        setErr(e.message || "Failed to load logs.");
      }
    })();
  }, []);

  const renderLog = (title, rows) => (
    <div className="hm-plate" style={{ marginBottom: 14 }}>
      <div className="hm-plate-hd"><span className="hm-plate-title">{title}</span></div>
      <div className="hm-plate-body">
        {!rows ? (
          <div style={{ color: "#6b6d76" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="hm-sched-empty">Nothing sent yet.</div>
        ) : (
          <table className="hm-table">
            <thead><tr><th>Order</th><th>Vendor</th><th>Region</th><th>Items</th><th>Sent</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.orderNo}</td>
                  <td>{r.vendorName}</td>
                  <td>{r.region}</td>
                  <td>{r.items?.length || 0} item(s)</td>
                  <td>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : "—"}</td>
                  <td><span className="hm-badge hm-badge-neutral">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="hm-section-title">Logs</div>
      <div className="hm-section-sub">Every purchase order sent to a profile maker or glass supplier.</div>
      {renderLog("Profile Maker Log", profileLog)}
      {renderLog("Glass Supplier Log", glassLog)}
      {err && <div className="hm-error-banner">{err}</div>}
    </div>
  );
}
