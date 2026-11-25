// What happens after a one-time code is confirmed (B2): log in, join the
// person's older password account, or make a new skilled-worker account. Knows
// nothing about who sent the code (src/lib/otp).
//
// Owner decision: a code alone never opens an old password account — its number
// was never checked. The old password is asked for once, then the two are
// joined on the server (functions/phoneAccounts.js).
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, inMemoryPersistence, initializeAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions, getUserProfile, saveUserProfile } from "../firebase/config";
import { claimHandle, findAvailableHandle, suggestHandleBase } from "../utils/handles";
import { phoneOf, skilledAccount, skilledJobProfile } from "../utils/otp.js";
import { phoneToSyntheticEmail } from "../utils/phoneAuth.js";
import { saveJobProfile } from "./jobProfiles";

const call = async (name, data = {}) => (await httpsCallable(functions, name, { timeout: 30000 })(data)).data;

// The 10 digits of the number this browser has confirmed, or null.
export const confirmedPhone = () => phoneOf(auth.currentUser?.phoneNumber);

// → { next: "in", profile } | { next: "join" } | { next: "password" } | { next: "new" }
export async function afterOtp() {
  const profile = await getUserProfile(auth.currentUser.uid);
  if (profile) return { next: "in", profile: { ...profile, uid: auth.currentUser.uid } };
  const { old } = await call("phoneAccountStatus");
  return { next: old === "joinable" ? "join" : old === "other" ? "password" : "new" };
}

// Prove the old password without leaving the phone sign-in: a second, in-memory
// Firebase app. Returns its ID token.
async function oldAccountToken(phone, password) {
  const app = initializeApp(auth.app.options, `join-${Date.now()}`);
  try {
    const a = initializeAuth(app, { persistence: inMemoryPersistence });
    const emu = auth.emulatorConfig;
    if (emu) connectAuthEmulator(a, `http://${emu.host}:${emu.port}`, { disableWarnings: true });
    const cred = await signInWithEmailAndPassword(a, phoneToSyntheticEmail(phone), password);
    return await cred.user.getIdToken();
  } finally {
    await deleteApp(app).catch(() => {});
  }
}

// Throws { code: "wrong_password" | "too_many" | "failed" }.
export async function joinOldAccount(password) {
  const phone = confirmedPhone();
  const fail = (code, e) => { console.error("[skilled] join failed:", e?.code || e); return Object.assign(new Error(code), { code }); };
  let oldIdToken;
  try { oldIdToken = await oldAccountToken(phone, password); } catch (e) {
    const c = String(e?.code || "");
    throw fail(/too-many/.test(c) ? "too_many" : /credential|password|user-not-found/.test(c) ? "wrong_password" : "failed", e);
  }
  try { await call("joinPhoneAccount", { oldIdToken }); } catch (e) { throw fail("failed", e); }
  // The empty phone-only account is gone; the old one now has the number.
  const cred = await signInWithEmailAndPassword(auth, phoneToSyntheticEmail(phone), password);
  const profile = await getUserProfile(cred.user.uid);
  return profile ? { ...profile, uid: cred.user.uid } : null;
}

// Profile first, account last: if anything fails halfway, signing in again with
// a code starts these questions again instead of leaving a half-made account.
export async function createSkilledAccount(f) {
  const uid = auth.currentUser.uid, phone = confirmedPhone();
  await saveJobProfile(uid, skilledJobProfile(f, phone), { isNew: true });
  const account = skilledAccount(f, uid, phone);
  await saveUserProfile(uid, account);
  try {
    const handle = await findAvailableHandle(suggestHandleBase(account.name));
    await claimHandle(uid, handle, { role: account.role, displayName: account.name, city: "", photoUrl: null });
    await saveUserProfile(uid, { handle });
    account.handle = handle;
  } catch (e) {
    console.error("[skilled] handle not claimed:", e);
  }
  return account;
}

// Leave without an account: don't keep an empty one for this number.
export async function dropPhoneSignIn() {
  const u = auth.currentUser;
  try { if (u?.phoneNumber && !u.email) await call("dropEmptyPhoneAccount"); } catch (e) { console.warn("[skilled] empty account not removed:", e?.code || e); }
  await signOut(auth).catch(() => {});
}
