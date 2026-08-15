// HOM Systems — the customer-facing cabinet builder (rate-list + optimiser
// overhaul). All prices shown here come from src/utils/homPricing.js reading
// the live homConfig/catalog doc — nothing in this file hardcodes a rate.
// The live per-cabinet preview uses estimateCabinet (priced as if this
// cabinet were the whole order — indicative, since adding more cabinets can
// change the pooled bar allocation); the sticky quote panel uses priceOrder
// over the WHOLE schedule, so it always shows the real pooled total.
import { useEffect, useMemo, useState } from "react";
import { priceOrder, estimateCabinet } from "../../utils/homPricing";
import { submitHomOrder, uploadHomOrderFiles, resolveSiteLabel, DEFAULT_SITE_LABEL } from "../../utils/homOrder";
import { ShuttersPerCabDiagram } from "./homDiagrams";
import { HomAuthGate } from "./HomAuthGate";

const MAX_FILE_MB = 15;
const ACCEPTED_FILE_TYPES = ["image/", "application/pdf"];

function fmtINR(n) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

function isAcceptedFile(file) {
  return ACCEPTED_FILE_TYPES.some((t) => file.type.startsWith(t));
}

function active(list) {
  return (list || []).filter((item) => item.active !== false);
}

// Photo gallery used by every tile — prev/next through photos[], or a clean
// placeholder frame when the catalog entry has none (brands, hinge
// categories/brands, and lift-up systems never carry photos, so this is
// their normal state, not an error state).
function PhotoGallery({ photos }) {
  const [idx, setIdx] = useState(0);
  const list = photos || [];
  if (!list.length) {
    return (
      <div className="hm-tile-photo">
        <div className="hm-tile-placeholder">No photo yet</div>
      </div>
    );
  }
  const go = (e, delta) => {
    e.stopPropagation();
    setIdx((i) => (i + delta + list.length) % list.length);
  };
  return (
    <div className="hm-tile-photo">
      <img src={list[idx]} alt="" />
      {list.length > 1 && (
        <>
          <button type="button" className="hm-gal-btn hm-gal-prev" onClick={(e) => go(e, -1)}>‹</button>
          <button type="button" className="hm-gal-btn hm-gal-next" onClick={(e) => go(e, 1)}>›</button>
          <div className="hm-gal-dots">
            {list.map((_, i) => <span key={i} className={`hm-gal-dot ${i === idx ? "on" : ""}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

function TileGrid({ items, selectedId, onSelect }) {
  return (
    <div className="hm-tile-grid">
      {items.map((item) => (
        <div key={item.id} className={`hm-tile ${selectedId === item.id ? "on" : ""}`} onClick={() => onSelect(item.id)}>
          <PhotoGallery photos={item.photos} />
          <div className="hm-tile-name">{item.name}</div>
        </div>
      ))}
    </div>
  );
}

function Plate({ title, sub, children }) {
  return (
    <div className="hm-plate">
      <div className="hm-plate-hd">
        <span className="hm-plate-title">{title}</span>
        {sub && <span className="hm-plate-sub">{sub}</span>}
      </div>
      <div className="hm-plate-body">{children}</div>
    </div>
  );
}

// One site's delivery-address fields — used both for the single-address
// case (today's flow, unchanged in substance) and once per site when an
// order spans more than one project/site label. `address` is always a
// plain {flat,street,area,city,pincode} object (see getSiteAddress in
// HomBuilder).
function SiteAddressFields({ address, onChange, touched }) {
  // Optional: blank passes (nothing to place an order without a pincode
  // needs to satisfy); a value that IS entered must still be a real
  // 6-digit pincode — see firestore.rules' matching relaxation.
  const trimmedPincode = (address.pincode || "").trim();
  const pincodeValid = trimmedPincode === "" || /^[0-9]{6}$/.test(trimmedPincode);
  return (
    <div className="hm-field-grid">
      <div className="hm-field">
        <div className="hm-field-label">Flat / Unit</div>
        <input className="hm-input" value={address.flat} onChange={(e) => onChange({ flat: e.target.value })} />
      </div>
      <div className="hm-field">
        <div className="hm-field-label">Street</div>
        <input className="hm-input" value={address.street} onChange={(e) => onChange({ street: e.target.value })} />
      </div>
      <div className="hm-field">
        <div className="hm-field-label">Area</div>
        <input className="hm-input" value={address.area} onChange={(e) => onChange({ area: e.target.value })} />
      </div>
      <div className="hm-field">
        <div className="hm-field-label">City</div>
        <input className="hm-input" value={address.city} onChange={(e) => onChange({ city: e.target.value })} />
      </div>
      <div className="hm-field hm-field-full">
        <div className="hm-field-label">Pincode (optional)</div>
        <input className={`hm-input ${touched && !pincodeValid ? "err" : ""}`} value={address.pincode} onChange={(e) => onChange({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="6-digit pincode" />
        {touched && !pincodeValid && <div className="hm-field-err">Enter a valid 6-digit pincode, or leave it blank.</div>}
      </div>
    </div>
  );
}

function Stepper({ value, min = 1, max = 99, onChange }) {
  return (
    <div className="hm-stepper">
      <button type="button" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <div className="hm-stepper-val">{value}</div>
      <button type="button" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

const emptyBuilder = (catalog) => ({
  brandId: null,
  profileTypeId: null,
  colourId: null,
  fourthSide: "none",
  glassId: null,
  addons: [],
  liftUp: false,
  hydraulicId: null,
  hingeCategoryId: catalog.hingeCategories?.[0]?.id || null,
  hingeBrandId: null,
  shuttersPerCab: 2,
  hingesPerShutter: 2,
  cabW: "",
  cabH: "",
  qty: 1,
  projectLabel: "",
});

export function HomBuilder({ catalog, onPlaceOrder, authUser, onAuthed }) {
  const brands = active(catalog.brands);
  const colours = active(catalog.colours);
  const glasses = active(catalog.glasses);
  const addons = catalog.addons || [];
  const hingeCategories = catalog.hingeCategories || [];
  const hydraulics = active(catalog.liftUp?.hydraulicSystems);

  const [builder, setBuilder] = useState(() => emptyBuilder(catalog));
  const [editingId, setEditingId] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", notes: "" });
  // Multi-site delivery (additive): one address per distinct project/site
  // label, keyed by that label — resolveSiteLabel() is the SAME function
  // homOrder.js uses to build sites[]/stamp cabinet.siteId, so a site here
  // always matches the site the order ends up storing. Replaces the old
  // single `address` state; the single-address case (0 or 1 distinct
  // labels) is just this map holding exactly one entry, rendered with no
  // extra grouping UI — see distinctSiteLabels below.
  const [siteAddresses, setSiteAddresses] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [touched, setTouched] = useState(false);
  // Block 5 — login gate: shown only when "Place Order" is clicked with no
  // signed-in user (see placeOrder below). Never blocks browsing/building.
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Prefills from the logged-in account WITHOUT clobbering anything the
  // customer already typed — only fills fields that are still blank, and
  // only once real values arrive (covers both "already logged in on page
  // load" and "just completed the auth gate").
  useEffect(() => {
    if (!authUser) return;
    setCustomer((c) => ({
      ...c,
      name: c.name || authUser.name || "",
      phone: c.phone || authUser.phone || "",
    }));
  }, [authUser]);

  const upd = (patch) => setBuilder((b) => ({ ...b, ...patch }));

  const selectedBrand = brands.find((b) => b.id === builder.brandId) || null;
  const profileTypes = active(selectedBrand?.profileTypes);
  const handleTypes = active(selectedBrand?.handleTypes);
  const fourthSideOptions = [{ id: "none", name: "Handle-less", photos: catalog.handleless?.photos || [] }, ...handleTypes];

  const selectBrand = (brandId) => upd({ brandId, profileTypeId: null, fourthSide: "none" });

  const selectedHingeCategory = hingeCategories.find((c) => c.id === builder.hingeCategoryId) || null;
  const hingeBrands = active(selectedHingeCategory?.brands);
  const selectHingeCategory = (hingeCategoryId) => upd({ hingeCategoryId, hingeBrandId: null });

  const cabWNum = Number(builder.cabW);
  const cabHNum = Number(builder.cabH);
  const dimsValid = builder.cabW !== "" && builder.cabH !== "" && cabWNum > 0 && cabHNum > 0;
  const canPreview =
    builder.brandId && builder.profileTypeId && builder.colourId && builder.glassId
    && builder.hingeCategoryId && builder.hingeBrandId
    && (!builder.liftUp || builder.hydraulicId)
    && dimsValid;

  const preview = useMemo(() => {
    if (!canPreview) return null;
    try {
      return estimateCabinet(catalog, { ...builder, cabW: cabWNum, cabH: cabHNum });
    } catch {
      return null;
    }
  }, [canPreview, catalog, builder, cabWNum, cabHNum]);

  const orderTotals = useMemo(() => priceOrder(catalog, schedule.map((s) => s.input)), [catalog, schedule]);

  const toggleAddon = (id) => {
    upd({ addons: builder.addons.includes(id) ? builder.addons.filter((a) => a !== id) : [...builder.addons, id] });
  };

  const addCabinet = () => {
    if (!canPreview || !preview) return;
    const row = { id: editingId || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, input: { ...builder, cabW: cabWNum, cabH: cabHNum } };
    setSchedule((s) => (editingId ? s.map((r) => (r.id === editingId ? row : r)) : [...s, row]));
    setEditingId(null);
    setBuilder(emptyBuilder(catalog));
  };

  const editRow = (row) => {
    setBuilder({ ...row.input, cabW: String(row.input.cabW), cabH: String(row.input.cabH) });
    setEditingId(row.id);
  };

  const removeRow = (id) => {
    setSchedule((s) => s.filter((r) => r.id !== id));
    if (editingId === id) { setEditingId(null); setBuilder(emptyBuilder(catalog)); }
  };

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    const bad = picked.find((f) => !isAcceptedFile(f) || f.size > MAX_FILE_MB * 1024 * 1024);
    if (bad) {
      setFileError(`"${bad.name}" isn't an accepted file — images or PDF only, under ${MAX_FILE_MB}MB.`);
      return;
    }
    setFileError("");
    setFiles((f) => [...f, ...picked]);
  };

  const removeFile = (idx) => setFiles((f) => f.filter((_, i) => i !== idx));

  // Multi-site delivery — distinct site labels in the order they first
  // appear in the schedule. Length <= 1 is the common case (today's single-
  // address flow, unchanged); length > 1 is when the per-site address
  // section below appears. resolveSiteLabel is the exact function
  // homOrder.js uses to build sites[]/stamp cabinet.siteId, so grouping
  // here always matches what the order ends up storing.
  const distinctSiteLabels = useMemo(() => {
    const labels = [];
    for (const row of schedule) {
      const label = resolveSiteLabel(row.input.projectLabel);
      if (!labels.includes(label)) labels.push(label);
    }
    return labels;
  }, [schedule]);

  const emptySiteAddress = { flat: "", street: "", area: "", city: "", pincode: "" };
  const getSiteAddress = (label) => siteAddresses[label] || emptySiteAddress;
  const updSiteAddress = (label, patch) => setSiteAddresses((s) => ({ ...s, [label]: { ...getSiteAddress(label), ...patch } }));
  // Optional: blank passes; an entered value must still be a real 6-digit
  // pincode — mirrors SiteAddressFields' own pincodeValid above.
  const siteAddressValid = (label) => {
    const p = (getSiteAddress(label).pincode || "").trim();
    return p === "" || /^[0-9]{6}$/.test(p);
  };
  const allSitesValid = distinctSiteLabels.length === 0 || distinctSiteLabels.every(siteAddressValid);

  const computeFormValid = (cust) => cust.name.trim().length > 0 && cust.phone.trim().length > 0 && allSitesValid && schedule.length > 0;
  const formValid = computeFormValid(customer);

  // Opens Razorpay checkout for an already-created order and only calls
  // onPlaceOrder (the confirmation screen) once the server has verified the
  // payment. On any failure (cancelled, declined, verification failed), the
  // order stays exactly as submitHomOrder left it — status "new",
  // paymentStatus "pending_payment" — and this component stays on the
  // builder screen showing a retry affordance, never a fake success.
  // Online payment (Razorpay or another gateway) is parked for a future
  // block — TODO(block4-payment): wire "online" here once a gateway is
  // chosen. paymentMethod can only ever be "cod" today (the "online" radio
  // is rendered disabled below), so this always takes the COD path — the
  // order itself is the confirmation, no payment step.
  //
  // Block 5 — login gate: no uid (from the authUser prop, or from
  // `overrideUid`/`overrideCustomer` when HomAuthGate's onAuthed hands off
  // straight into placing the order right after sign-in/signup) means the
  // customer isn't signed in yet — show the gate and stop, nothing is
  // written. `overrideCustomer` exists because a freshly-authed name/phone
  // prefill hasn't round-tripped back down through HomSystemsPage's
  // authUser state by the time this same click handler needs it — reading
  // the `customer` state variable here would still see the pre-prefill
  // values due to React's batching, so the gate passes the prefilled object
  // straight through instead of relying on the next render.
  const placeOrder = async (overrideUid, overrideCustomer) => {
    setTouched(true);
    const uid = overrideUid || authUser?.uid;
    if (!uid) { setShowAuthGate(true); return; }
    const cust = overrideCustomer || customer;
    if (!computeFormValid(cust) || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      // One entry per distinct site label, each carrying its own captured
      // address — see distinctSiteLabels/getSiteAddress above. homOrder.js
      // stamps each cabinet's siteId with the exact same resolveSiteLabel()
      // call, so every cabinet always lands under one of these entries.
      const sites = distinctSiteLabels.map((label) => ({ siteId: label, label, address: getSiteAddress(label) }));
      const { orderId, orderNo, pricing } = await submitHomOrder({
        catalog,
        cabinets: schedule.map((s) => s.input),
        customer: cust,
        sites,
        paymentMethod,
        ownerUid: uid,
      });

      let attachmentErrors = null;
      if (files.length) {
        try {
          await uploadHomOrderFiles(orderId, files);
        } catch (e) {
          attachmentErrors = e.failed || [{ name: "attachments", error: e.message }];
        }
      }

      onPlaceOrder({
        orderId,
        orderNo,
        pricing,
        customer: cust,
        email: cust.email,
        paymentMethod,
        attachmentErrors,
      });
    } catch (e) {
      // Order write itself failed — nothing was saved. Keep every input
      // exactly as the customer left it (no reset anywhere in this catch)
      // and show a hard, specific error instead of advancing.
      setSubmitError(e.message || "Something went wrong placing your order. Please try again.");
      setSubmitting(false);
    }
  };

  // HomAuthGate's onAuthed — updates the parent's authUser (so a page
  // refresh / re-render sees the same signed-in state), prefills
  // name/phone into a local object it hands straight to placeOrder (see the
  // race note above), closes the gate, and continues the placement that
  // triggered it in the first place.
  const handleGateAuthed = (profile) => {
    onAuthed?.(profile);
    const prefilled = { ...customer, name: customer.name || profile.name || "", phone: customer.phone || profile.phone || "" };
    setCustomer(prefilled);
    setShowAuthGate(false);
    placeOrder(profile.uid, prefilled);
  };

  // Schedule grouped by project/site label — same resolveSiteLabel() as
  // distinctSiteLabels above, so a cabinet with no label lands under
  // DEFAULT_SITE_LABEL ("Site 1") here exactly like everywhere else.
  const scheduleGroups = useMemo(() => {
    const groups = new Map();
    for (const row of schedule) {
      const label = resolveSiteLabel(row.input.projectLabel);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row);
    }
    return [...groups.entries()];
  }, [schedule]);

  return (
    <div className="hm-shell">
      <div className="hm-main">
        <div className="hm-section-title" style={{ marginBottom: 18 }}>Cabinetry</div>

        <Plate title="Brand">
          {brands.length === 0
            ? <div className="hm-sched-empty">No brands available right now.</div>
            : <TileGrid items={brands} selectedId={builder.brandId} onSelect={selectBrand} />}
        </Plate>

        <Plate title="Profile Type" sub={selectedBrand ? undefined : "Pick a brand first"}>
          {!selectedBrand
            ? <div className="hm-sched-empty">Pick a brand above first.</div>
            : profileTypes.length === 0
              ? <div className="hm-sched-empty">No profile types available for this brand.</div>
              : <TileGrid items={profileTypes} selectedId={builder.profileTypeId} onSelect={(id) => upd({ profileTypeId: id })} />}
        </Plate>

        <Plate title="Finish">
          {colours.length === 0
            ? <div className="hm-sched-empty">No finishes available right now.</div>
            : <TileGrid items={colours} selectedId={builder.colourId} onSelect={(id) => upd({ colourId: id })} />}
        </Plate>

        <Plate title="Fourth Side" sub={selectedBrand ? undefined : "Pick a brand first"}>
          {!selectedBrand
            ? <div className="hm-sched-empty">Pick a brand above first.</div>
            : <>
                <TileGrid items={fourthSideOptions} selectedId={builder.fourthSide} onSelect={(id) => upd({ fourthSide: id })} />
                <div className="hm-section-sub" style={{ marginTop: 10, marginBottom: 0 }}>
                  Handle-less continues the same profile all the way round. A handle type uses a separate profile for the handle edge, cut and priced separately.
                </div>
              </>}
        </Plate>

        <Plate title="Glass">
          {glasses.length === 0
            ? <div className="hm-sched-empty">No glass options available right now.</div>
            : <TileGrid items={glasses} selectedId={builder.glassId} onSelect={(id) => upd({ glassId: id })} />}
          {addons.length > 0 && (
            <>
              <div className="hm-config-label" style={{ marginTop: 16, marginBottom: 8 }}>Optional add-ons</div>
              <div className="hm-chip-row">
                {addons.map((a) => (
                  <div key={a.id} className={`hm-chip ${builder.addons.includes(a.id) ? "on" : ""}`} onClick={() => toggleAddon(a.id)}>{a.name}</div>
                ))}
              </div>
            </>
          )}
        </Plate>

        <Plate title="Lift-Up">
          <div className="hm-config-row">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={builder.liftUp} onChange={(e) => upd({ liftUp: e.target.checked, hydraulicId: e.target.checked ? builder.hydraulicId : null })} />
              <span className="hm-option-label">This cabinet uses a lift-up (hydraulic) shutter</span>
            </label>
          </div>
          {builder.liftUp && (
            hydraulics.length === 0
              ? <div className="hm-sched-empty">No hydraulic systems available right now.</div>
              : <TileGrid items={hydraulics} selectedId={builder.hydraulicId} onSelect={(id) => upd({ hydraulicId: id })} />
          )}
        </Plate>

        <Plate title="Hinge">
          <div className="hm-config-row">
            <div className="hm-config-label">Category</div>
            {hingeCategories.length === 0
              ? <div className="hm-sched-empty">No hinge categories available right now.</div>
              : <TileGrid items={hingeCategories} selectedId={builder.hingeCategoryId} onSelect={selectHingeCategory} />}
          </div>
          {selectedHingeCategory && (
            <div className="hm-config-row">
              <div className="hm-config-label">Brand</div>
              {hingeBrands.length === 0
                ? <div className="hm-sched-empty">No brands available for this hinge category.</div>
                : <TileGrid items={hingeBrands} selectedId={builder.hingeBrandId} onSelect={(id) => upd({ hingeBrandId: id })} />}
            </div>
          )}
          <div className="hm-config-row">
            <div className="hm-config-label">Hinges per shutter</div>
            <Stepper value={builder.hingesPerShutter} min={1} max={6} onChange={(v) => upd({ hingesPerShutter: v })} />
          </div>
        </Plate>

        <Plate title="Dimensions" sub="mm, outer × outer">
          <div className="hm-config-row">
            <div className="hm-config-label">Shutters per cabinet</div>
            <div className="hm-option-row">
              {[1, 2].map((n) => (
                <div key={n} className={`hm-option ${builder.shuttersPerCab === n ? "on" : ""}`} onClick={() => upd({ shuttersPerCab: n })}>
                  <ShuttersPerCabDiagram count={n} />
                  <span className="hm-option-label">{n} Shutter{n > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hm-config-row">
            <div className="hm-config-label">Identical cabinets (qty)</div>
            <Stepper value={builder.qty} min={1} max={50} onChange={(v) => upd({ qty: v })} />
          </div>

          <div className="hm-dim-row">
            <div className="hm-dim-field">
              <div className="hm-dim-label">Cabinet Width <span className="hm-dim-line" /></div>
              <input className="hm-dim-input" type="number" min="1" placeholder="600" value={builder.cabW} onChange={(e) => upd({ cabW: e.target.value })} />
              <div className="hm-dim-unit">mm</div>
            </div>
            <div className="hm-dim-field">
              <div className="hm-dim-label">Cabinet Height <span className="hm-dim-line" /></div>
              <input className="hm-dim-input" type="number" min="1" placeholder="482" value={builder.cabH} onChange={(e) => upd({ cabH: e.target.value })} />
              <div className="hm-dim-unit">mm</div>
            </div>
          </div>

          <div className="hm-field" style={{ maxWidth: 320, marginTop: 16 }}>
            <div className="hm-field-label">Project / site label (optional)</div>
            <input className="hm-input" value={builder.projectLabel} onChange={(e) => upd({ projectLabel: e.target.value })} placeholder="e.g. Kitchen, Utility, Site 2" />
          </div>

          {preview && (
            <div className="hm-readout">
              <div className="hm-readout-item"><span className="hm-readout-label">Shutter size</span><span className="hm-readout-val">{preview.shutterW}×{preview.shutterH}</span></div>
              <div className="hm-readout-item"><span className="hm-readout-label">Total shutters</span><span className="hm-readout-val">{preview.totalShutters}</span></div>
              <div className="hm-readout-item"><span className="hm-readout-label">Glass area</span><span className="hm-readout-val">{preview.glassArea} sqft</span></div>
              <div className="hm-readout-item"><span className="hm-readout-label">Profile bar</span><span className="hm-readout-val">{preview.regularBar.label || "—"}</span></div>
              {preview.handleBar && <div className="hm-readout-item"><span className="hm-readout-label">Handle bar</span><span className="hm-readout-val">{preview.handleBar.label || "—"}</span></div>}
              <div className="hm-readout-item"><span className="hm-readout-label">Cabinet price (indicative)</span><span className="hm-readout-val acc">{fmtINR(preview.indicativeTotal)}</span></div>
              {(!preview.regularBar.ok || (preview.handleBar && !preview.handleBar.ok)) && (
                <div className="hm-readout-warn">No catalog bar is long enough for this size — our team will confirm a custom cut before manufacturing.</div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button type="button" className="hm-btn hm-btn-acc" disabled={!canPreview} onClick={addCabinet}>
              {editingId ? "Save Changes" : "+ Add Cabinet"}
            </button>
            {editingId && (
              <button type="button" className="hm-btn hm-btn-ghost" style={{ marginLeft: 8 }} onClick={() => { setEditingId(null); setBuilder(emptyBuilder(catalog)); }}>Cancel Edit</button>
            )}
          </div>
        </Plate>

        <Plate title="Schedule" sub={`${schedule.length} cabinet line${schedule.length === 1 ? "" : "s"}`}>
          {schedule.length === 0
            ? <div className="hm-sched-empty">No cabinets added yet — configure one above and hit "Add Cabinet".</div>
            : scheduleGroups.map(([label, rows]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div className="hm-detail-block-hd">{label}</div>
                  {rows.map((row) => {
                    const brand = brands.find((b) => b.id === row.input.brandId);
                    const glass = glasses.find((g) => g.id === row.input.glassId);
                    let est;
                    try { est = estimateCabinet(catalog, row.input); } catch { est = null; }
                    return (
                      <div key={row.id} className="hm-sched-row">
                        <div className="hm-sched-main">
                          <div className="hm-sched-title">{brand?.name || row.input.brandId} · {glass?.name || row.input.glassId}</div>
                          <div className="hm-sched-meta">{row.input.cabW}×{row.input.cabH}mm · qty {row.input.qty} · {est?.totalShutters ?? "—"} shutters</div>
                        </div>
                        <div className="hm-sched-price">{fmtINR(est?.indicativeTotal)}</div>
                        <div className="hm-sched-actions">
                          <button type="button" className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => editRow(row)}>Edit</button>
                          <button type="button" className="hm-btn hm-btn-danger hm-btn-sm" onClick={() => removeRow(row.id)}>Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
        </Plate>

        <Plate title="Customer & Delivery">
          <div className="hm-field-grid">
            <div className="hm-field">
              <div className="hm-field-label">Name <span className="req">*</span></div>
              <input className={`hm-input ${touched && !customer.name.trim() ? "err" : ""}`} value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="hm-field">
              <div className="hm-field-label">Phone <span className="req">*</span></div>
              <input className={`hm-input ${touched && !customer.phone.trim() ? "err" : ""}`} value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} placeholder="10-digit mobile" />
            </div>
            <div className="hm-field hm-field-full">
              <div className="hm-field-label">Email (optional)</div>
              <input className="hm-input" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" />
            </div>
          </div>

          {distinctSiteLabels.length <= 1 ? (
            // Common case — one address for the whole order, exactly like
            // before. distinctSiteLabels[0] falls back to DEFAULT_SITE_LABEL
            // when the schedule is empty (nothing to key an address by yet).
            <SiteAddressFields
              address={getSiteAddress(distinctSiteLabels[0] || DEFAULT_SITE_LABEL)}
              onChange={(patch) => updSiteAddress(distinctSiteLabels[0] || DEFAULT_SITE_LABEL, patch)}
              touched={touched}
            />
          ) : (
            // Multi-site — one address block per distinct project/site
            // label, each showing exactly which cabinets it covers so the
            // customer can tell them apart at a glance.
            distinctSiteLabels.map((label) => {
              const group = scheduleGroups.find(([l]) => l === label);
              const rows = group ? group[1] : [];
              return (
                <div key={label} className="hm-detail-block" style={{ marginTop: 14 }}>
                  <div className="hm-detail-block-hd">
                    {label} <span style={{ fontWeight: 400, color: "var(--hm-sub)" }}>— {rows.length} cabinet{rows.length === 1 ? "" : "s"}: {rows.map((r) => `${r.input.cabW}×${r.input.cabH}mm`).join(", ")}</span>
                  </div>
                  <SiteAddressFields
                    address={getSiteAddress(label)}
                    onChange={(patch) => updSiteAddress(label, patch)}
                    touched={touched}
                  />
                </div>
              );
            })
          )}

          <div className="hm-section-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            {distinctSiteLabels.length > 1
              ? "Delivering to multiple sites — one delivery address, and one delivery chit, per site above. Every cabinet still ships from a single pooled order."
              : "One delivery address for this order."}
          </div>

          <div className="hm-config-label" style={{ marginTop: 20, marginBottom: 8 }}>Reference drawings / photos (optional)</div>
          <label className="hm-file-drop">
            Click to attach files — images or PDF, under {MAX_FILE_MB}MB each
            <input type="file" multiple accept="image/*,application/pdf" style={{ display: "none" }} onChange={handleFiles} />
          </label>
          {fileError && <div className="hm-field-err" style={{ marginTop: 6 }}>{fileError}</div>}
          {files.length > 0 && (
            <div className="hm-file-list">
              {files.map((f, i) => (
                <div key={i} className="hm-file-item">
                  <span>{f.name}</span>
                  <button type="button" className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => removeFile(i)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          <div className="hm-field" style={{ marginTop: 16 }}>
            <div className="hm-field-label">Notes for production (optional)</div>
            <textarea
              className="hm-input"
              rows={3}
              style={{ resize: "vertical" }}
              value={customer.notes}
              onChange={(e) => setCustomer((c) => ({ ...c, notes: e.target.value }))}
              placeholder="Anything our team should know before manufacturing"
            />
          </div>
        </Plate>
      </div>

      <div className="hm-quote">
        <div className="hm-quote-panel">
          <div className="hm-quote-title">Quote</div>
          {orderTotals.barWarning && (
            <div className="hm-quote-err" style={{ marginBottom: 10 }}>One or more cabinets need a custom-cut bar our catalog doesn't stock yet — our team will confirm before manufacturing.</div>
          )}
          <div className="hm-quote-row"><span className="hm-quote-lbl">Basic</span><span>{fmtINR(orderTotals.basic)}</span></div>
          <div className="hm-quote-row"><span className="hm-quote-lbl">GST ({catalog.gstPct}%)</span><span>{fmtINR(orderTotals.gst)}</span></div>
          <div className="hm-quote-row"><span className="hm-quote-lbl">Transport</span><span>{fmtINR(orderTotals.transport)}</span></div>
          <div className="hm-quote-row total"><span className="hm-quote-lbl">Total to pay</span><span className="hm-quote-val">{fmtINR(orderTotals.grand)}</span></div>

          <div className="hm-pay-row">
            {/* TODO(block4-payment): online payment is parked for a future
                block (no gateway chosen yet) — kept visible so customers know
                it's coming, but not selectable. Cash on delivery is the only
                payable path today. */}
            <div className="hm-pay-opt hm-pay-opt-disabled" aria-disabled="true">
              <input type="radio" readOnly disabled checked={false} /> Pay now (online) <span className="hm-pay-soon">Coming soon</span>
            </div>
            <div className={`hm-pay-opt ${paymentMethod === "cod" ? "on" : ""}`} onClick={() => setPaymentMethod("cod")}>
              <input type="radio" readOnly checked={paymentMethod === "cod"} /> Cash on delivery
            </div>
          </div>

          {authUser && (
            <div style={{ fontSize: 11, color: "#a8a9b3", marginBottom: 8 }}>Signed in as {authUser.name || authUser.phone || authUser.email || "you"}</div>
          )}
          <button type="button" className="hm-btn hm-btn-acc" style={{ width: "100%" }} disabled={submitting || schedule.length === 0} onClick={() => placeOrder()}>
            {submitting ? "Placing Order…" : authUser ? "Place Order" : "Sign In & Place Order"}
          </button>

          {touched && !formValid && (
            <div className="hm-quote-err">
              {schedule.length === 0 && "Add at least one cabinet. "}
              {!customer.name.trim() && "Name is required. "}
              {!customer.phone.trim() && "Phone is required. "}
              {!allSitesValid && "Enter a valid 6-digit pincode for every delivery site, or leave it blank."}
            </div>
          )}
          {submitError && <div className="hm-quote-err">{submitError}</div>}
        </div>
      </div>

      {showAuthGate && (
        <HomAuthGate
          onAuthed={handleGateAuthed}
          onCancel={() => setShowAuthGate(false)}
        />
      )}
    </div>
  );
}
