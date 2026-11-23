// Formatting and shared styles for Admin → TIN Jobs Admin.
export const fmtDate = (d) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const dash = (v) => (v === "" || v == null ? "—" : v);
export const linkBtn = { background: "none", border: "none", padding: 0, color: "var(--acc)", fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit" };
export const panel = { background: "#fff", border: "1px solid #e0e0ea", borderRadius: 12, padding: 16, marginBottom: 14 };
export const panelTitle = { fontWeight: 800, fontSize: 14, marginBottom: 10, color: "var(--t1)" };
