import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

const confirmSuggestedActionFn = httpsCallable(functions, "confirmSuggestedAction");
const dismissSuggestedActionFn = httpsCallable(functions, "dismissSuggestedAction");

// Business-language label per actionType, built from the flat suggestedActionPayload
// shape in functions/vendor/ai-foundation/tools/suggestedActionSchema.js. Anything
// outside this map (a taxonomy addition) still renders with a generic fallback —
// Confirm will surface whatever error the deployed function returns for it.
const ACTION_LABELS = {
  log_ledger_entry: (p) => `Log ${formatAmount(p.amount)} ledger entry${p.description ? ` — ${p.description}` : ""}?`,
  set_milestone: (p) => `Set milestone "${p.milestoneTitle || "Untitled"}"${p.milestoneDate ? ` for ${p.milestoneDate}` : ""}?`,
  flag_snag: (p) => `Flag ${p.snagSeverity ? `${p.snagSeverity}-severity ` : ""}snag: ${p.snagDescription || "Untitled"}?`,
  tag_project: (p) => `Tag this conversation to project "${p.projectName || "Untitled"}"?`,
  share_reference: (p) => `Share reference${p.referenceDescription ? `: ${p.referenceDescription}` : ""}?`,
};

function formatAmount(amount) {
  if (amount == null) return "an";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function actionLabel(action) {
  const fn = ACTION_LABELS[action.actionType];
  return fn ? fn(action.payload || {}) : `Suggested action: ${action.actionType}?`;
}

function actionFields(action) {
  return Object.entries(action.payload || {}).filter(([, v]) => v != null && v !== "");
}

// Mirrors functions/ai.js's ACTION_TYPE_COLLECTIONS — only these 3 of the 6
// taxonomy values have a target collection to confirm into. The other 3
// (tag_project, share_reference, log_approval) schema-validate fine out of
// the classifier but hard-fail confirmSuggestedAction with failed-precondition,
// so Confirm is hidden for them here rather than shown-then-erroring.
const CONFIRMABLE_ACTION_TYPES = new Set(["log_ledger_entry", "set_milestone", "flag_snag"]);

// Read-only proposal surfaced by the deployed onMessageCreate function. This
// component never writes structured business data itself — Confirm/Dismiss
// only invoke the deployed confirmSuggestedAction/dismissSuggestedAction
// callables, which are the sole place a proposal becomes (or is closed out
// without becoming) real data. Suggest-then-confirm stays absolute.
export function SuggestedActionChip({ action, isOwn = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [localStatus, setLocalStatus] = useState(action.status);

  // Realtime updates (our own confirm/dismiss landing, or another
  // participant acting on it) flow back through the action.status prop.
  useEffect(() => setLocalStatus(action.status), [action.status]);

  if (localStatus !== "pending") return null;

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmSuggestedActionFn({ actionId: action.id });
      setLocalStatus("confirmed");
    } catch (e) {
      setError(e.message || "Failed to confirm this action.");
    }
    setBusy(false);
  };

  const handleDismiss = async () => {
    setBusy(true);
    setError(null);
    try {
      await dismissSuggestedActionFn({ actionId: action.id });
      setLocalStatus("dismissed");
    } catch (e) {
      setError(e.message || "Failed to dismiss this action.");
    }
    setBusy(false);
  };

  const fields = actionFields(action);
  const canConfirm = CONFIRMABLE_ACTION_TYPES.has(action.actionType);

  return (
    <div style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div style={{ maxWidth: "80%", padding: "10px 12px", borderRadius: 12, background: "#fff8f5", border: "1px solid #fde0d0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#080808", marginBottom: fields.length ? 6 : 8 }}>🤖 {actionLabel(action)}</div>
        {fields.length > 0 && (
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
            {fields.map(([k, v]) => (
              <span key={k}>{k}: <strong style={{ color: "#080808" }}>{String(v)}</strong></span>
            ))}
          </div>
        )}
        {error && <div style={{ color: "#dc2626", fontSize: 11, marginBottom: 6 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          {canConfirm && (
            <button
              onClick={handleConfirm}
              disabled={busy}
              style={{ padding: "5px 12px", borderRadius: 8, background: "#e85a2a", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "…" : "Confirm"}
            </button>
          )}
          <button
            onClick={handleDismiss}
            disabled={busy}
            style={{ padding: "5px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e0e0e0", color: "#080808", fontSize: 11, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
