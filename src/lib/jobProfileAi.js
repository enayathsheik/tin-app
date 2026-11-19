// "Fill it for me" — calls the suggestJobProfile Cloud Function
// (docs/JOBS_BLUEPRINT.md §8). Returns a DRAFT only; nothing is saved.
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";

const BUSY = "Couldn't fill it right now. Please try again, or fill the form yourself. · अभी नहीं हो पाया। फिर कोशिश करें, या खुद फ़ॉर्म भरें।";

// The server sends plain bilingual messages for these; anything else gets
// the generic one (never a raw technical error).
function friendlyAiError(e) {
  const code = String(e?.code || "").replace(/^functions\//, "");
  if (code === "unauthenticated") return "Please log in again. · फिर से लॉग इन करें।";
  if (["resource-exhausted", "invalid-argument", "unavailable"].includes(code) && typeof e?.message === "string" && e.message) return e.message;
  return BUSY;
}

export async function suggestJobProfile(answers, lane) {
  // 35 s: the server gives OpenAI 20 s, plus cold start.
  const call = httpsCallable(functions, "suggestJobProfile", { timeout: 35000 });
  try {
    const res = await call({ answers, lane: lane === "skilled" || lane === "professional" ? lane : null });
    const d = res && res.data && typeof res.data === "object" ? res.data : {};
    return {
      draft: d.draft && typeof d.draft === "object" ? d.draft : {},
      notes: Array.isArray(d.notes) ? d.notes.filter(n => typeof n === "string") : [],
    };
  } catch (e) {
    console.error("[job-profile-ai] suggest failed:", e?.code, e?.message);
    throw new Error(friendlyAiError(e), { cause: e });
  }
}
