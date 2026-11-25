// TIN Jobs Admin → Overview: businesses waiting for TIN's approval (with the
// existing approve / reject logic) and the latest activity.
import { useState } from "react";
import { approveClaim, rejectClaim } from "../../../lib/storeClaims";
import { rejectStore, verifyStore } from "../../../lib/storeVerification";
import { adminUid } from "../../../lib/superAdmin";
import { activityExport, approvalExport } from "../../../utils/jobsAdmin.js";
import { exportSheets } from "../../../utils/exportExcel";
import { DataTable, Email, Phone, Pill } from "./bits";
import { dash, fmtDate, linkBtn, panelTitle } from "./format";

const head = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 };
const fmtTime = (d) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function OverviewTab({ approvals, activity, onChanged, onOpenJob, onOpenCandidate, seekersById }) {
  return (
    <>
      <Approvals approvals={approvals} onChanged={onChanged} />
      <div style={{ ...head, marginTop: 24 }}>
        <div style={{ ...panelTitle, marginBottom: 0 }}>Recent activity</div>
        <button type="button" className="btn-sm btn-out" disabled={!activity.length} onClick={() => exportSheets([{ name: "Recent activity", rows: activity.map(activityExport) }], "tin-jobs-activity")}>📥 Download Excel</button>
      </div>
      <DataTable rows={activity} rowKey={r => r.key} empty="Nothing yet." minWidth={720} columns={[
        ["When", r => <span style={{ whiteSpace: "nowrap" }}>{fmtTime(r.at)}</span>],
        ["What", r => <Pill kind={r.type}>{r.type}</Pill>],
        ["Who", r => (r.type === "Application" && seekersById[r.uid] ? <button type="button" style={linkBtn} onClick={() => onOpenCandidate(r.uid)}>{r.who}</button> : r.who)],
        ["Detail", r => (r.jobId ? <button type="button" style={{ ...linkBtn, fontWeight: 400 }} onClick={() => onOpenJob(r.jobId)}>{r.detail}</button> : dash(r.detail))],
        ["City", r => dash(r.city)],
      ]} />
    </>
  );
}

function Approvals({ approvals, onChanged }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ ok: "", error: "" });
  const act = async (r, approve) => {
    setBusy(r.key); setMsg({ ok: "", error: "" });
    try {
      let text;
      if (r.kind === "claim") {
        await (approve ? approveClaim : rejectClaim)(r.claim, adminUid());
        text = approve ? "Claim approved — the business is linked to that account." : "Claim rejected.";
      } else {
        text = await (approve ? verifyStore : rejectStore)(r.storeId);
      }
      setMsg({ ok: `${r.business}: ${text}`, error: "" });
      onChanged(r.key);
    } catch (e) {
      console.error("[jobs-admin] approval failed:", e);
      setMsg({ ok: "", error: `${r.business}: ${e.message || "that didn't work."}` });
    }
    setBusy("");
  };
  return (
    <>
      <div style={head}>
        <div style={{ ...panelTitle, marginBottom: 0 }}>Businesses waiting for approval ({approvals.length})</div>
        <button type="button" className="btn-sm btn-out" disabled={!approvals.length} onClick={() => exportSheets([{ name: "Pending approvals", rows: approvals.map(approvalExport) }], "tin-pending-approvals")}>📥 Download Excel</button>
      </div>
      {msg.ok && <div role="status" style={{ color: "#15803d", fontSize: 13, marginBottom: 8 }}>✓ {msg.ok}</div>}
      {msg.error && <div role="alert" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>⚠ {msg.error}</div>}
      {approvals.length === 0 ? <div className="val-ok-banner"><span>✓</span><div>No business is waiting for approval.</div></div> : (
        <DataTable rows={approvals} rowKey={r => r.key} empty="" minWidth={1000} columns={[
          ["Business", r => (
            <>
              {r.storeId ? <a href={`/store/${r.storeId}`} target="_blank" rel="noreferrer" style={{ color: "var(--acc)", fontWeight: 700 }}>{r.business}</a> : <b>{r.business}</b>}
              <div style={{ fontSize: 11, color: "var(--t3)" }}>{r.kindText}</div>
            </>
          )],
          ["City", r => dash(r.city)],
          ["Owner", r => dash(r.owner)],
          ["Mobile", r => <Phone value={r.phone} />],
          ["Email", r => <Email value={r.email} />],
          ["GST", r => dash(r.gst)],
          ["Sent", r => fmtDate(r.created)],
          ["Decision", r => (
            <div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn-sm btn-ok" disabled={!!busy || !!r.blocked} style={r.blocked ? { opacity: .5 } : undefined} onClick={() => act(r, true)}>{busy === r.key ? "…" : "✓ Approve"}</button>
                <button type="button" className="btn-sm btn-out" style={{ color: "#b91c1c" }} disabled={!!busy} onClick={() => act(r, false)}>✕ Reject</button>
              </div>
              {(r.blocked || r.warning) && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4, maxWidth: 220 }}>{r.blocked || r.warning}</div>}
            </div>
          )],
        ]} />
      )}
    </>
  );
}
