// A2: shortlistCandidate. The function uses the Admin SDK (which bypasses the
// rules), so its own checks are what protects candidates: every refusal is
// tested here, and what each side can then read is tested THROUGH the rules.
// Emulators only, demo-tin-test project:  npm run test:functions
import { createRequire } from "module";
import process from "process";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const PROJECT = "demo-tin-test";
const BUCKET = `${PROJECT}.appspot.com`;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const req = createRequire(new URL("../../functions/index.js", import.meta.url));
const { initializeApp } = req("firebase-admin/app");
const { getFirestore, Timestamp } = req("firebase-admin/firestore");
const { getStorage } = req("firebase-admin/storage");
const app = initializeApp({ projectId: PROJECT, storageBucket: BUCKET }, "shortlist-test");
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

const AUTH = "http://127.0.0.1:9099";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const run = Date.now().toString(36);

async function signUp(name) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${name}-${run}@test.dev`, password: "test-pass-123", returnSecureToken: true }),
  });
  const j = await r.json();
  return { idToken: j.idToken, uid: j.localId };
}
async function call(who, data) {
  const r = await fetch(`http://127.0.0.1:5001/${PROJECT}/asia-south1/shortlistCandidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${who.idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const j = await r.json();
  return j.error ? { error: j.error.status, code: j.error.details?.code, message: j.error.message } : j.result;
}
// Reads as that person, through firestore.rules.
const canRead = async (who, path) => (await fetch(`${FS}/${path}`, { headers: { Authorization: `Bearer ${who.idToken}` } })).status === 200;
const get = async (path) => (await db.doc(path).get()).data();
const files = async (prefix) => (await bucket.getFiles({ prefix }))[0].map(f => f.name);

let emp, emp2, cand;
const JOB = "jobA";
const job = (extra) => ({ postedByUid: emp.uid, postedByName: "Emp", jobTitle: "Mason", businessName: "A Tiles", city: "Thane", lane: "skilled", status: "approved", jobStatus: "live", createdAt: new Date(), ...extra });
const PUB = { name: "Ramesh", lane: "skilled", trades: ["mason"], functions: [], skills: [], history: [], city: "Thane", cityKey: "thane", experienceYears: 6, expBand: "5_9", availability: "immediate", visibility: "actively_looking", openToEmployers: true, searchable: true };
const PRIV = { phone: "9876500001", email: "r@example.com", expectedPay: "₹900 / day", currentPay: "₹800 / day", showPayToEmployers: true };
const putPerson = async (uid, pub = {}, priv = {}) => {
  await db.doc(`jobProfiles/${uid}`).set({ ...PUB, ...pub });
  await db.doc(`jobProfilesPrivate/${uid}`).set({ ...PRIV, ...priv });
};
const putApp = (uid, extra) => db.doc(`jobApplications/${JOB}_${uid}`).set({ jobId: JOB, applicantUid: uid, applicantName: "X", stage: "submitted", stageHistory: [{ stage: "submitted", at: Timestamp.now(), by: "candidate", byUid: uid }], applicantStatus: "new", createdAt: new Date(), ...extra });
const go = (extra = {}, who = emp) => call(who, { jobId: JOB, candidateUid: cand.uid, ...extra });
// Nothing at all was written for this candidate and job.
async function expectUntouched({ count = 0 } = {}) {
  expect(await get(`jobApplications/${JOB}_${cand.uid}`)).toBeUndefined();
  expect(await get(`jobApplications/${JOB}_${cand.uid}/private/contact`)).toBeUndefined();
  expect((await db.collection(`jobListings/${JOB}/shortlistSlots`).get()).size).toBe(count);
  expect((await get(`jobListings/${JOB}`))?.shortlistCount || 0).toBe(count);
  expect(await get(`searchShortlistUsage/${emp.uid}`)).toBeUndefined();
  expect(await files(`resumes/${cand.uid}/${JOB}/`)).toEqual([]);
}
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

beforeAll(async () => {
  [emp, emp2, cand] = await Promise.all(["emp", "emp2", "cand"].map(signUp));
  // The emulator loads the function on its first call.
  await call(emp, {});
});
beforeEach(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await bucket.deleteFiles({ prefix: "resumes/", force: true });
  await db.doc(`jobListings/${JOB}`).set(job());
  await putPerson(cand.uid);
});

describe("who may call it", () => {
  it("refused without a login, with bad input, and for yourself", async () => {
    expect((await call(null, { jobId: JOB, candidateUid: cand.uid })).error).toBe("UNAUTHENTICATED");
    for (const bad of [{ jobId: "" }, { jobId: "a/b" }, { jobId: null }, { jobId: 5 }, { candidateUid: "" }, { candidateUid: "x/../y" }, { candidateUid: ["a"] }, { candidateUid: { a: 1 } }, { jobId: "x".repeat(200) }]) expect((await go(bad)).code).toBe("bad_input");
    expect((await call(emp, null)).code).toBe("bad_input");
    expect((await go({ candidateUid: emp.uid })).code).toBe("yourself");
    await expectUntouched();
  });
  it("only their own job; someone else's and a missing one get the same answer", async () => {
    const a = await go({}, emp2), b = await go({ jobId: "nope" });
    expect(a).toEqual({ error: "PERMISSION_DENIED", code: "not_your_job", message: "You can shortlist only for your own jobs." });
    expect(b).toEqual(a);
    await expectUntouched();
  });
  it("only a live, approved job", async () => {
    for (const extra of [{ status: "pending" }, { status: "rejected" }, { jobStatus: "paused" }, { jobStatus: "filled" }, { jobStatus: "closed" }, { jobStatus: null }, { status: null }]) {
      await db.doc(`jobListings/${JOB}`).set(job(extra));
      expect((await go()).code).toBe("job_not_live");
    }
    await expectUntouched();
  });
});

describe("who can be shortlisted", () => {
  it("hidden, not looking, said no, not asked, or no profile: the same answer, nothing written", async () => {
    for (const pub of [{ visibility: "not_discoverable" }, { visibility: "not_looking" }, { openToEmployers: false }, { openToEmployers: null }, { openToEmployers: "true" }, { visibility: null }]) {
      // `searchable` left true on purpose: the function checks for itself.
      await putPerson(cand.uid, pub);
      expect((await go()).code).toBe("not_available");
    }
    await db.doc(`jobProfiles/${cand.uid}`).delete();
    expect((await go()).code).toBe("not_available");
    await expectUntouched();
  });
  it("no phone number", async () => {
    for (const phone of ["", "12345", null]) { await putPerson(cand.uid, {}, { phone }); expect((await go()).code).toBe("no_phone"); }
    await db.doc(`jobProfilesPrivate/${cand.uid}`).delete();
    expect((await go()).code).toBe("no_phone");
    await expectUntouched();
  });
});

describe("a new person", () => {
  it("makes the application, unlocks contact, takes a slot and counts the day", async () => {
    expect(await go()).toEqual({ status: "shortlisted", applicationId: `${JOB}_${cand.uid}`, created: true, used: 1, limit: 10, leftToday: 19 });
    const a = await get(`jobApplications/${JOB}_${cand.uid}`);
    expect(a).toMatchObject({
      jobId: JOB, applicantUid: cand.uid, applicantName: "Ramesh", source: "employer_search", stage: "shortlisted", shortlistSlot: 1, hasCv: false, message: "",
      jobSnapshot: { title: "Mason", businessName: "A Tiles", city: "Thane" },
    });
    expect(a.stageHistory).toHaveLength(1);
    expect(a.stageHistory[0]).toMatchObject({ stage: "shortlisted", by: "employer", byUid: emp.uid });
    expect(a.stageHistory[0].at.toMillis()).toBeGreaterThan(Date.now() - 60000);
    expect(a.contactUnlockedAt.toMillis()).toBeGreaterThan(Date.now() - 60000);
    expect(a.profileSnapshot).toMatchObject({ lane: "skilled", trades: ["mason"], city: "Thane", experienceYears: 6 });
    expect(await get(`jobApplications/${JOB}_${cand.uid}/private/contact`)).toMatchObject({ applicantPhone: "9876500001", applicantEmail: "r@example.com" });
    expect(await get(`jobListings/${JOB}/shortlistSlots/1`)).toMatchObject({ appId: `${JOB}_${cand.uid}` });
    expect((await get(`jobListings/${JOB}`)).shortlistCount).toBe(1);
    expect(await get(`searchShortlistUsage/${emp.uid}`)).toMatchObject({ day: today(), count: 1 });
  });
  it("the part employers read before opening contact has no phone, email, CV path or pay (even with 'Show my pay' on)", async () => {
    await go();
    const a = await get(`jobApplications/${JOB}_${cand.uid}`);
    expect(a.payVisible).toBe(false);
    const text = JSON.stringify(a);
    for (const x of ["9876500001", "r@example.com", "₹900", "₹800", "resumes/", "openToEmployers"]) expect(text).not.toContain(x);
  });
  it("through the rules: this employer and the candidate read the contact; another employer and outsiders don't", async () => {
    const path = `jobApplications/${JOB}_${cand.uid}`;
    expect(await canRead(emp, `jobProfilesPrivate/${cand.uid}`)).toBe(false);
    await go();
    for (const p of [path, `${path}/private/contact`]) {
      expect(await canRead(emp, p)).toBe(true);
      expect(await canRead(cand, p)).toBe(true);
      expect(await canRead(emp2, p)).toBe(false);
    }
    expect(await canRead(emp, `jobProfilesPrivate/${cand.uid}`)).toBe(false);
    expect(await canRead(emp, `searchShortlistUsage/${emp.uid}`)).toBe(true);
    expect(await canRead(emp2, `searchShortlistUsage/${emp.uid}`)).toBe(false);
  });
  it("twice: opens the same application, no second slot, not counted again", async () => {
    await go();
    expect(await go()).toEqual({ status: "already", applicationId: `${JOB}_${cand.uid}` });
    expect((await get(`jobListings/${JOB}`)).shortlistCount).toBe(1);
    expect((await get(`searchShortlistUsage/${emp.uid}`)).count).toBe(1);
  });
  it("still opens it when the job is full and the person has since turned employer search off", async () => {
    await go();
    await db.doc(`jobListings/${JOB}`).update({ shortlistCount: 10 });
    await putPerson(cand.uid, { openToEmployers: false, searchable: false });
    expect((await go()).status).toBe("already");
  });
});

describe("CV", () => {
  const cvPath = () => `resumes/${cand.uid}/profile/1_cv.pdf`;
  const save = (p, text = "%PDF mine") => bucket.file(p).save(text, { contentType: "application/pdf", resumable: false });
  it("is copied into this job's folder, and only there", async () => {
    await save(cvPath());
    await putPerson(cand.uid, {}, { cv: { path: cvPath(), fileName: "My CV (1).pdf" } });
    await go();
    expect((await get(`jobApplications/${JOB}_${cand.uid}`)).hasCv).toBe(true);
    const c = await get(`jobApplications/${JOB}_${cand.uid}/private/contact`);
    expect(c.resumeFileName).toBe("My CV (1).pdf");
    expect(c.resumePath).toMatch(new RegExp(`^resumes/${cand.uid}/${JOB}/\\d+_My CV _1_.pdf$`));
    expect((await bucket.file(c.resumePath).download())[0].toString()).toBe("%PDF mine");
    expect((await bucket.file(c.resumePath).getMetadata())[0].contentType).toBe("application/pdf");
    expect(await files("resumes/")).toEqual([c.resumePath, cvPath()].sort());
  });
  it("a path to someone else's file (or outside resumes/) is never copied", async () => {
    await save("resumes/victim/profile/1_cv.pdf", "%PDF victim");
    await save("resumes/victim/jobX/1_cv.pdf", "%PDF victim");
    for (const path of ["resumes/victim/profile/1_cv.pdf", "resumes/victim/jobX/1_cv.pdf", `resumes/${cand.uid}/../victim/profile/1_cv.pdf`, `resumes/${cand.uid}/jobX/1_cv.pdf`, "hom/orders/1/a.pdf", "", null, 5, { a: 1 }]) {
      await db.doc(`jobApplications/${JOB}_${cand.uid}`).delete();
      await putPerson(cand.uid, {}, { cv: { path, fileName: "cv.pdf" } });
      const r = await go();
      expect([r.status, (await get(`jobApplications/${JOB}_${cand.uid}`)).hasCv]).toEqual(["shortlisted", false]);
      expect(await get(`jobApplications/${JOB}_${cand.uid}/private/contact`)).not.toHaveProperty("resumePath");
      await db.doc(`jobApplications/${JOB}_${cand.uid}/private/contact`).delete();
    }
    expect(await files(`resumes/${cand.uid}/`)).toEqual([]);
  });
  it("a saved CV whose file is gone: shortlisted without a CV", async () => {
    await putPerson(cand.uid, {}, { cv: { path: cvPath(), fileName: "cv.pdf" } });
    expect((await go()).status).toBe("shortlisted");
    expect((await get(`jobApplications/${JOB}_${cand.uid}`)).hasCv).toBe(false);
  });
  it("a refused shortlist leaves no copy behind", async () => {
    await save(cvPath());
    await putPerson(cand.uid, { openToEmployers: false }, { cv: { path: cvPath(), fileName: "cv.pdf" } });
    await go();
    expect(await files(`resumes/${cand.uid}/${JOB}/`)).toEqual([]);
  });
});

describe("someone who already applied", () => {
  it.each(["submitted", "app_viewed", "profile_viewed", "review"])("at %s: the normal shortlist — a slot, but no daily count and no employer-search consent needed", async (stage) => {
    await putApp(cand.uid, { stage });
    await putPerson(cand.uid, { openToEmployers: false, searchable: false });
    expect(await go()).toEqual({ status: "shortlisted", applicationId: `${JOB}_${cand.uid}`, created: false, used: 1, limit: 10 });
    const a = await get(`jobApplications/${JOB}_${cand.uid}`);
    expect([a.stage, a.shortlistSlot, a.stageHistory.length, !!a.contactUnlockedAt, a.source]).toEqual(["shortlisted", 1, 2, true, undefined]);
    expect(await get(`searchShortlistUsage/${emp.uid}`)).toBeUndefined();
  });
  it("an application from before stages existed", async () => {
    await db.doc(`jobApplications/${JOB}_${cand.uid}`).set({ jobId: JOB, applicantUid: cand.uid, applicantStatus: "new" });
    expect((await go()).status).toBe("shortlisted");
    expect((await get(`jobApplications/${JOB}_${cand.uid}`)).stage).toBe("shortlisted");
  });
  it.each(["not_shortlisted", "offer_declined", "not_selected", "withdrawn", "closed", "offer_accepted"])("at %s: refused, nothing changes", async (stage) => {
    await putApp(cand.uid, { stage, contactUnlockedAt: Timestamp.now() });
    expect((await go()).code).toBe("closed");
    expect((await get(`jobApplications/${JOB}_${cand.uid}`)).stage).toBe(stage);
    expect((await get(`jobListings/${JOB}`)).shortlistCount).toBeUndefined();
  });
  it.each(["shortlisted", "contacted", "int_invited", "int_done", "selected", "offer_sent"])("already unlocked at %s: opened, no slot", async (stage) => {
    await putApp(cand.uid, { stage, contactUnlockedAt: Timestamp.now(), shortlistSlot: 1 });
    expect((await go()).status).toBe("already");
    expect((await get(`jobApplications/${JOB}_${cand.uid}`)).stage).toBe(stage);
  });
});

describe("10 per job", () => {
  it("the 10th works, the 11th is refused with the usual message", async () => {
    await db.doc(`jobListings/${JOB}`).update({ shortlistCount: 9 });
    expect((await go()).used).toBe(10);
    await putPerson("p11");
    const r = await go({ candidateUid: "p11" });
    expect(r).toEqual({ error: "RESOURCE_EXHAUSTED", code: "shortlist_full", message: "You've used all 10 shortlists for this job. Post another job to shortlist more." });
    expect(await get(`jobApplications/${JOB}_p11`)).toBeUndefined();
    // an applicant can't get past the limit this way either
    await putApp("p12");
    expect((await go({ candidateUid: "p12" })).code).toBe("shortlist_full");
    expect((await get(`jobApplications/${JOB}_p12`)).stage).toBe("submitted");
  });
  it("the admin's own limit is used", async () => {
    await db.doc("config/pricing").set({ shortlistLimit: 2 });
    for (const p of ["a1", "a2", "a3"]) await putPerson(p);
    expect((await go({ candidateUid: "a1" })).used).toBe(1);
    expect((await go({ candidateUid: "a2" })).limit).toBe(2);
    expect((await go({ candidateUid: "a3" })).code).toBe("shortlist_full");
  });
  it("many at once can't take more than is left, or the same slot twice", async () => {
    await db.doc(`jobListings/${JOB}`).update({ shortlistCount: 7 });
    const people = Array.from({ length: 8 }, (_, i) => `m${i}`);
    for (const p of people) await putPerson(p);
    const rs = await Promise.all(people.map(p => go({ candidateUid: p })));
    const won = rs.filter(r => r.status === "shortlisted");
    expect(won.length).toBeGreaterThan(0);
    expect(won.length).toBeLessThanOrEqual(3);
    for (const r of rs.filter(x => x.error)) expect(["shortlist_full", "try_again"]).toContain(r.code);
    expect((await get(`jobListings/${JOB}`)).shortlistCount).toBe(7 + won.length);
    expect((await db.collection(`jobListings/${JOB}/shortlistSlots`).get()).size).toBe(won.length);
    expect((await db.collection("jobApplications").get()).size).toBe(won.length);
    expect((await get(`searchShortlistUsage/${emp.uid}`)).count).toBe(won.length);
  });
  it("the same person tapped twice at once: one application, one slot", async () => {
    const rs = await Promise.all([go(), go(), go()]);
    expect(rs.filter(r => r.status === "shortlisted")).toHaveLength(1);
    expect((await get(`jobListings/${JOB}`)).shortlistCount).toBe(1);
    expect((await db.collection(`jobListings/${JOB}/shortlistSlots`).get()).size).toBe(1);
  });
});

describe("20 a day", () => {
  it("the 20th works, the 21st is refused — on any of their jobs", async () => {
    await db.doc("jobListings/jobB").set(job());
    await db.doc(`searchShortlistUsage/${emp.uid}`).set({ day: today(), count: 19 });
    expect((await go()).leftToday).toBe(0);
    await putPerson("d21");
    const r = await go({ jobId: "jobB", candidateUid: "d21" });
    expect(r).toEqual({ error: "RESOURCE_EXHAUSTED", code: "daily_limit", message: "You've reached today's limit of 20 shortlists from search. Please try again tomorrow." });
    expect(await get("jobApplications/jobB_d21")).toBeUndefined();
    expect((await get("jobListings/jobB")).shortlistCount).toBeUndefined();
  });
  it("applicants don't count towards it, and opening someone again still works", async () => {
    await go();
    await db.doc(`searchShortlistUsage/${emp.uid}`).set({ day: today(), count: 20 });
    expect((await go()).status).toBe("already");
    await putApp("dApp");
    expect((await go({ candidateUid: "dApp" })).status).toBe("shortlisted");
  });
  it("a new day starts again; each employer has their own count", async () => {
    await db.doc(`searchShortlistUsage/${emp.uid}`).set({ day: "2020-01-01", count: 20 });
    expect((await go()).leftToday).toBe(19);
    expect(await get(`searchShortlistUsage/${emp.uid}`)).toMatchObject({ day: today(), count: 1 });
    await db.doc(`searchShortlistUsage/${emp.uid}`).set({ day: today(), count: 20 });
    await db.doc("jobListings/jobE2").set(job({ postedByUid: emp2.uid }));
    expect((await go({ jobId: "jobE2" }, emp2)).leftToday).toBe(19);
  });
  it("the admin's number is used; 0 switches it off", async () => {
    await db.doc("config/pricing").set({ shortlistLimit: 10, searchShortlistDailyLimit: 1 });
    await putPerson("e2");
    expect((await go()).leftToday).toBe(0);
    expect((await go({ candidateUid: "e2" })).code).toBe("daily_limit");
    await db.doc("config/pricing").set({ shortlistLimit: 10, searchShortlistDailyLimit: 0 });
    await db.doc(`searchShortlistUsage/${emp.uid}`).delete();
    expect((await go({ candidateUid: "e2" })).message).toBe("Shortlisting from search is switched off for now.");
  });
  it("many at once can't pass it", async () => {
    await db.doc(`searchShortlistUsage/${emp.uid}`).set({ day: today(), count: 18 });
    const people = Array.from({ length: 6 }, (_, i) => `q${i}`);
    for (const p of people) await putPerson(p);
    const rs = await Promise.all(people.map(p => go({ candidateUid: p })));
    const won = rs.filter(r => r.status === "shortlisted").length;
    expect(won).toBeLessThanOrEqual(2);
    expect((await get(`searchShortlistUsage/${emp.uid}`)).count).toBe(18 + won);
  });
});
