// ============================================================
// TIN — phone (one-time code) accounts (B2)
// File: functions/phoneAccounts.js
// Deploy: firebase deploy --only functions:phoneAccountStatus,functions:joinPhoneAccount,functions:dropEmptyPhoneAccount
//
// Older mobile accounts are email/password on {number}@phone.tinit.in and the
// number was never checked. A confirmed code makes a separate phone account.
// These join the two — only when the caller proves BOTH: the number (their own
// sign-in) and the old password (a fresh ID token of the old account). A code
// alone never opens, changes or reveals anything of the old account beyond the
// fact that one exists. Works with any OTP provider: all that matters is the
// phone number on the caller's Firebase account.
// ============================================================
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();
const OPTS = { region: "asia-south1", cors: true, invoker: "public", enforceAppCheck: false, timeoutSeconds: 30, memory: "256MiB" };
const refuse = (status, code, message) => new HttpsError(status, message, { code });

let corePromise = null;
const loadCore = () => (corePromise = corePromise || Promise.all([
  import("./vendor/jobs/utils/phoneAuth.js"), import("./vendor/jobs/utils/jobRoles.js"),
]).then((m) => Object.assign({}, ...m)));

// The caller, with a confirmed Indian number. `empty` = made by the code just
// now: nothing but a phone sign-in, and no TIN data.
async function caller(request) {
  if (!request.auth) throw refuse("unauthenticated", "not_signed_in", "Please log in first.");
  const uid = request.auth.uid;
  const user = await getAuth().getUser(uid);
  // The live account, not the token: an old token may carry an old number.
  const m = /^\+91([6-9]\d{9})$/.exec(user.phoneNumber || "");
  if (!m) throw refuse("permission-denied", "no_phone", "Confirm your mobile number first.");
  return { uid, user, phone: m[1] };
}
async function isEmpty({ uid, user }) {
  if (user.email || user.providerData.some((p) => p.providerId !== "phone")) return false;
  const snaps = await db.getAll(db.doc(`users/${uid}`), db.doc(`jobProfiles/${uid}`), db.doc(`jobProfilesPrivate/${uid}`));
  return snaps.every((x) => !x.exists);
}

async function oldAccount(phone, uid, core) {
  try {
    const old = await getAuth().getUserByEmail(core.phoneToSyntheticEmail(phone));
    return old.uid === uid ? null : old;
  } catch (e) {
    if (e.code === "auth/user-not-found") return null;
    throw e;
  }
}

// Owner decision: codes are for skilled workers. Businesses and professionals
// keep their password.
async function usesPassword(uid, core) {
  const [u, p] = await db.getAll(db.doc(`users/${uid}`), db.doc(`jobProfiles/${uid}`));
  const user = u.exists ? u.data() : {};
  return core.isEmployerAccount(user) || ["admin", "hom_admin"].includes(user.role) || (p.exists && p.data().lane === "professional");
}

// → { old: "none" | "joinable" | "other" }
exports.phoneAccountStatus = onCall(OPTS, async (request) => {
  const me = await caller(request);
  const core = await loadCore();
  const old = await oldAccount(me.phone, me.uid, core);
  if (!old || old.phoneNumber) return { old: "none" };
  return { old: (await usesPassword(old.uid, core)) ? "other" : "joinable" };
});

exports.joinPhoneAccount = onCall(OPTS, async (request) => {
  const me = await caller(request);
  const core = await loadCore();
  const token = request.data && request.data.oldIdToken;
  if (typeof token !== "string" || !token || token.length > 4096) throw refuse("invalid-argument", "bad_input", "Enter your old password.");
  let proof;
  try { proof = await getAuth().verifyIdToken(token, true); } catch { throw refuse("permission-denied", "bad_proof", "Enter your old password again."); }
  // The password was just entered, for exactly this number's old account.
  if (proof.uid === me.uid
    || proof.email !== core.phoneToSyntheticEmail(me.phone)
    || !proof.firebase || proof.firebase.sign_in_provider !== "password"
    || Date.now() / 1000 - proof.auth_time > 5 * 60) throw refuse("permission-denied", "bad_proof", "Enter your old password again.");
  const old = await getAuth().getUser(proof.uid);
  if (old.phoneNumber) throw refuse("failed-precondition", "already_joined", "This account already has a number.");
  if (await usesPassword(old.uid, core)) throw refuse("failed-precondition", "use_password", "Please log in with your password.");
  // Only a brand-new, empty phone account is ever removed.
  if (!(await isEmpty(me))) throw refuse("failed-precondition", "not_empty", "This number already has its own account.");

  // A number can be on one account only, so it has to leave the empty one first.
  await getAuth().deleteUser(me.uid);
  try {
    await getAuth().updateUser(old.uid, { phoneNumber: `+91${me.phone}` });
  } catch (e) {
    // Nothing is lost: the next code makes an empty account and asks again.
    console.error("[joinPhoneAccount] number not added:", e && e.code);
    throw refuse("unavailable", "try_again", "Couldn't join your accounts. Please try again.");
  }
  return { joined: true };
});

// Someone who confirmed a code but decided not to make an account.
exports.dropEmptyPhoneAccount = onCall(OPTS, async (request) => {
  const me = await caller(request);
  if (!(await isEmpty(me))) return { dropped: false };
  await getAuth().deleteUser(me.uid);
  return { dropped: true };
});
