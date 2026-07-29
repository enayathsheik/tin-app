import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

export const RESERVED_HANDLES = [
  "admin", "login", "home", "discover", "add", "jobs", "job", "store", "stores", "inspi",
  "rewards", "leaderboard", "deals", "myzone", "staff", "profile", "profiles", "p", "api",
  "settings", "help", "about", "contact", "terms", "privacy",
];

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

// Maps the app's internal auth role to the public profiles/{uid}.role value.
const ROLE_MAP = {
  consumer: "consumer",
  contributor: "marketChampion",
  retailer: "retailer",
  architect: "architect",
  contractor: "contractor",
};

export function publicRoleFromInternalRole(role) {
  return ROLE_MAP[role] || role;
}

export function isValidHandleFormat(handle) {
  return HANDLE_RE.test(handle || "");
}

export function isReservedHandle(handle) {
  return RESERVED_HANDLES.includes((handle || "").toLowerCase());
}

export function suggestHandleBase(name) {
  const base = (name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
  return base.length >= 3 ? base : (base + "user").slice(0, 15);
}

// Not itself atomic — final uniqueness is enforced by claimHandle's transaction.
// Used for live-typing feedback and for resolving an auto-suggested handle.
export async function checkHandleAvailable(handle) {
  const h = (handle || "").toLowerCase();
  if (!isValidHandleFormat(h) || isReservedHandle(h)) return false;
  const snap = await getDoc(doc(db, "handles", h));
  return !snap.exists();
}

// Appends random digits to `base` until an available handle is found.
export async function findAvailableHandle(base) {
  if (await checkHandleAvailable(base)) return base;
  for (let i = 0; i < 50; i++) {
    const suffix = String(Math.floor(Math.random() * 900) + 100);
    const candidate = base.slice(0, 20 - suffix.length) + suffix;
    if (await checkHandleAvailable(candidate)) return candidate;
  }
  throw new Error("Could not find an available handle — please choose one manually.");
}

// Builds the role-specific public fields for profiles/{uid}. Never add
// phone/email/address/raw contact fields here — see the field-exposure table.
function buildPublicFields(user) {
  const publicRole = publicRoleFromInternalRole(user.role);
  const specTags = (user.specialization || "").split(",").map(s => s.trim()).filter(Boolean);
  switch (publicRole) {
    case "marketChampion":
      return { points: user.points || 0, badges: user.badges || [], storesAddedCount: user.storesAdded || 0 };
    case "retailer":
      return { storeId: user.storeId || null, storeCategories: user.categories || [], inspiCount: user.inspiCount || 0 };
    case "architect":
      return { specializationTags: specTags, inspiCount: user.inspiCount || 0 };
    case "contractor":
      return { specializationTags: specTags, inspiCount: user.inspiCount || 0, jobsPostedCount: user.jobsPostedCount || 0 };
    default:
      return {};
  }
}

// Atomically claims `handle` for `uid` — releasing `oldHandle` (if given) in
// the same transaction — and writes/merges the public profiles/{uid} doc.
export async function claimHandle(uid, handle, user, oldHandle = null) {
  const h = (handle || "").toLowerCase();
  if (!isValidHandleFormat(h)) throw new Error("Handle must be 3-20 lowercase letters, numbers, or underscores.");
  if (isReservedHandle(h)) throw new Error("That handle is reserved — please choose another.");

  const handleRef = doc(db, "handles", h);
  const profileRef = doc(db, "profiles", uid);
  const oldHandleRef = oldHandle ? doc(db, "handles", oldHandle.toLowerCase()) : null;

  await runTransaction(db, async (tx) => {
    const [handleSnap, profileSnap] = await Promise.all([tx.get(handleRef), tx.get(profileRef)]);
    if (handleSnap.exists()) throw new Error("That handle is already taken.");
    if (oldHandleRef) tx.delete(oldHandleRef);
    tx.set(handleRef, { uid, createdAt: serverTimestamp() });
    const displayName = user.displayName || user.name || "";
    tx.set(profileRef, {
      handle: h,
      role: publicRoleFromInternalRole(user.role),
      displayName,
      // Lowercase mirror for case-insensitive prefix search (global user
      // search) — `handle` above is already always-lowercase so it needs no
      // twin. Written additively here; older profiles backfill it the next
      // time this user saves their profile, no migration needed.
      displayNameLower: displayName.toLowerCase(),
      city: user.city || "",
      photoUrl: user.photoUrl || null,
      ...buildPublicFields(user),
      ...(profileSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  return h;
}

const HANDLE_CHANGE_COOLDOWN_DAYS = 30;

// Rate-limits handle changes to once per 30 days, based on users/{uid}.handleChangedAt
// (the private doc — never stored on the public profiles/{uid} doc).
export function canChangeHandle(user) {
  if (!user?.handleChangedAt) return { ok: true };
  const last = new Date(user.handleChangedAt);
  const daysSince = (Date.now() - last.getTime()) / 86400000;
  if (daysSince < HANDLE_CHANGE_COOLDOWN_DAYS) {
    return { ok: false, daysRemaining: Math.ceil(HANDLE_CHANGE_COOLDOWN_DAYS - daysSince) };
  }
  return { ok: true };
}
