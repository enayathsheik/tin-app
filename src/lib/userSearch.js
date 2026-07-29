// Global user search — the WhatsApp/Telegram "new chat" entry point.
//
// Firestore has no native substring/full-text search, so this is bounded
// PREFIX search only (fuzzy/typo-tolerant search is a later enhancement, out
// of scope for beta). Queries the PUBLIC profiles/{uid} collection only —
// the same sanitized shape PublicProfilePage renders (see
// src/utils/handles.js buildPublicFields) — never phone/email/address,
// because those fields don't exist on this collection at all.
import { collection, getDocs, query, where, limit as fsLimit } from "firebase/firestore";
import { db } from "../firebase/config";

const PROFILES = "profiles";
const DEFAULT_LIMIT = 20;

function prefixQuery(field, value, count) {
  return query(
    collection(db, PROFILES),
    where(field, ">=", value),
    where(field, "<=", value + ""),
    fsLimit(count)
  );
}

// Prefers exact/prefix @handle match first (handles are unique and already
// lowercase on the doc), then display-name prefix. A leading "@" restricts
// the search to handle-only. Results are deduped by uid and exclude
// `excludeUid` (the current user).
export async function searchUsers(rawQuery, { excludeUid = null, limitCount = DEFAULT_LIMIT } = {}) {
  const trimmed = (rawQuery || "").trim();
  const isHandleQuery = trimmed.startsWith("@");
  const q = (isHandleQuery ? trimmed.slice(1) : trimmed).toLowerCase();
  if (!q) return [];

  const results = new Map();
  const addDocs = (snap) => {
    snap.docs.forEach(d => {
      if (d.id === excludeUid || results.has(d.id)) return;
      results.set(d.id, { uid: d.id, ...d.data() });
    });
  };

  addDocs(await getDocs(prefixQuery("handle", q, limitCount)));

  if (!isHandleQuery && results.size < limitCount) {
    addDocs(await getDocs(prefixQuery("displayNameLower", q, limitCount)));
  }

  return Array.from(results.values()).slice(0, limitCount);
}
