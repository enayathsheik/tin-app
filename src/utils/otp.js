// Skilled-worker sign-up and login by one-time code (B2). Plain functions, zero
// React/Firebase imports — unit-tested in test/unit/otp.test.js.
import { TRADES, isKey } from "../data/jobsTaxonomy.js";
import { emptyProfile } from "./jobProfile.js";

// Every error a provider may report (src/lib/otp). Text: [English, Hindi].
export const OTP_TEXT = {
  bad_phone: ["Enter a 10-digit mobile number.", "10 अंकों का मोबाइल नंबर लिखें।"],
  bad_code: ["Wrong code. Check the SMS and try again.", "कोड गलत है। SMS देखकर फिर लिखें।"],
  expired: ["This code has expired. Ask for a new one.", "कोड का समय खत्म हो गया। नया कोड मँगाएँ।"],
  too_many: ["Too many tries. Please wait a while and try again.", "बहुत बार कोशिश हुई। थोड़ी देर बाद फिर कोशिश करें।"],
  network: ["No connection. Check your internet and try again.", "इंटरनेट नहीं है। फिर कोशिश करें।"],
  check_failed: ["Couldn't check this phone. Please try again.", "जाँच नहीं हो पाई। फिर कोशिश करें।"],
  off: ["Codes aren't available right now. Please try later.", "अभी कोड नहीं भेज सकते। बाद में कोशिश करें।"],
  blocked: ["This account is closed. Please contact the TIN team.", "यह खाता बंद है। TIN टीम से बात करें।"],
  failed: ["Something went wrong. Please try again.", "कुछ गड़बड़ हुई। फिर कोशिश करें।"],
};
export const OTP_ERRORS = Object.keys(OTP_TEXT);
export class OtpError extends Error {
  constructor(code) { super(code); this.name = "OtpError"; this.code = code; }
}
export const otpText = (code) => OTP_TEXT[code] || OTP_TEXT.failed;

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 30;
export const cleanCode = (v) => String(v ?? "").replace(/\D/g, "").slice(0, CODE_LENGTH);

const s = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
export const phoneOf = (phoneNumber) => (/^\+91[6-9]\d{9}$/.test(phoneNumber || "") ? phoneNumber.slice(3) : null);

// One question per screen: name, trade, city, then the employer choice.
export function missingFor(step, f) {
  if (step === "name") return s(f.name) ? "" : "name";
  if (step === "trade") return (f.trades || []).some(k => isKey(TRADES, k)) ? "" : "trade";
  if (step === "city") return s(f.city) ? "" : "city";
  if (step === "choice") return typeof f.openToEmployers === "boolean" ? "" : "choice";
  return "";
}

// users/{uid}. No email: a phone account has none (null, so it never equals
// some other record's empty email).
export const skilledAccount = (f, uid, phone, now = new Date()) => ({
  uid, name: s(f.name), email: null, phone, workEmail: null, personalEmail: "", role: "jobseeker", linkedin: "", company: "", city: s(f.city),
  points: 0, storesAdded: 0, citiesCovered: 0, level: "Bronze", validationStatus: "n/a", createdAt: now.toISOString(),
});
// The editable job profile to save (utils/jobProfile.js shape).
export const skilledJobProfile = (f, phone) => ({
  ...emptyProfile(), name: s(f.name), phone, lane: "skilled", city: s(f.city),
  trades: (f.trades || []).filter(k => isKey(TRADES, k)), openToEmployers: f.openToEmployers,
});
