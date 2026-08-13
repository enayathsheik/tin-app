// HOM Systems — the customer-facing cabinet builder (Block 2).
// All prices shown here come from src/utils/homPricing.js reading the live
// homConfig/catalog doc — nothing in this file hardcodes a rate.
import { useMemo, useState } from "react";
import { priceCabinet, priceOrder } from "../../utils/homPricing";
import { submitHomOrder, uploadHomOrderFiles } from "../../utils/homOrder";
import { ShutterTypeDiagram, ShuttersPerCabDiagram } from "./homDiagrams";

const MAX_FILE_MB = 15;
const ACCEPTED_FILE_TYPES = ["image/", "application/pdf"];

function fmtINR(n) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

function isAcceptedFile(file) {
  return ACCEPTED_FILE_TYPES.some((t) => file.type.startsWith(t));
}

// Photo gallery used by the profile/finish/glass tiles — prev/next through
// photos[], or a clean placeholder frame when the catalog entry has none.
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

function Plate({ no, title, sub, children }) {
  return (
    <div className="hm-plate">
      <div className="hm-plate-hd">
        <span className="hm-plate-no">PLATE {no}</span>
        <span className="hm-plate-title">{title}</span>
        {sub && <span className="hm-plate-sub">{sub}</span>}
      </div>
      <div className="hm-plate-body">{children}</div>
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
  profileId: null,
  colourId: null,
  glassId: null,
  addons: [],
  withHandle: false,
  hingeId: catalog.hinges?.[0]?.id || null,
  shuttersPerCab: 2,
  hingesPerShutter: 2,
  cabW: "",
  cabH: "",
  qty: 1,
});

export function HomBuilder({ catalog, onPlaceOrder }) {
  const profiles = (catalog.profiles || []).filter((p) => p.active !== false);
  const colours = (catalog.colours || []).filter((c) => c.active !== false);
  const glasses = (catalog.glasses || []).filter((g) => g.active !== false);
  const addons = catalog.addons || [];
  const hinges = catalog.hinges || [];

  const [builder, setBuilder] = useState(() => emptyBuilder(catalog));
  const [editingId, setEditingId] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [address, setAddress] = useState({ flat: "", street: "", area: "", city: "", pincode: "" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [touched, setTouched] = useState(false);

  const upd = (patch) => setBuilder((b) => ({ ...b, ...patch }));

  const cabWNum = Number(builder.cabW);
  const cabHNum = Number(builder.cabH);
  const dimsValid = builder.cabW !== "" && builder.cabH !== "" && cabWNum > 0 && cabHNum > 0;
  const canPreview = builder.profileId && builder.colourId && builder.glassId && builder.hingeId && dimsValid;

  const preview = useMemo(() => {
    if (!canPreview) return null;
    try {
      return priceCabinet(catalog, { ...builder, cabW: cabWNum, cabH: cabHNum });
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
    const row = { id: editingId || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, input: { ...builder, cabW: cabWNum, cabH: cabHNum }, priced: preview };
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

  const pincodeValid = /^[0-9]{6}$/.test(address.pincode.trim());
  const formValid = customer.name.trim().length > 0 && customer.phone.trim().length > 0 && pincodeValid && schedule.length > 0;

  const placeOrder = async () => {
    setTouched(true);
    if (!formValid || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { orderId, orderNo, pricing } = await submitHomOrder({
        catalog,
        cabinets: schedule.map((s) => s.input),
        customer: { ...customer, pincode: address.pincode },
        address,
        paymentMethod,
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
        customer,
        email: customer.email,
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

  return (
    <div className="hm-shell">
      <div className="hm-main">
        <Plate no="01" title="Profile">
          {profiles.length === 0
            ? <div className="hm-sched-empty">No profiles available right now.</div>
            : <TileGrid items={profiles} selectedId={builder.profileId} onSelect={(id) => upd({ profileId: id })} />}
        </Plate>

        <Plate no="02" title="Finish">
          {colours.length === 0
            ? <div className="hm-sched-empty">No finishes available right now.</div>
            : <TileGrid items={colours} selectedId={builder.colourId} onSelect={(id) => upd({ colourId: id })} />}
        </Plate>

        <Plate no="03" title="Glass">
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

        <Plate no="04" title="Configuration">
          <div className="hm-config-row">
            <div className="hm-config-label">Shutter type</div>
            <div className="hm-option-row">
              <div className={`hm-option ${!builder.withHandle ? "on" : ""}`} onClick={() => upd({ withHandle: false })}>
                <ShutterTypeDiagram withHandle={false} />
                <span className="hm-option-label">Handle-less</span>
              </div>
              <div className={`hm-option ${builder.withHandle ? "on" : ""}`} onClick={() => upd({ withHandle: true })}>
                <ShutterTypeDiagram withHandle={true} />
                <span className="hm-option-label">With Handle</span>
              </div>
            </div>
          </div>

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
            <div className="hm-config-label">Hinge type</div>
            <div className="hm-option-row">
              {hinges.map((h) => (
                <div key={h.id} className={`hm-option ${builder.hingeId === h.id ? "on" : ""}`} onClick={() => upd({ hingeId: h.id })}>
                  <span className="hm-option-label">{h.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hm-config-row">
            <div className="hm-config-label">Hinges per shutter</div>
            <Stepper value={builder.hingesPerShutter} min={1} max={6} onChange={(v) => upd({ hingesPerShutter: v })} />
          </div>

          <div className="hm-config-row">
            <div className="hm-config-label">Identical cabinets (qty)</div>
            <Stepper value={builder.qty} min={1} max={50} onChange={(v) => upd({ qty: v })} />
          </div>
        </Plate>

        <Plate no="05" title="Dimensions" sub="mm, outer × outer">
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

          {preview && (
            <div className="hm-readout">
              <div className="hm-readout-item"><span className="hm-readout-label">Shutter size</span><span className="hm-readout-val">{preview.shutterW}×{preview.shutterH}</span></div>
              <div className="hm-readout-item"><span className="hm-readout-label">Total shutters</span><span className="hm-readout-val">{preview.totalShutters}</span></div>
              <div className="hm-readout-item"><span className="hm-readout-label">Glass area</span><span className="hm-readout-val">{preview.glassArea} sqft</span></div>
              <div className="hm-readout-item"><span className="hm-readout-label">Bar</span><span className="hm-readout-val">{preview.barLabel}</span></div>
              <div className="hm-readout-item"><span className="hm-readout-label">Cabinet price</span><span className="hm-readout-val acc">{fmtINR(preview.cabinetTotal)}</span></div>
              {!preview.barOk && <div className="hm-readout-warn">No catalog bar is long enough for this size — our team will confirm a custom cut before manufacturing.</div>}
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

        <Plate no="06" title="Schedule" sub={`${schedule.length} cabinet line${schedule.length === 1 ? "" : "s"}`}>
          {schedule.length === 0
            ? <div className="hm-sched-empty">No cabinets added yet — configure one above and hit "Add Cabinet".</div>
            : schedule.map((row) => {
                const profileName = profiles.find((p) => p.id === row.input.profileId)?.name || row.input.profileId;
                const glassName = glasses.find((g) => g.id === row.input.glassId)?.name || row.input.glassId;
                return (
                  <div key={row.id} className="hm-sched-row">
                    <div className="hm-sched-main">
                      <div className="hm-sched-title">{profileName} · {glassName}</div>
                      <div className="hm-sched-meta">{row.input.cabW}×{row.input.cabH}mm · qty {row.input.qty} · {row.priced.totalShutters} shutters · bar {row.priced.barLabel}</div>
                    </div>
                    <div className="hm-sched-price">{fmtINR(row.priced.cabinetTotal)}</div>
                    <div className="hm-sched-actions">
                      <button type="button" className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => editRow(row)}>Edit</button>
                      <button type="button" className="hm-btn hm-btn-danger hm-btn-sm" onClick={() => removeRow(row.id)}>Remove</button>
                    </div>
                  </div>
                );
              })}
        </Plate>

        <Plate no="07" title="Customer & Delivery">
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
            <div className="hm-field">
              <div className="hm-field-label">Flat / Unit</div>
              <input className="hm-input" value={address.flat} onChange={(e) => setAddress((a) => ({ ...a, flat: e.target.value }))} />
            </div>
            <div className="hm-field">
              <div className="hm-field-label">Street</div>
              <input className="hm-input" value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} />
            </div>
            <div className="hm-field">
              <div className="hm-field-label">Area</div>
              <input className="hm-input" value={address.area} onChange={(e) => setAddress((a) => ({ ...a, area: e.target.value }))} />
            </div>
            <div className="hm-field">
              <div className="hm-field-label">City</div>
              <input className="hm-input" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
            </div>
            <div className="hm-field hm-field-full">
              <div className="hm-field-label">Pincode <span className="req">*</span></div>
              <input className={`hm-input ${touched && !pincodeValid ? "err" : ""}`} value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit pincode" />
              {touched && !pincodeValid && <div className="hm-field-err">Enter a valid 6-digit pincode.</div>}
            </div>
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
        </Plate>
      </div>

      <div className="hm-quote">
        <div className="hm-quote-panel">
          <div className="hm-quote-title">Quote</div>
          <div className="hm-quote-row"><span className="hm-quote-lbl">Basic</span><span>{fmtINR(orderTotals.basic)}</span></div>
          <div className="hm-quote-row"><span className="hm-quote-lbl">GST ({catalog.gstPct}%)</span><span>{fmtINR(orderTotals.gst)}</span></div>
          <div className="hm-quote-row"><span className="hm-quote-lbl">Transport</span><span>{fmtINR(orderTotals.transport)}</span></div>
          <div className="hm-quote-row total"><span className="hm-quote-lbl">Total to pay</span><span className="hm-quote-val">{fmtINR(orderTotals.grand)}</span></div>

          <div className="hm-pay-row">
            <div className={`hm-pay-opt ${paymentMethod === "online" ? "on" : ""}`} onClick={() => setPaymentMethod("online")}>
              <input type="radio" readOnly checked={paymentMethod === "online"} /> Pay now (online)
            </div>
            <div className={`hm-pay-opt ${paymentMethod === "cod" ? "on" : ""}`} onClick={() => setPaymentMethod("cod")}>
              <input type="radio" readOnly checked={paymentMethod === "cod"} /> Cash on delivery
            </div>
          </div>

          <button type="button" className="hm-btn hm-btn-acc" style={{ width: "100%" }} disabled={submitting || schedule.length === 0} onClick={placeOrder}>
            {submitting ? "Placing Order…" : "Place Order"}
          </button>

          {touched && !formValid && (
            <div className="hm-quote-err">
              {schedule.length === 0 && "Add at least one cabinet. "}
              {!customer.name.trim() && "Name is required. "}
              {!customer.phone.trim() && "Phone is required. "}
              {!pincodeValid && "A valid 6-digit pincode is required."}
            </div>
          )}
          {submitError && <div className="hm-quote-err">{submitError}</div>}
        </div>
      </div>
    </div>
  );
}
