// The Add page's save sequence, kept free of React/Firebase imports so it's
// unit-tested (test/unit/submitStore.test.js). Rules:
//  - the store counts as added ONLY when the Firestore save succeeds;
//  - if the save fails, nothing is reported as added (no "saved locally"):
//    the caller keeps the user on the form with their data and shows `error`;
//  - awarding points is best-effort AFTER a successful save — if it fails,
//    the store is still added (it really is in Firestore).
//
// deps: { save: () => Promise<string id>, awardPoints?: () => Promise, onSaved: (id) => void }
// Returns { ok: true, id, pointsError? } or { ok: false, error }.
export async function submitStore({ save, awardPoints, onSaved }) {
  let id;
  try {
    id = await save();
  } catch (err) {
    return { ok: false, error: storeSaveErrorMessage(err) };
  }
  let pointsError = null;
  if (awardPoints) {
    try { await awardPoints(); } catch (err) { pointsError = err?.message || String(err); }
  }
  onSaved(id);
  return pointsError ? { ok: true, id, pointsError } : { ok: true, id };
}

// Plain-language reason for a failed store save.
export function storeSaveErrorMessage(err) {
  const code = err?.code || "";
  if (code === "permission-denied") return "TIN didn't accept this store (permission denied). Please check you're logged in, then try again.";
  if (code === "unavailable" || code === "deadline-exceeded" || /network|offline/i.test(err?.message || "")) {
    return "Couldn't reach TIN — check your internet connection and try again.";
  }
  if (code === "unauthenticated") return "Your login has expired. Please log in again, then try again.";
  return `Something went wrong: ${err?.message || "unknown error"}. Please try again.`;
}
