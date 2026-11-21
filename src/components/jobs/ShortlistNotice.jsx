// L8: the contact-visibility notice shown wherever a job seeker saves their
// profile or applies. Text agreed with the owner; keep it in sync with the
// Privacy page (src/pages/PrivacyPage.jsx).
import { Link } from "react-router-dom";

export const SHORTLIST_NOTICE = "When an employer shortlists you, they can see your phone number, email and CV.";
const SHORTLIST_NOTICE_HI = "जब कोई नौकरी देने वाला आपको शॉर्टलिस्ट करता है, तो वह आपका फ़ोन नंबर, ईमेल और CV देख सकता है।";

export function ShortlistNotice({ bi = false, style }) {
  return (
    <div role="note" style={{ fontSize: 12, color: "var(--t2)", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 10px", ...style }}>
      🔒 {SHORTLIST_NOTICE}
      {bi && <div lang="hi" style={{ marginTop: 2 }}>{SHORTLIST_NOTICE_HI}</div>}
      {" "}<Link to="/privacy" target="_blank" style={{ color: "var(--acc)", fontWeight: 700 }}>Privacy</Link>
    </div>
  );
}
