// B1 sign-up: src/utils/signup.js, the business types and product categories it
// offers, and what each new account type sees.
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_TREE } from "../../src/data/constants.js";
import { INDUSTRIES, isKey, labelOf } from "../../src/data/jobsTaxonomy.js";
import { FEATURES } from "../../src/data/features.js";
import { emptyDraft } from "../../src/utils/jobDraft.js";
import { emptyProfile } from "../../src/utils/jobProfile.js";
import { isEmployerAccount, isEmployerByAccount, isSeekerByAccount } from "../../src/utils/jobRoles.js";
import { SIGNUP_ROLE, emptySignup, signupError, signupIdentity, signupLanding, signupNext, signupProfile, validateSignup } from "../../src/utils/signup.js";

const CATS = Object.keys(CATEGORY_TREE);
const work = (x) => ({ ...emptySignup("work"), name: " Ramesh  Kumar ", mobile: "98765 00001", password: "secret1", ...x });
const hire = (x) => ({ ...work(), ...emptySignup("hire"), name: "Asha", mobile: "+91 98765 00002", password: "secret1", businessName: "A Tiles", industry: "wholesalers", city: "Thane", dealsIn: ["Flooring", "Made up", "Plumbing"], ...x });

describe("lists", () => {
  it("13 business types, with Wholesalers and Designers of their own", () => {
    expect(INDUSTRIES).toHaveLength(13);
    expect([labelOf(INDUSTRIES, "wholesalers"), labelOf(INDUSTRIES, "designers")]).toEqual(["Wholesalers", "Designers"]);
    expect(new Set(INDUSTRIES.map(x => x.key)).size).toBe(13);
    expect(INDUSTRIES[12].key).toBe("other");
  });
  it("TIN's 22 product categories", () => expect(CATS).toHaveLength(22));
});

describe("validateSignup", () => {
  it("accepts a mobile number, or any email (no work email)", () => {
    expect(validateSignup("work", work())).toEqual({});
    expect(validateSignup("hire", hire())).toEqual({});
    for (const email of ["a@gmail.com", "x.y@yahoo.co.in", " A@B.IN "]) {
      expect(validateSignup("work", work({ method: "email", email }))).toEqual({});
      expect(validateSignup("hire", hire({ method: "email", email }))).toEqual({});
    }
  });
  it("asks for what's missing", () => {
    expect(Object.keys(validateSignup("work", emptySignup("work"))).sort()).toEqual(["mobile", "name", "password"]);
    expect(Object.keys(validateSignup("hire", emptySignup("hire"))).sort()).toEqual(["businessName", "city", "industry", "mobile", "name", "password"]);
    for (const mobile of ["12345", "1234567890", "987650000", "abc"]) expect(validateSignup("work", work({ mobile })).mobile).toBeTruthy();
    for (const email of ["", "a", "a@b", "a b@c.in", "9876500001@phone.tinit.in"]) expect(validateSignup("work", work({ method: "email", email })).email).toBeTruthy();
    for (const industry of ["", "retailer", "Wholesalers"]) expect(validateSignup("hire", hire({ industry })).industry).toBeTruthy();
    expect(validateSignup("work", work({ password: "12345" })).password).toBeTruthy();
    expect(validateSignup("work", work({ password: "      " })).password).toBeTruthy();
  });
  it("products are optional; only the chosen method is checked", () => {
    expect(validateSignup("hire", hire({ dealsIn: [] }))).toEqual({});
    expect(validateSignup("work", work({ method: "email", email: "a@b.in", mobile: "bad" }))).toEqual({});
  });
});

describe("the account it makes", () => {
  it("job seeker", () => {
    const u = signupProfile("work", work(), "u1", CATS, new Date("2026-11-25T00:00:00Z"));
    expect(u).toMatchObject({ uid: "u1", name: "Ramesh Kumar", role: "jobseeker", phone: "9876500001", email: "9876500001@phone.tinit.in", validationStatus: "n/a", createdAt: "2026-11-25T00:00:00.000Z" });
    for (const k of ["jobBusiness", "dealsIn", "storeId", "verificationStatus", "referralCode"]) expect(u).not.toHaveProperty(k);
    // the profile wizard then starts with name and phone, and no made-up email
    expect(emptyProfile(u)).toMatchObject({ name: "Ramesh Kumar", phone: "9876500001", email: "" });
  });
  it("employer: business details ready for Post a Job; only real product categories kept", () => {
    const u = signupProfile("hire", hire(), "u2", CATS);
    expect(u).toMatchObject({ role: "employer", phone: "9876500002", company: "A Tiles", city: "Thane", jobBusiness: { name: "A Tiles", industry: "wholesalers", city: "Thane" }, dealsIn: ["Flooring", "Plumbing"] });
    for (const k of ["storeId", "verificationStatus"]) expect(u).not.toHaveProperty(k);
    expect(emptyDraft(u).business).toEqual({ name: "A Tiles", industry: "wholesalers", city: "Thane" });
    expect(isKey(INDUSTRIES, u.jobBusiness.industry)).toBe(true);
  });
  it("email sign-up keeps no phone, and the email in lower case", () => {
    expect(signupIdentity(work({ method: "email", email: " Me@Gmail.com " }))).toEqual({ authEmail: "me@gmail.com", phone: null });
  });
  it("only ordinary roles, both allowed by the rules", () => {
    const rules = readFileSync("firestore.rules", "utf8");
    expect(Object.values(SIGNUP_ROLE)).toEqual(["jobseeker", "employer"]);
    expect(rules).toContain('"manufacturer", "jobseeker", "employer"];');
  });
});

describe("after sign-up", () => {
  it("employers land on the Desk, job seekers on their profile", () => {
    expect([signupLanding("employer"), signupLanding("jobseeker"), signupLanding("consumer")]).toEqual(["/jobs/desk", "/jobs/profile", "/jobs/profile"]);
  });
  it("goes back to where they were headed, if it's meant for them", () => {
    for (const p of ["/jobs/abc", "/jobs", "/store/s1"]) for (const r of ["employer", "jobseeker"]) expect(signupNext(r, p)).toBe(p);
    expect([signupNext("employer", "/jobs/post"), signupNext("jobseeker", "/jobs/applications")]).toEqual(["/jobs/post", "/jobs/applications"]);
    for (const p of ["/jobs/profile", "/jobs/saved", "/jobs/applications"]) expect(signupNext("employer", p)).toBe("/jobs/desk");
    for (const p of ["/jobs/desk?find=1", "/jobs/post"]) expect(signupNext("jobseeker", p)).toBe("/jobs/profile");
    for (const p of [null, "", "/", "//evil.com", "https://evil.com", "/signup/hire", 5]) expect(signupNext("employer", p)).toBe("/jobs/desk");
  });
  it("each type is known without a read", () => {
    expect([isEmployerByAccount({ role: "employer" }), isEmployerAccount({ role: "employer" }), isSeekerByAccount({ role: "employer" })]).toEqual([true, true, false]);
    expect([isEmployerByAccount({ role: "jobseeker" }), isEmployerAccount({ role: "jobseeker" }), isSeekerByAccount({ role: "jobseeker" })]).toEqual([false, false, true]);
    for (const role of ["consumer", "contributor", "contractor"]) expect([isEmployerByAccount({ role }), isSeekerByAccount({ role })]).toEqual([false, false]);
  });
  it("plain messages; never Firebase's own text", () => {
    expect(signupError("auth/email-already-in-use", "mobile")).toEqual({ exists: true, text: "This mobile number already has a TIN account. Please log in." });
    expect(signupError("auth/email-already-in-use", "email").text).toMatch(/^This email/);
    for (const c of ["auth/weak-password", "auth/network-request-failed", "permission-denied", undefined]) expect(signupError(c, "email").text).not.toMatch(/firebase|auth\//i);
  });
  it("the old register form (Consumer, Market Champion) is off, not deleted", () => {
    expect(FEATURES.oldSignup).toBe(false);
    expect(readFileSync("src/pages/LoginPage.jsx", "utf8")).toContain("FEATURES.oldSignup");
  });
});
