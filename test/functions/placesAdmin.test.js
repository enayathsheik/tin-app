// S0: the Places pull / publish / delete functions are for the TIN super admin
// only. They use the Admin SDK (which bypasses firestore.rules), so the check
// lives in the function. Emulators only, demo-tin-test project, no Places key
// loaded: nothing here can reach Google.
//   npm run test:functions
import { readFileSync } from "fs";
import { beforeAll, describe, expect, it } from "vitest";

const PROJECT = "demo-tin-test";
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;
const AUTH = "http://127.0.0.1:9099";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const PULL = { jobId: "s0job", categories: [{ name: "Flooring", keywords: "tiles" }], pincodesOverride: [] };

async function signUp(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-pass-123", returnSecureToken: true }),
  });
  const j = await r.json();
  return { idToken: j.idToken, uid: j.localId };
}
async function call(name, data, idToken) {
  const r = await fetch(`${FN}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return r.json();
}
const exists = async (path) => (await fetch(`${FS}/${path}`, { headers: OWNER })).status === 200;
const put = (path, fields) => fetch(`${FS}/${path}`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields }) });

let admin, others;
beforeAll(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  admin = await signUp(ADMIN_EMAIL);
  others = [await signUp("someone@test.dev"), await signUp("enayathsheik@gmail.co"), await signUp("role-admin@test.dev"), await signUp("role-hom@test.dev")];
  await put(`users/${others[2].uid}`, { role: { stringValue: "admin" } });
  await put(`users/${others[3].uid}`, { role: { stringValue: "hom_admin" } });
  await put("staged_stores/s0", { storeName: { stringValue: "Staged" } });
});

const CALLS = [["pullPlacesData", PULL], ["publishStagedStores", { storeIds: ["s0"] }], ["deleteStagedStores", { storeIds: ["s0"] }]];

describe("Places functions are admin only", () => {
  it.each(CALLS)("%s: refused without a login", async (name, data) => {
    expect((await call(name, data)).error.status).toBe("UNAUTHENTICATED");
  });

  it.each(CALLS)("%s: refused for every other account, including role admin / hom_admin, and nothing changes", async (name, data) => {
    for (const who of others) expect((await call(name, data, who.idToken)).error.status).toBe("PERMISSION_DENIED");
    expect(await exists("pull_jobs/s0job")).toBe(false);
    expect(await exists("staged_stores/s0")).toBe(true);
  });

  it("admin gets past the gate: input is checked, and a missing key stops it before any work", async () => {
    expect((await call("pullPlacesData", {}, admin.idToken)).error.status).toBe("INVALID_ARGUMENT");
    expect((await call("pullPlacesData", PULL, admin.idToken)).error.status).toBe("FAILED_PRECONDITION");
    expect(await exists("pull_jobs/s0job")).toBe(false);
  });

  it("admin can still publish and delete staged stores", async () => {
    expect((await call("publishStagedStores", { storeIds: ["s0"] }, admin.idToken)).result).toEqual({ success: true, published: 1 });
    await put("staged_stores/s1", { storeName: { stringValue: "Staged 2" } });
    expect((await call("deleteStagedStores", { storeIds: ["s1"] }, admin.idToken)).result).toEqual({ success: true, deleted: 1 });
    expect(await exists("staged_stores/s1")).toBe(false);
  });
});

describe("no Google key in the functions code", () => {
  it.each(["index.js", "ai.js"])("%s", (f) => {
    expect(readFileSync(`functions/${f}`, "utf8")).not.toMatch(/AIza[0-9A-Za-z_-]{10}/);
  });
});
