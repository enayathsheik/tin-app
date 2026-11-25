// B2: joining a phone (one-time code) account to an older password account.
// Emulators only, demo-tin-test project:  npm run test:functions
import { createRequire } from "module";
import process from "process";
import { beforeEach, describe, expect, it } from "vitest";

const PROJECT = "demo-tin-test";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const req = createRequire(new URL("../../functions/index.js", import.meta.url));
const { initializeApp } = req("firebase-admin/app");
const { getFirestore } = req("firebase-admin/firestore");
const { getAuth } = req("firebase-admin/auth");
const app = initializeApp({ projectId: PROJECT }, "phone-test");
const db = getFirestore(app), admin = getAuth(app);
const IDT = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts";
const post = async (url, body) => (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

let n = Math.floor(Math.random() * 1e6);
const newPhone = () => "98" + String(10000000 + (n++ % 89999999)).slice(0, 8);
// A real phone sign-in on the emulator: send code, read it, confirm it.
async function byCode(phone, prefix = "+91") {
  const { sessionInfo } = await post(`${IDT}:sendVerificationCode?key=demo`, { phoneNumber: prefix + phone, recaptchaToken: "x" });
  const list = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/verificationCodes`)).json();
  const { code } = list.verificationCodes.filter(c => c.sessionInfo === sessionInfo).pop();
  const j = await post(`${IDT}:signInWithPhoneNumber?key=demo`, { sessionInfo, code });
  return { uid: j.localId, idToken: j.idToken };
}
const email = (phone) => `${phone}@phone.tinit.in`;
async function byPassword(phone, { address = email(phone), make = true } = {}) {
  const j = await post(`${IDT}:${make ? "signUp" : "signInWithPassword"}?key=demo`, { email: address, password: "old-pass-1", returnSecureToken: true });
  return { uid: j.localId, idToken: j.idToken };
}
async function call(name, who, data = {}) {
  const r = await fetch(`http://127.0.0.1:5001/${PROJECT}/asia-south1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${who.idToken}` } : {}) }, body: JSON.stringify({ data }),
  });
  const j = await r.json();
  return j.error ? { error: j.error.status, code: j.error.details?.code } : j.result;
}
const exists = (uid) => admin.getUser(uid).then(u => u, () => null);
let phone;
beforeEach(() => { phone = newPhone(); });

describe("who may call", () => {
  it.each(["phoneAccountStatus", "joinPhoneAccount", "dropEmptyPhoneAccount"])("%s: refused without a login, or without a confirmed Indian number", async (fn) => {
    expect((await call(fn)).error).toBe("UNAUTHENTICATED");
    expect((await call(fn, await byPassword(phone), { oldIdToken: "x" })).code).toBe("no_phone");
    expect((await call(fn, await byCode("4155550" + String(100 + (n % 800)), "+1"), { oldIdToken: "x" })).code).toBe("no_phone");
  });
});

describe("is there an older account?", () => {
  it("no", async () => expect(await call("phoneAccountStatus", await byCode(phone))).toEqual({ old: "none" }));
  it("yes: a job seeker, a consumer, a champion, a skilled profile, or no profile at all → joinable", async () => {
    for (const set of [null, { role: "jobseeker" }, { role: "consumer" }, { role: "contributor" }]) {
      const p = newPhone(), old = await byPassword(p);
      if (set) await db.doc(`users/${old.uid}`).set(set);
      if (set) await db.doc(`jobProfiles/${old.uid}`).set({ lane: "skilled" });
      expect(await call("phoneAccountStatus", await byCode(p))).toEqual({ old: "joinable" });
    }
  });
  it("businesses, professionals and admins keep their password", async () => {
    for (const [u, jp] of [[{ role: "employer" }], [{ role: "retailer" }], [{ role: "consumer", storeId: "s" }], [{ role: "contributor", jobBusiness: { name: "A" } }], [{ role: "hom_admin" }], [{ role: "admin" }], [{ role: "jobseeker" }, { lane: "professional" }]]) {
      const p = newPhone(), old = await byPassword(p);
      await db.doc(`users/${old.uid}`).set(u);
      if (jp) await db.doc(`jobProfiles/${old.uid}`).set(jp);
      const me = await byCode(p);
      expect(await call("phoneAccountStatus", me)).toEqual({ old: "other" });
      expect((await call("joinPhoneAccount", me, { oldIdToken: (await byPassword(p, { make: false })).idToken })).code).toBe("use_password");
      expect(await exists(me.uid)).not.toBeNull();
      expect((await exists(old.uid)).phoneNumber).toBeUndefined();
    }
  });
  it("another number's account is never reported", async () => {
    await byPassword(newPhone());
    expect(await call("phoneAccountStatus", await byCode(phone))).toEqual({ old: "none" });
  });
});

describe("joining", () => {
  it("number + old password: the old account gets the number, keeps its uid, data and password; the empty one is gone; next code opens it", async () => {
    const old = await byPassword(phone);
    await db.doc(`users/${old.uid}`).set({ role: "consumer", name: "Ramesh" });
    const me = await byCode(phone);
    expect(await call("joinPhoneAccount", me, { oldIdToken: (await byPassword(phone, { make: false })).idToken })).toEqual({ joined: true });
    expect(await exists(me.uid)).toBeNull();
    expect((await exists(old.uid)).phoneNumber).toBe("+91" + phone);
    expect((await db.doc(`users/${old.uid}`).get()).data().name).toBe("Ramesh");
    expect((await byPassword(phone, { make: false })).uid).toBe(old.uid);
    const again = await byCode(phone);
    expect(again.uid).toBe(old.uid);
    expect(await call("phoneAccountStatus", again)).toEqual({ old: "none" });
  });
  it("a code alone never joins: no proof, rubbish, or the phone account's own token", async () => {
    const old = await byPassword(phone), me = await byCode(phone);
    for (const oldIdToken of [undefined, "", 5, null, { a: 1 }, "x".repeat(5000)]) expect((await call("joinPhoneAccount", me, { oldIdToken })).code).toBe("bad_input");
    for (const oldIdToken of ["rubbish", me.idToken]) expect((await call("joinPhoneAccount", me, { oldIdToken })).code).toBe("bad_proof");
    expect((await exists(old.uid)).phoneNumber).toBeUndefined();
    expect(await exists(me.uid)).not.toBeNull();
  });
  it("another number's password account, or an ordinary email account, proves nothing", async () => {
    const other = newPhone(), me = await byCode(phone);
    await byPassword(phone);
    const a = await byPassword(other), b = await byPassword(phone, { address: `me${phone}@gmail.com` });
    for (const x of [a, b]) {
      expect((await call("joinPhoneAccount", me, { oldIdToken: x.idToken })).code).toBe("bad_proof");
      expect((await exists(x.uid)).phoneNumber).toBeUndefined();
    }
  });
  it("a signed-out (revoked) proof is refused", async () => {
    const old = await byPassword(phone), me = await byCode(phone);
    await new Promise(r => setTimeout(r, 1500));
    await admin.revokeRefreshTokens(old.uid);
    expect((await call("joinPhoneAccount", me, { oldIdToken: old.idToken })).code).toBe("bad_proof");
  });
  it("a phone account with anything in it is never removed", async () => {
    for (const path of ["users", "jobProfiles", "jobProfilesPrivate"]) {
      const p = newPhone(), old = await byPassword(p), me = await byCode(p);
      await db.doc(`${path}/${me.uid}`).set({ name: "x" });
      expect((await call("joinPhoneAccount", me, { oldIdToken: old.idToken })).code).toBe("not_empty");
      expect(await exists(me.uid)).not.toBeNull();
      expect((await exists(old.uid)).phoneNumber).toBeUndefined();
      expect(await call("dropEmptyPhoneAccount", me)).toEqual({ dropped: false });
    }
  });
  it("after joining, the old account can't be joined or dropped again", async () => {
    const old = await byPassword(phone), me = await byCode(phone);
    await call("joinPhoneAccount", me, { oldIdToken: old.idToken });
    const now = await byCode(phone);
    expect((await call("joinPhoneAccount", now, { oldIdToken: (await byPassword(phone, { make: false })).idToken })).code).toBe("bad_proof");
    expect(await call("dropEmptyPhoneAccount", now)).toEqual({ dropped: false });
    expect(await exists(old.uid)).not.toBeNull();
  });
});

describe("changing your mind", () => {
  it("an empty phone account is removed, and the older account is untouched", async () => {
    const old = await byPassword(phone), me = await byCode(phone);
    expect(await call("dropEmptyPhoneAccount", me)).toEqual({ dropped: true });
    expect(await exists(me.uid)).toBeNull();
    expect((await exists(old.uid)).phoneNumber).toBeUndefined();
  });
});
