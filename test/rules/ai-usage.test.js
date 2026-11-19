// AI profile helper rate-limit counters (docs/JOBS_BLUEPRINT.md §8):
// aiUsage/{uid} and aiUsage/_global are server-only — written by the
// suggestJobProfile Cloud Function with the Admin SDK. No client may read
// or write them: not the owner, not other users, not admin, not guests.
// Run against the Firestore emulator only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "ai-usage-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "aiUsage", "u1"), { profileDay: "2026-11-19", profileDayCount: 2, profileMonth: "2026-11", profileMonthCount: 2 });
    await setDoc(doc(db, "aiUsage", "_global"), { profileDay: "2026-11-19", profileDayCount: 40 });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const as = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();
const guest = () => testEnv.unauthenticatedContext().firestore();
const reset = { profileDay: "2026-11-19", profileDayCount: 0, profileMonth: "2026-11", profileMonthCount: 0 };

describe("aiUsage/{uid}", () => {
  it("the owner can't read their own counter", async () => {
    await assertFails(getDoc(doc(as("u1"), "aiUsage", "u1")));
  });
  it("the owner can't reset, change, create or delete their counter", async () => {
    await assertFails(setDoc(doc(as("u1"), "aiUsage", "u1"), reset));
    await assertFails(updateDoc(doc(as("u1"), "aiUsage", "u1"), { profileDayCount: 0 }));
    await assertFails(deleteDoc(doc(as("u1"), "aiUsage", "u1")));
    await assertFails(setDoc(doc(as("u2"), "aiUsage", "u2"), reset));
  });
  it("other users, guests and admin can't read or write it", async () => {
    await assertFails(getDoc(doc(as("u2"), "aiUsage", "u1")));
    await assertFails(getDoc(doc(guest(), "aiUsage", "u1")));
    await assertFails(getDoc(doc(as("admin", ADMIN_EMAIL), "aiUsage", "u1")));
    await assertFails(setDoc(doc(as("admin", ADMIN_EMAIL), "aiUsage", "u1"), reset));
  });
});

describe("aiUsage/_global", () => {
  it("no one can read or write the global counter from the app", async () => {
    for (const db of [as("u1"), guest(), as("admin", ADMIN_EMAIL)]) {
      await assertFails(getDoc(doc(db, "aiUsage", "_global")));
      await assertFails(setDoc(doc(db, "aiUsage", "_global"), { profileDay: "2026-11-19", profileDayCount: 0 }));
      await assertFails(deleteDoc(doc(db, "aiUsage", "_global")));
    }
  });
  it("listing the collection is denied", async () => {
    const { collection, getDocs } = await import("firebase/firestore");
    await assertFails(getDocs(collection(as("u1"), "aiUsage")));
    await assertFails(getDocs(collection(as("admin", ADMIN_EMAIL), "aiUsage")));
  });
});

describe("sanity: the counters exist (server writes work)", () => {
  it("rules-disabled (Admin-like) context can read them", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await assertSucceeds(getDoc(doc(context.firestore(), "aiUsage", "u1")));
    });
  });
});
