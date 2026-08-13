// HOM Systems "House of Mod" — standalone microsite entry point (Block 2).
// Rendered outside the TIN app shell entirely (see App.jsx's homsystems
// host/path check) — this component owns its own catalog load, its own
// stylesheet, and its own screen state (builder -> confirmation). No TIN
// auth, nav, or user state is used or required anywhere in this tree.
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { HOM_STYLES } from "./homStyles";
import { HomBuilder } from "./HomBuilder";

function fmtINR(n) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

function HomConfirmation({ result }) {
  const { orderNo, pricing, email, attachmentErrors } = result;
  return (
    <div className="hm-confirm">
      <div className="hm-confirm-icon">✓</div>
      <h1 className="hm-confirm-title">Order Placed</h1>
      <div className="hm-confirm-order">{orderNo} · {fmtINR(pricing.grand)}</div>

      {attachmentErrors && (
        <div className="hm-error-banner" style={{ marginBottom: 20 }}>
          Your order was placed successfully, but {attachmentErrors.length} attachment{attachmentErrors.length > 1 ? "s" : ""} failed to upload
          ({attachmentErrors.map((f) => f.name).join(", ")}). Please email these files to us referencing order {orderNo}.
        </div>
      )}

      <p style={{ fontSize: 13, color: "#6b6d76", lineHeight: 1.6 }}>
        {email
          ? `A confirmation email will be sent to ${email}.`
          : "No email was provided, so mail confirmation is skipped — keep your order number for reference."}
      </p>

      <div className="hm-plate-title" style={{ marginTop: 28, marginBottom: 6, fontSize: 13 }}>What happens next</div>
      <div className="hm-confirm-steps">
        <div className="hm-confirm-step"><span className="hm-confirm-step-no">1</span><span>Our team reviews and approves your order.</span></div>
        <div className="hm-confirm-step"><span className="hm-confirm-step-no">2</span><span>A glass cutting chit is sent to our glass supplier.</span></div>
        <div className="hm-confirm-step"><span className="hm-confirm-step-no">3</span><span>A profile order is placed with our maker.</span></div>
        <div className="hm-confirm-step"><span className="hm-confirm-step-no">4</span><span>A delivery chit is couriered to you with your shutters.</span></div>
      </div>
    </div>
  );
}

export function HomSystemsPage() {
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [orderResult, setOrderResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "homConfig", "catalog"));
        if (cancelled) return;
        if (!snap.exists()) {
          setLoadError("Our catalog isn't set up yet — please check back shortly.");
          return;
        }
        setCatalog(snap.data());
      } catch (e) {
        if (!cancelled) setLoadError(e.message || "Failed to load the catalog. Please refresh.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="hom-root">
      <style>{HOM_STYLES}</style>
      <div className="hm-topbar">
        <div>
          <div className="hm-brand">HOUSE OF <em>MOD</em></div>
          <div className="hm-brand-sub">Kitchen Shutter Systems</div>
        </div>
        <div className="hm-topbar-right">HOM Systems</div>
      </div>

      {loadError && (
        <div style={{ padding: 24 }}>
          <div className="hm-error-banner">{loadError}</div>
        </div>
      )}

      {!loadError && !catalog && (
        <div style={{ padding: 60, textAlign: "center", color: "#6b6d76" }}>Loading catalog…</div>
      )}

      {!loadError && catalog && !orderResult && (
        <HomBuilder catalog={catalog} onPlaceOrder={setOrderResult} />
      )}

      {orderResult && <HomConfirmation result={orderResult} />}
    </div>
  );
}
