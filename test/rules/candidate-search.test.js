// A1: who can read candidate profiles for Find candidates, and the consent
// ("Let employers find and call me") behind it. Firestore emulator only —
// never production:  npm run test:rules
import { readFileSync } from "fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where } from "firebase/firestore";
import { emptyProfile, splitProfile } from "../../src/utils/jobProfile.js";

const ADMIN_EMAIL = "enayathsheik@gmail.com";
let testEnv;
const db = (uid, email) => testEnv.authenticatedContext(uid, { email: email || `${uid}@example.com` }).firestore();
const guest = () => testEnv.unauthenticatedContext().firestore();
const admin = () => db("csAdmin", ADMIN_EMAIL);

const pub = (extra) => splitProfile({ ...emptyProfile(), name: "P", phone: "9000000000", lane: "skilled", trades: ["mason"], city: "Thane", experienceYears: "6", availability: "immediate", visibility: "actively_looking", ...extra }).pub;
const YES = { openToEmployers: true }, NO = { openToEmployers: false };
// Every account type that counts as an employer, and some that don't.
const EMPLOYERS = { csEmp: { role: "employer" }, csRet: { role: "retailer" }, csCon: { role: "contractor" }, csArc: { role: "architect" }, csMan: { role: "manufacturer" }, csStore: { role: "consumer", storeId: "s1" }, csPoster: { role: "contributor", jobBusiness: { name: "A" } } };
const OTHERS = { csSeeker: { role: "jobseeker" }, csConsumer: { role: "consumer" }, csChamp: { role: "contributor" } };
const E = "csEmp";

const searchQ = (d, ...more) => query(collection(d, "jobProfiles"), where("searchable", "==", true), ...more, orderBy("updatedAt", "desc"), limit(20));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "tin-candidate-search",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    for (const [uid, u] of Object.entries({ ...EMPLOYERS, ...OTHERS })) await setDoc(doc(d, "users", uid), { name: uid, ...u });
    const put = (id, data) => setDoc(doc(d, "jobProfiles", id), { ...data, updatedAt: new Date() });
    await put("yes", pub(YES));
    await put("yesPro", pub({ ...YES, lane: "professional", trades: [], role: "Sales", functions: ["sales_bd"], city: "Pune", experienceYears: "1", availability: "within_30_days" }));
    await put("no", pub(NO));
    await put("yesHidden", pub({ ...YES, visibility: "not_discoverable" }));
    await put("yesNotLooking", pub({ ...YES, visibility: "not_looking" }));
    // Saved before A1: discoverable then, no answer.
    await put("old", { name: "Old", lane: "skilled", city: "Thane", visibility: "actively_looking", experienceYears: 3 });
    await setDoc(doc(d, "jobProfilesPrivate", "yes"), { phone: "9000000000" });
  });
});
afterAll(async () => { await testEnv.clearFirestore(); await testEnv.cleanup(); });

describe("reading one profile", () => {
  it("employer accounts: only people who said yes and are looking", async () => {
    for (const uid of Object.keys(EMPLOYERS)) {
      await assertSucceeds(getDoc(doc(db(uid), "jobProfiles", "yes")));
      for (const id of ["no", "yesHidden", "yesNotLooking", "old", "nope"]) await assertFails(getDoc(doc(db(uid), "jobProfiles", id)));
    }
  });
  it("job seekers, consumers, champions, accounts with no profile and guests: nobody", async () => {
    for (const d of [...Object.keys(OTHERS).map(u => db(u)), db("csNoUserDoc"), guest()]) await assertFails(getDoc(doc(d, "jobProfiles", "yes")));
  });
  it("the owner always reads their own (also before it exists); the admin reads all", async () => {
    for (const id of ["yes", "no", "yesHidden", "old"]) {
      await assertSucceeds(getDoc(doc(db(id), "jobProfiles", id)));
      await assertSucceeds(getDoc(doc(admin(), "jobProfiles", id)));
    }
    await assertSucceeds(getDoc(doc(db("newPerson"), "jobProfiles", "newPerson")));
  });
  it("nothing an employer can read carries phone, email, pay or CV; the private part stays closed", async () => {
    const snap = await getDoc(doc(db(E), "jobProfiles", "yes"));
    for (const k of ["phone", "email", "expectedPay", "currentPay", "cv"]) expect(snap.data()).not.toHaveProperty(k);
    await assertFails(getDoc(doc(db(E), "jobProfilesPrivate", "yes")));
  });
});

describe("searching", () => {
  it("an employer gets exactly the people on search, with every filter", async () => {
    const ids = async (...more) => (await assertSucceeds(getDocs(searchQ(db(E), ...more)))).docs.map(x => x.id).sort();
    expect(await ids()).toEqual(["yes", "yesPro"]);
    expect(await ids(where("lane", "==", "skilled"))).toEqual(["yes"]);
    expect(await ids(where("trades", "array-contains", "mason"))).toEqual(["yes"]);
    expect(await ids(where("functions", "array-contains", "sales_bd"))).toEqual(["yesPro"]);
    expect(await ids(where("cityKey", "==", "pune"))).toEqual(["yesPro"]);
    expect(await ids(where("expBand", "==", "5_9"))).toEqual(["yes"]);
    expect(await ids(where("availability", "==", "within_30_days"))).toEqual(["yesPro"]);
    expect(await ids(where("lane", "==", "skilled"), where("trades", "array-contains", "mason"), where("cityKey", "==", "thane"), where("expBand", "==", "5_9"), where("availability", "==", "immediate"))).toEqual(["yes"]);
  });
  it("next page works", async () => {
    const first = await getDocs(searchQ(db(E)));
    const next = await assertSucceeds(getDocs(query(collection(db(E), "jobProfiles"), where("searchable", "==", true), orderBy("updatedAt", "desc"), startAfter(first.docs[0]), limit(20))));
    expect(next.size).toBe(1);
  });
  it("can't widen it: no filter, another filter, searchable false, more than 20, or no limit", async () => {
    const c = collection(db(E), "jobProfiles");
    for (const q of [
      query(c), query(c, limit(20)), query(c, where("visibility", "==", "actively_looking"), limit(20)), query(c, where("openToEmployers", "==", true), limit(20)),
      query(c, where("searchable", "==", false), limit(20)), query(c, where("searchable", "in", [true, false]), limit(20)),
      query(c, where("searchable", "==", true), limit(21)), query(c, where("searchable", "==", true)),
    ]) await assertFails(getDocs(q));
  });
  it("only employer accounts", async () => {
    for (const uid of Object.keys(EMPLOYERS)) await assertSucceeds(getDocs(searchQ(db(uid))));
    for (const d of [...Object.keys(OTHERS).map(u => db(u)), db("csNoUserDoc"), guest()]) await assertFails(getDocs(searchQ(d)));
  });
  it("the admin still lists everything", async () => {
    expect((await assertSucceeds(getDocs(collection(admin(), "jobProfiles")))).size).toBe(6);
  });
});

describe("the answer", () => {
  const mine = (id, data) => updateDoc(doc(db(id), "jobProfiles", id), { ...data, openToEmployersAt: serverTimestamp(), updatedAt: serverTimestamp() });
  it("yes puts an older profile on search; no takes it off", async () => {
    await assertFails(getDoc(doc(db(E), "jobProfiles", "old")));
    await assertSucceeds(mine("old", { ...YES, visibility: "actively_looking", searchable: true }));
    await assertSucceeds(getDoc(doc(db(E), "jobProfiles", "old")));
    await assertSucceeds(mine("old", { ...NO, visibility: "actively_looking", searchable: false }));
    await assertFails(getDoc(doc(db(E), "jobProfiles", "old")));
  });
  it("searchable can't be on without a yes and a looking visibility, or off while both are true", async () => {
    for (const data of [
      { searchable: true }, { ...NO, searchable: true }, { ...YES, visibility: "not_discoverable", searchable: true }, { ...YES, visibility: "not_looking", searchable: true },
      { ...YES, visibility: deleteField(), searchable: true }, { ...YES, searchable: "yes" }, { ...YES, searchable: false }, YES, { openToEmployers: "true", searchable: true }, { openToEmployers: 1, searchable: false },
    ]) await assertFails(mine("old", data));
  });
  it("hiding the profile without taking it off search is refused (an old open tab can't leave someone visible)", async () => {
    await assertFails(updateDoc(doc(db("yes"), "jobProfiles", "yes"), { visibility: "not_discoverable" }));
    await assertSucceeds(updateDoc(doc(db("yes"), "jobProfiles", "yes"), { visibility: "not_discoverable", searchable: false }));
    await assertFails(getDoc(doc(db(E), "jobProfiles", "yes")));
  });
  it("only the person themselves — not an employer, not the admin", async () => {
    for (const d of [db(E), db("csSeeker"), admin()]) await assertFails(updateDoc(doc(d, "jobProfiles", "old"), { ...YES, visibility: "actively_looking", searchable: true }));
    await assertFails(updateDoc(doc(guest(), "jobProfiles", "old"), { ...YES, searchable: true }));
  });
  it("profiles saved the old way (no new fields) still save", async () => {
    await assertSucceeds(setDoc(doc(db("old"), "jobProfiles", "old"), { name: "Old 2", visibility: "open_to_opportunities" }, { merge: true }));
    await assertSucceeds(setDoc(doc(db("fresh"), "jobProfiles", "fresh"), { name: "F", lane: "skilled", visibility: "open_to_opportunities" }, { merge: true }));
  });
  it("the wizard's save works for each answer and visibility", async () => {
    for (const a of [YES, NO, {}]) {
      for (const visibility of ["actively_looking", "open_to_opportunities", "freelance_project", "employed_open_suitable", "not_looking", "not_discoverable"]) {
        const id = `w_${JSON.stringify(a).replace(/\W/g, "")}_${visibility}`;
        await assertSucceeds(setDoc(doc(db(id), "jobProfiles", id), { ...pub({ ...a, visibility }), updatedAt: serverTimestamp() }, { merge: true }));
      }
    }
  });
});

describe("search fields", () => {
  it("bad values are refused", async () => {
    for (const data of [{ cityKey: 5 }, { cityKey: ["thane"] }, { cityKey: "x".repeat(81) }, { expBand: "99" }, { expBand: 3 }, { expBand: null }]) await assertFails(updateDoc(doc(db("old"), "jobProfiles", "old"), data));
  });
  it("admin backfill: only cityKey and expBand, on any profile", async () => {
    for (const id of ["old", "no", "yes"]) await assertSucceeds(updateDoc(doc(admin(), "jobProfiles", id), { cityKey: "thane", expBand: "2_4" }));
    for (const data of [{ name: "x" }, { cityKey: "thane", name: "x" }, { searchable: true }, { openToEmployers: true }, { visibility: "not_discoverable" }, { expBand: "bad" }]) await assertFails(updateDoc(doc(admin(), "jobProfiles", "old"), data));
    await assertFails(updateDoc(doc(admin(), "jobProfiles", "nope"), { cityKey: "thane" }));
    await assertFails(setDoc(doc(admin(), "jobProfiles", "nope"), { cityKey: "thane" }));
  });
  it("backfill doesn't put anyone on search", async () => {
    await updateDoc(doc(admin(), "jobProfiles", "old"), { cityKey: "thane", expBand: "2_4" });
    await assertFails(getDoc(doc(db(E), "jobProfiles", "old")));
  });
});
