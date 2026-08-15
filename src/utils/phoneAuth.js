// Mobile-number auth (no OTP/SMS). Firebase Auth on this project is
// email/password only — there is no SMS provider wired up, and this
// deliberately adds none (no Firebase phone auth, no reCAPTCHA, no OTP).
// Instead, a mobile number is mapped to a SYNTHETIC email address and
// driven through the exact same createUserWithEmailAndPassword /
// signInWithEmailAndPassword calls the existing email flow already uses
// (see LoginPage.jsx) — the synthetic email is an internal implementation
// detail only: it is never shown to the user and nothing is ever sent to
// it. The real mobile number is what gets stored on the user's profile.
//
// Normalisation rule (deterministic — the same phone always maps to the
// same synthetic email, so the same person always resolves to the same
// Firebase Auth account):
//   1. Strip every non-digit character.
//   2. If 12 digits and it starts with "91" (India country code), drop the "91".
//   3. If 11 digits and it starts with "0" (trunk prefix), drop the "0".
//   4. What remains must be exactly 10 digits starting with 6-9 — the shape
//      every Indian mobile number takes. Anything else is rejected (null).
const SYNTHETIC_PHONE_DOMAIN = "phone.tinit.in";

export function normalizeIndianMobile(raw) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function phoneToSyntheticEmail(normalizedDigits) {
  return `${normalizedDigits}@${SYNTHETIC_PHONE_DOMAIN}`;
}

export function isSyntheticPhoneEmail(email) {
  return (email || "").toLowerCase().endsWith(`@${SYNTHETIC_PHONE_DOMAIN}`);
}

// The login screen accepts either a real email or a bare mobile number in
// the same field — this is how it tells them apart and resolves to the
// actual Firebase Auth email to sign in with. `@` present → treat as a
// real email, unchanged from today's behaviour; otherwise → must normalise
// to a valid 10-digit mobile.
export function resolveAuthEmail(identifier) {
  const trimmed = (identifier || "").trim();
  if (!trimmed) return { error: "Enter your email or mobile number." };
  if (trimmed.includes("@")) return { email: trimmed, isPhone: false };
  const digits = normalizeIndianMobile(trimmed);
  if (!digits) return { error: "Enter a valid email or 10-digit mobile number." };
  return { email: phoneToSyntheticEmail(digits), isPhone: true, phone: digits };
}
