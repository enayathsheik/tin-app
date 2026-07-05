import { PINCODE_STATE_MAP, CONTRIBUTOR_LEVELS, FREE_EMAIL_DOMAINS } from "../data/constants";

export function extractPincodeFromText(text) {
  if (!text) return "";
  const matches = text.match(/[1-9][0-9]{5}/g);
  return matches ? matches[0] : "";
}

export function validatePincode(pin) {
  if (!pin || pin.length !== 6) return { valid: false, state: "" };
  const allDigits = /^[0-9]+$/.test(pin);
  if (!allDigits || pin[0] === "0") return { valid: false, state: "" };
  const prefix3 = pin.substring(0, 3);
  const prefix2 = pin.substring(0, 2);
  const state = PINCODE_STATE_MAP[prefix3] || PINCODE_STATE_MAP[prefix2] || "";
  return { valid: true, state };
}

export function getLevel(pts) { return CONTRIBUTOR_LEVELS.find(l => pts >= l.min && pts <= l.max) || CONTRIBUTOR_LEVELS[0]; }

export const isWorkEmail = (email) => { if (!email || !email.includes("@")) return false; const domain = email.split("@")[1]?.toLowerCase(); return !FREE_EMAIL_DOMAINS.includes(domain); };
