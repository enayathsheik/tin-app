// Sign-up (B1): "I'm looking for work" and "I'm hiring". Plain functions, zero
// React/Firebase imports — unit-tested in test/unit/signup.test.js.
import { INDUSTRIES, isKey } from "../data/jobsTaxonomy.js";
import { isSyntheticPhoneEmail, normalizeIndianMobile, phoneToSyntheticEmail } from "./phoneAuth.js";

export const SIGNUP_ROLE = { work: "jobseeker", hire: "employer" };
export const emptySignup = (kind) => ({
  name: "", method: "mobile", mobile: "", email: "", password: "",
  ...(kind === "hire" ? { businessName: "", industry: "", city: "", dealsIn: [] } : {}),
});

const s = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// { field: message } — empty when it can be sent. Any email or a mobile number
// will do; a work email is never asked for.
export function validateSignup(kind, f) {
  const e = {};
  if (!s(f.name)) e.name = "Add your name.";
  if (f.method === "email") {
    if (!EMAIL_RE.test(s(f.email)) || isSyntheticPhoneEmail(s(f.email))) e.email = "Enter a valid email.";
  } else if (!normalizeIndianMobile(f.mobile)) e.mobile = "Enter a 10-digit mobile number.";
  if (String(f.password || "").trim().length < 6) e.password = "Use at least 6 characters.";
  if (kind === "hire") {
    if (!s(f.businessName)) e.businessName = "Add your business name.";
    if (!isKey(INDUSTRIES, f.industry)) e.industry = "Choose your type of business.";
    if (!s(f.city)) e.city = "Add your city.";
  }
  return e;
}

// The Firebase Auth email for this form, and the real phone to keep.
export function signupIdentity(f) {
  if (f.method === "email") return { authEmail: s(f.email).toLowerCase(), phone: null };
  const phone = normalizeIndianMobile(f.mobile);
  return { authEmail: phoneToSyntheticEmail(phone), phone };
}

// users/{uid} for the new account. jobBusiness is what Post a Job prefills from
// (utils/jobDraft.js) and what makes an account an employer in the rules.
export function signupProfile(kind, f, uid, categories, now = new Date()) {
  const { authEmail, phone } = signupIdentity(f);
  return {
    uid, name: s(f.name), email: authEmail, phone, workEmail: authEmail, personalEmail: "",
    role: SIGNUP_ROLE[kind], linkedin: "", company: kind === "hire" ? s(f.businessName) : "",
    points: 0, storesAdded: 0, citiesCovered: 0, level: "Bronze",
    validationStatus: "n/a", createdAt: now.toISOString(),
    ...(kind === "hire" ? {
      city: s(f.city),
      jobBusiness: { name: s(f.businessName), industry: f.industry, city: s(f.city) },
      dealsIn: categories.filter(c => (f.dealsIn || []).includes(c)),
    } : {}),
  };
}

// Where a new account goes when it wasn't on its way somewhere else.
export const signupLanding = (role) => (role === "employer" ? "/jobs/desk" : "/jobs/profile");

// `path` = where they were going when asked to log in (a job to apply to, Post
// a Job…). Each kind of account goes back only to pages meant for it.
export function signupNext(role, path, landing = signupLanding(role)) {
  const p = typeof path === "string" && /^\/(?!\/)/.test(path) && path !== "/" && !path.startsWith("/signup") ? path : "";
  const wrong = role === "employer" ? /^\/jobs\/(profile|applications|saved)/ : /^\/jobs\/(desk|post)/;
  return p && !wrong.test(p) ? p : landing;
}

// Firebase's error → one plain sentence. `exists` = offer "Log in" instead.
export function signupError(code, method) {
  switch (String(code || "").replace(/^auth\//, "")) {
    case "email-already-in-use": return { exists: true, text: method === "email" ? "This email already has a TIN account. Please log in." : "This mobile number already has a TIN account. Please log in." };
    case "weak-password": return { text: "Use at least 6 characters for the password." };
    case "invalid-email": return { text: "Enter a valid email." };
    case "network-request-failed": return { text: "No connection. Please check your internet and try again." };
    case "too-many-requests": return { text: "Too many tries. Please wait a few minutes and try again." };
    default: return { text: "Couldn't create your account. Please try again." };
  }
}
