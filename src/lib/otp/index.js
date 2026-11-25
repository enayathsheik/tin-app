// One-time codes by phone (B2). Screens use ONLY this file, so the SMS provider
// can be swapped (Firebase today; MSG91, WhatsApp OTP… later) without touching
// them. How to add one: docs/JOBS_BLUEPRINT.md §11.
//
//   const session = await sendOtp("9876500001");   // 10 digits, India
//   await session.confirm("123456");               // → signed in
//
// After confirm() the person is signed in to Firebase Auth on an account whose
// phoneNumber is +91 and those digits — whichever provider sent the code. That
// number is the identity, so accounts survive a provider change.
// Both throw OtpError with one of OTP_ERRORS as `code`, never a provider's own.
import { OTP_PROVIDER } from "../../data/otp.js";
import { OTP_ERRORS, OtpError } from "../../utils/otp.js";

const PROVIDERS = {
  firebase: () => import("./firebaseProvider.js"),
};

async function guard(fn) {
  try { return await fn(); } catch (e) {
    if (e instanceof OtpError && OTP_ERRORS.includes(e.code)) throw e;
    console.error("[otp] unexpected:", e?.code || e);
    throw new OtpError("failed");
  }
}

export function sendOtp(phone) {
  return guard(async () => {
    const load = PROVIDERS[OTP_PROVIDER];
    if (!load) throw new OtpError("off");
    const session = await (await load()).send(phone);
    return { confirm: (code) => guard(() => session.confirm(code)) };
  });
}
