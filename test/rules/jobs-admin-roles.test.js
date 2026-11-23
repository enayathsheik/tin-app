// Owner decision (23 Nov 2026): "Admin" of TIN Jobs Admin means ONLY the TIN
// super admin account. Not hom_admin, not a business owner / admin, not staff,
// not a users.role of "admin" or any delegated role added later. Proves both
// halves: the server refuses every read the dashboard makes, and the app
// doesn't offer or open the page.
// Run against the Firestore + Storage emulators only — never production:
//   npm run test:rules
import { readFileSync } from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, getDownloadURL, ref, uploadBytes } from "firebase/storage";

// The app's own gate reads auth.currentUser; give it a fake signed-in account.
const fake = vi.hoisted(() => ({ auth: { currentUser: null } }));
vi.mock("../../src/firebase/config.js", () => ({
  auth: fake.auth, db: {}, storage: {}, functions: {},
  updateUserStats: () => {}, saveUserProfile: () => {}, getUserProfile: () => {},
}));
const { AdminDashboard } = await import("../../src/pages/AdminDashboard.jsx");
const { TinJobsAdmin } = await import("../../src/components/admin/jobsAdmin/TinJobsAdmin.jsx");

const PROJECT_ID = "trade-intelligence-netwo-97997"; // see cv-per-job-storage.test.js
const SUPER = { uid: "jrSuper", email: "enayathsheik@gmail.com" };
const C1 = "jrC1", EMP = "jrEmp", JOB = "jrJob", APP = `${JOB}_${C1}`, ORG = "jrOrg";
const CVS = [`resumes/${C1}/${JOB}/1_cv.pdf`, `resumes/${C1}/profile/1_cv.pdf`, `resumes/${C1}/1_old.pdf`];
const COLLECTIONS = ["users", "jobProfiles", "jobProfilesPrivate", "jobListings", "jobApplications"];
// Every other kind of "admin" there is, with its users/{uid} record.
const OTHERS = [
  ["hom_admin", { uid: "jrHom", email: "hom@tinit.in" }, { role: "hom_admin" }],
  ["business owner", { uid: "jrOwner", email: "owner@shop.in" }, { role: "retailer", verificationStatus: "verified", storeId: "jrStore" }],
  ["business admin", { uid: "jrBizAdmin", email: "bizadmin@shop.in" }, { role: "retailer", storeId: "jrStore" }],
  ["business staff (manager)", { uid: "jrStaff", email: "staff@shop.in" }, { role: "contributor" }],
  ["an account whose role says admin", { uid: "jrRole", email: "role@x.com" }, { role: "admin" }],
  ["a future delegated admin role", { uid: "jrFuture", email: "jobsadmin@tinit.in" }, { role: "jobs_admin", admin: true, isAdmin: true }],
];
let testEnv;
// Custom claims too, so a future "admin" claim on its own opens nothing.
const as = (who) => testEnv.authenticatedContext(who.uid, {
  email: who.email, email_verified: true, ...(who.email === SUPER.email ? {} : { admin: true, role: "admin" }),
});
const db = (who) => as(who).firestore();
const renderAdminPanel = (user) => renderToStaticMarkup(
  createElement(MemoryRouter, null, createElement(AdminDashboard, { stores: [], contributors: [], user })),
);
const renderDashboard = () => renderToStaticMarkup(createElement(TinJobsAdmin));
const REFUSED = "Only the TIN super admin can open this page";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore(), s = c.storage();
    for (const [, who, data] of OTHERS) await setDoc(doc(d, "users", who.uid), { name: who.uid, ...data });
    await setDoc(doc(d, "organizations", ORG), { createdBy: "jrOwner", name: "Shop" });
    for (const [uid, role] of [["jrOwner", "owner"], ["jrBizAdmin", "admin"], ["jrStaff", "manager"]]) {
      await setDoc(doc(d, "memberships", `${ORG}_${uid}`), { orgId: ORG, uid, role, status: "active" });
    }
    await setDoc(doc(d, "stores", "jrStore"), { storeName: "Shop", claimedByUid: "jrOwner", contributorId: "jrOwner" });
    await setDoc(doc(d, "users", C1), { name: C1, phone: "9000000000" });
    await setDoc(doc(d, "users", EMP), { name: EMP, phone: "9111111111", role: "retailer" });
    await setDoc(doc(d, "jobProfiles", C1), { name: C1, visibility: "not_discoverable" });
    await setDoc(doc(d, "jobProfilesPrivate", C1), { phone: "9000000000", email: "c@x.com", expectedPay: "₹900" });
    await setDoc(doc(d, "jobListings", JOB), { postedByUid: EMP, storeId: "jrStore", status: "approved", jobStatus: "live", createdAt: new Date() });
    // Already shortlisted: unlocked for the poster only, not for other "admins".
    await setDoc(doc(d, "jobApplications", APP), { jobId: JOB, applicantUid: C1, stage: "shortlisted", contactUnlockedAt: new Date(), stageHistory: [] });
    await setDoc(doc(d, "jobApplications", APP, "private", "contact"), { applicantPhone: "9000000000", resumePath: CVS[0] });
    for (const p of CVS) await uploadBytes(ref(s, p), new Uint8Array(64).fill(7), { contentType: "application/pdf" });
  });
});

afterAll(async () => {
  await testEnv.clearFirestore();
  await testEnv.cleanup();
});

describe.each(OTHERS)("%s", (_label, who, userDoc) => {
  it("can't read job seekers' or employers' phone, email or pay", async () => {
    const d = db(who);
    for (const name of COLLECTIONS) await assertFails(getDocs(collection(d, name)));
    for (const path of [["users", C1], ["users", EMP], ["jobProfiles", C1], ["jobProfilesPrivate", C1], ["jobApplications", APP], ["jobApplications", APP, "private", "contact"]]) {
      await assertFails(getDoc(doc(d, ...path)));
    }
  });

  it("can't open or get a link to any resume", async () => {
    for (const p of CVS) {
      await assertFails(getBytes(ref(as(who).storage(), p)));
      await assertFails(getDownloadURL(ref(as(who).storage(), p)));
    }
  });

  it("the app doesn't offer or open TIN Jobs Admin, even if the profile claims the super admin's email", () => {
    fake.auth.currentUser = { uid: who.uid, email: who.email };
    expect(renderAdminPanel({ uid: who.uid, ...userDoc, role: "admin", email: SUPER.email })).not.toContain("TIN Jobs Admin");
    expect(renderDashboard()).toContain(REFUSED);
  });

  it("writing an admin role on their own account changes nothing", async () => {
    await updateDoc(doc(db(who), "users", who.uid), { role: "admin", email: SUPER.email }).catch(() => {});
    await assertFails(getDocs(collection(db(who), "users")));
    await assertFails(getDoc(doc(db(who), "jobProfilesPrivate", C1)));
    await assertFails(getDownloadURL(ref(as(who).storage(), CVS[1])));
  });
});

describe("the TIN super admin (positive control)", () => {
  beforeEach(() => { fake.auth.currentUser = { uid: SUPER.uid, email: SUPER.email }; });

  it("reads all of it", async () => {
    for (const name of COLLECTIONS) await assertSucceeds(getDocs(collection(db(SUPER), name)));
    await assertSucceeds(getDoc(doc(db(SUPER), "jobApplications", APP, "private", "contact")));
    for (const p of CVS) await assertSucceeds(getDownloadURL(ref(as(SUPER).storage(), p)));
  });

  it("is offered TIN Jobs Admin, and it opens", () => {
    expect(renderAdminPanel({ role: "admin" })).toContain("TIN Jobs Admin");
    expect(renderDashboard()).not.toContain(REFUSED);
  });

  it("signed out: doesn't open", () => {
    fake.auth.currentUser = null;
    expect(renderDashboard()).toContain(REFUSED);
  });
});
