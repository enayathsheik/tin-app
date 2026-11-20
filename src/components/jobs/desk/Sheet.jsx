import { useEffect } from "react";
import { useIsDesktop } from "../../../hooks/useIsDesktop";

// Bottom sheet on phones, right-hand panel on desktop. Esc / backdrop closes.
export function Sheet({ title, onClose, children, width = 460 }) {
  const isDesktop = useIsDesktop();
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const panel = isDesktop
    ? { position: "absolute", top: 0, right: 0, bottom: 0, width: `min(${width}px, 100%)`, borderRadius: 0 }
    : { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88vh", borderRadius: "16px 16px 0 0" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#00000060", zIndex: 600 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ ...panel, background: "var(--s1)", display: "flex", flexDirection: "column", boxShadow: "0 -4px 24px #0002" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--b2)", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 18, color: "var(--t1)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--t3)", minWidth: 44, minHeight: 44 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: 16, paddingBottom: 28 }}>{children}</div>
      </div>
    </div>
  );
}
