// suggestJobProfile Cloud Function on the emulators (docs/JOBS_BLUEPRINT.md §8).
// Runs under the "demo-tin-test" project: the emulator suite can't reach any
// real Firebase project, and no OpenAI key is loaded, so the AI call itself
// always fails here (politely) — which is exactly what lets this test check
// the login gate, input checks and the rate-limit counter without OpenAI.
//   npm run test:functions
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PROJECT = "demo-tin-test";
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-south1/suggestJobProfile`;
const AUTH = "http://127.0.0.1:9099";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ANSWERS = ["राजमिस्त्री हूँ, tile ka kaam bhi", "5 saal", "Thane mein 3 tower plaster", "Thane, Navi Mumbai · Hindi, Marathi", "dihadi, abhi se"];

async function signUp(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-pass-123", returnSecureToken: true }),
  });
  const j = await r.json();
  return { idToken: j.idToken, uid: j.localId };
}

async function call(data, idToken) {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return { status: r.status, body: await r.json() };
}

// Admin read of the Firestore emulator ("Bearer owner" bypasses rules).
async function readDoc(path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: "Bearer owner" } });
  return r.status === 200 ? r.json() : null;
}

beforeAll(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
});
afterAll(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
});

describe("suggestJobProfile", () => {
  it("refuses calls without a login", async () => {
    const { status, body } = await call({ answers: ANSWERS, lane: "skilled" });
    expect(status).toBe(401);
    expect(body.error.status).toBe("UNAUTHENTICATED");
  });

  it("refuses bad input (and doesn't count it)", async () => {
    const { idToken, uid } = await signUp("bad-input@test.dev");
    for (const answers of [undefined, ["a", "b"], ["", "", "", "", ""], ["a".repeat(600), "a".repeat(600), "a".repeat(600), "a".repeat(600), "a".repeat(600)]]) {
      const { body } = await call({ answers }, idToken);
      expect(body.error.status).toBe("INVALID_ARGUMENT");
    }
    expect(await readDoc(`aiUsage/${uid}`)).toBeNull();
  });

  it("counts every call and blocks call 6 of the day with a try-tomorrow message", async () => {
    const { idToken, uid } = await signUp("limit@test.dev");
    for (let n = 1; n <= 5; n++) {
      const { body } = await call({ answers: ANSWERS, lane: "skilled" }, idToken);
      // No OpenAI key on the emulator → the friendly "couldn't fill it" error, never a fake draft.
      expect(body.error.status).toBe("UNAVAILABLE");
      expect(body.error.message).toMatch(/fill the form yourself/);
    }
    const sixth = await call({ answers: ANSWERS, lane: "skilled" }, idToken);
    expect(sixth.body.error.status).toBe("RESOURCE_EXHAUSTED");
    expect(sixth.body.error.message).toMatch(/try again tomorrow/);

    const usage = await readDoc(`aiUsage/${uid}`);
    expect(usage.fields.profileDayCount.integerValue).toBe("5");
    expect(usage.fields.profileMonthCount.integerValue).toBe("5");
    const global = await readDoc("aiUsage/_global");
    expect(Number(global.fields.profileDayCount.integerValue)).toBeGreaterThanOrEqual(5);
  });

  it("writes nothing to the candidate's profile", async () => {
    const { idToken, uid } = await signUp("no-write@test.dev");
    await call({ answers: ANSWERS, lane: "skilled" }, idToken);
    expect(await readDoc(`jobProfiles/${uid}`)).toBeNull();
    expect(await readDoc(`jobProfilesPrivate/${uid}`)).toBeNull();
  });
});
