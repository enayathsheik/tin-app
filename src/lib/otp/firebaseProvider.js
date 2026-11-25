// OTP provider: Firebase phone sign-in (invisible reCAPTCHA + SMS). Contract in
// ./index.js. The only file that knows about Firebase's phone sign-in.
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../../firebase/config";
import { OtpError } from "../../utils/otp.js";

const CODES = {
  "invalid-phone-number": "bad_phone", "missing-phone-number": "bad_phone",
  "invalid-verification-code": "bad_code", "missing-verification-code": "bad_code",
  "code-expired": "expired", "session-expired": "expired", "invalid-verification-id": "expired",
  "too-many-requests": "too_many", "quota-exceeded": "too_many",
  "network-request-failed": "network",
  "operation-not-allowed": "off", "billing-not-enabled": "off", "unauthorized-domain": "off",
  "captcha-check-failed": "check_failed", "invalid-app-credential": "check_failed", "missing-app-credential": "check_failed",
  "user-disabled": "blocked",
};
const asOtpError = (e) => {
  const code = String(e?.code || "").replace(/^auth\//, "");
  if (!CODES[code]) console.error("[otp] firebase:", e?.code || e);
  return new OtpError(CODES[code] || "failed");
};

let box = null, verifier = null;
function freshVerifier() {
  // A reCAPTCHA can be used once; a resend needs a new one.
  try { verifier?.clear(); } catch { /* already gone */ }
  box?.remove();
  box = document.createElement("div");
  document.body.appendChild(box);
  // Local emulators only (auth.emulatorConfig is null against the real service).
  if (auth.emulatorConfig) auth.settings.appVerificationDisabledForTesting = true;
  verifier = new RecaptchaVerifier(auth, box, { size: "invisible" });
  return verifier;
}

export async function send(phone) {
  let result;
  try { result = await signInWithPhoneNumber(auth, `+91${phone}`, freshVerifier()); } catch (e) { throw asOtpError(e); }
  return {
    confirm: async (code) => {
      try { await result.confirm(code); } catch (e) { throw asOtpError(e); }
    },
  };
}
