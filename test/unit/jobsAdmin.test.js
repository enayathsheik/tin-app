// Admin → TIN Jobs Admin: rows, counts, filters and export shapes.
import { describe, expect, it } from "vitest";
import {
  EMPLOYER_FILTER, EMPTY_FILTERS, JOB_FILTER, SEEKER_FILTER,
  applicantRow, buildEmployers, buildJobs, buildSeekers, contactsNeeded, distinct, employerExport, filterRows,
  jobExport, jobState, matchesSearch, realEmail, resumeSource, seekerExport, summarise, toDate,
} from "../../src/utils/jobsAdmin.js";

const ts = (iso) => ({ toDate: () => new Date(iso), seconds: new Date(iso).getTime() / 1000 });
const users = [
  { id: "c1", name: "Account Name", phone: "9111111111", email: "9111111111@phone.tinit.in", createdAt: "2026-11-23T04:00:00" },
  { id: "c2", name: "Applied Only", email: "c2@x.com", createdAt: "2026-11-10T04:00:00" },
  { id: "e1", name: "Owner One", role: "retailer", email: "e1@x.com", phone: null, storeId: "s1", verificationStatus: "verified", createdAt: "2026-11-01T04:00:00" },
  { id: "e2", name: "Poster", role: "consumer", email: "e2@x.com", jobBusiness: { name: "Two Tiles", city: "Pune" }, createdAt: "bad date" },
  { id: "e3", name: "Quiet Retailer", role: "retailer", storeName: "Quiet", city: "Surat", createdAt: "2026-11-24T04:00:00" },
  { id: "x", name: "Nobody", role: "consumer", createdAt: "2026-10-01T04:00:00" },
];
const profiles = [{ id: "c1", name: "Prakash", city: "Thane", trades: ["mason"], experienceYears: 0, skills: ["Tiling"], visibility: "not_discoverable", createdAt: ts("2026-11-22T10:00:00") }];
const privates = [{ id: "c1", phone: "9769031000", email: "p@x.com", expectedPay: "₹950", showPayToEmployers: false, cv: { path: "resumes/c1/profile/1_cv.pdf", fileName: "cv.pdf" } }];
const jobs = [
  { id: "j1", jobTitle: "Masons", businessName: "One Co", postedByUid: "e1", city: "Thane", status: "approved", jobStatus: "live", lane: "skilled", trade: "mason", contactPhone: "9222222222", shortlistCount: 1, createdAt: ts("2026-11-20T10:00:00") },
  { id: "j2", jobTitle: "Sales", businessName: "Two Tiles", postedByUid: "e2", city: "Pune", status: "pending", createdAt: ts("2026-11-21T10:00:00") },
  { id: "j3", jobTitle: "Old", postedByUid: "e1", status: "approved", jobStatus: "filled" },
];
const applications = [
  { id: "j1_c1", jobId: "j1", applicantUid: "c1", applicantName: "Prakash", stage: "shortlisted", hasCv: true, createdAt: ts("2026-11-22T10:00:00") },
  { id: "j1_c2", jobId: "j1", applicantUid: "c2", applicantName: "Applied", stage: "not_selected", contactUnlockedAt: ts("2026-11-22T10:00:00"), hasCv: true, profileSnapshot: { city: "Vashi", role: "Helper" }, createdAt: ts("2026-11-21T10:00:00") },
  { id: "j3_c1", jobId: "j3", applicantUid: "c1", stage: "submitted", createdAt: ts("2026-11-19T10:00:00") },
];
const contacts = { j1_c2: { applicantPhone: "9333333333", applicantEmail: "c2@real.com", resumePath: "resumes/c2/j1/1_cv.pdf", resumeFileName: "c2.pdf" } };
const jobRows = buildJobs({ jobs, applications, users, limit: 10 });
const seekers = buildSeekers({ profiles, privates, users, applications, contacts });
const employers = buildEmployers({ users, jobRows, stores: { s1: { id: "s1", storeName: "One Store", city: "Mumbai" } } });
const by = (rows, k, v) => rows.find(r => r[k] === v);

describe("job seekers", () => {
  it("everyone with a profile or an application, and nobody else", () => {
    expect(seekers.map(x => x.uid).sort()).toEqual(["c1", "c2"]);
  });

  it("shows contact, hidden pay, resume and counts from the profile", () => {
    expect(by(seekers, "uid", "c1")).toMatchObject({
      name: "Prakash", phone: "9769031000", email: "p@x.com", city: "Thane", experienceYears: "0",
      expectedPay: "₹950", payHidden: true, applied: 2, shortlisted: 1, hasProfile: true,
      resume: { path: "resumes/c1/profile/1_cv.pdf", fileName: "cv.pdf" },
    });
  });

  it("falls back to the application's contact and CV for people without a profile", () => {
    expect(by(seekers, "uid", "c2")).toMatchObject({
      phone: "9333333333", email: "c2@real.com", city: "Vashi", roleText: "Helper", hasProfile: false,
      applied: 1, shortlisted: 1, resume: { path: "resumes/c2/j1/1_cv.pdf" },
    });
    expect(contactsNeeded({ privates, applications })).toEqual(["j1_c2"]);
  });

  it("survives a profile doc with missing or odd fields", () => {
    const rows = buildSeekers({ profiles: [{ id: "z", skills: "x", trades: null, experienceYears: {} }], privates: [{ id: "z", cv: "bad" }], users: [], applications: [] });
    expect(rows[0]).toMatchObject({ name: "(no name)", phone: "", email: "", skills: [], experienceYears: "", resume: null, created: null });
  });
});

describe("employers", () => {
  it("posters and business accounts, not plain accounts", () => {
    expect(employers.map(e => e.uid).sort()).toEqual(["e1", "e2", "e3"]);
  });
  it("business, contact, verification, jobs and shortlists used", () => {
    expect(by(employers, "uid", "e1")).toMatchObject({ business: "One Store", contact: "Owner One", phone: "9222222222", email: "e1@x.com", city: "Mumbai", verified: "Verified", jobs: 2, openJobs: 1, slots: 1, slotsTotal: 20 });
    expect(by(employers, "uid", "e2")).toMatchObject({ business: "Two Tiles", city: "Pune", verified: "Not verified", jobs: 1 });
    expect(by(employers, "uid", "e3")).toMatchObject({ business: "Quiet", jobs: 0, type: "Retailer" });
  });
});

describe("jobs", () => {
  it("one state per job", () => {
    expect(jobRows.map(j => [j.id, j.state])).toEqual([["j2", "pending"], ["j1", "open"], ["j3", "filled"]]);
    expect(jobState({ status: "approved" })).toBe("open"); // before jobStatus existed
    expect(jobState({ status: "rejected" })).toBe("rejected");
    expect(jobState({ status: "approved", jobStatus: "paused" })).toBe("paused");
    expect(jobState({})).toBe("pending");
  });
  it("applicants, slots used and everyone shortlisted", () => {
    expect(by(jobRows, "id", "j1")).toMatchObject({ applicants: 2, slots: 1, limit: 10, shortlisted: 2, full: false });
  });
});

describe("summary", () => {
  const sum = summarise({ users, seekers, employers, jobRows, applications }, new Date("2026-11-24T12:00:00")); // a Tuesday
  it("counts everything; the job states add up to all jobs", () => {
    expect(sum).toMatchObject({ seekers: 2, seekersWithProfile: 1, employers: 3, employersPosting: 2, accounts: 6, jobs: 3, applications: 3, shortlists: 2 });
    expect(Object.values(sum.jobsByState).reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("sign-ups today and since Monday; accounts with a bad date are not counted", () => {
    expect([sum.signupsToday, sum.signupsWeek]).toEqual([1, 2]);
  });
});

describe("resumes", () => {
  it("only the candidate's own folder, or a Firebase Storage link", () => {
    expect(resumeSource("c1", { path: "resumes/c1/j/x.pdf" })).toMatchObject({ path: "resumes/c1/j/x.pdf" });
    expect(resumeSource("c1", { path: "resumes/c2/j/x.pdf" })).toBeNull();
    expect(resumeSource("c1", { path: "resumes/c1/../c2/x.pdf" })).toBeNull();
    expect(resumeSource("c1", { url: "https://firebasestorage.googleapis.com/v0/b/x" })).toMatchObject({ url: expect.any(String) });
    for (const url of ["javascript:alert(1)", "http://firebasestorage.googleapis.com/x", "https://evil.com/firebasestorage.googleapis.com/", "https://firebasestorage.googleapis.com.evil.com/", "data:text/html,x"]) {
      expect(resumeSource("c1", { url })).toBeNull();
    }
  });
});

describe("search and filters", () => {
  const run = (rows, f, spec) => filterRows(rows, { ...EMPTY_FILTERS, ...f }, spec);
  it("search: all words, any field, and phone numbers however they're written", () => {
    expect(run(seekers, { q: "prakash thane" }, SEEKER_FILTER).map(r => r.uid)).toEqual(["c1"]);
    expect(run(seekers, { q: "tiling" }, SEEKER_FILTER)).toHaveLength(1);
    expect(run(seekers, { q: "zzz" }, SEEKER_FILTER)).toHaveLength(0);
    expect(matchesSearch("+91 97690 31000", "9769031000")).toBe(true);
    expect(run(employers, { q: "e2@x.com" }, EMPLOYER_FILTER).map(r => r.uid)).toEqual(["e2"]);
  });
  it("city (any case), role, status, date range", () => {
    expect(run(jobRows, { city: "thane" }, JOB_FILTER).map(r => r.id)).toEqual(["j1"]);
    expect(run(seekers, { role: "Helper" }, SEEKER_FILTER).map(r => r.uid)).toEqual(["c2"]);
    expect(run(jobRows, { status: "pending" }, JOB_FILTER).map(r => r.id)).toEqual(["j2"]);
    expect(run(jobRows, { from: "2026-11-21", to: "2026-11-21" }, JOB_FILTER).map(r => r.id)).toEqual(["j2"]);
    expect(run(jobRows, { from: "2026-01-01" }, JOB_FILTER).map(r => r.id)).toEqual(["j2", "j1"]); // no date → left out
  });
  it("distinct ignores case and blanks", () => {
    expect(distinct(["Pune", "pune ", "", null, "Agra"])).toEqual(["Agra", "Pune"]);
  });
});

describe("export + helpers", () => {
  it("exports carry phone, email and resume link", () => {
    expect(seekerExport(by(seekers, "uid", "c1"), "https://r")).toMatchObject({ Mobile: "9769031000", Email: "p@x.com", "Resume link": "https://r", "Expected pay": "₹950", "Profile created": "2026-11-22" });
    expect(employerExport(by(employers, "uid", "e1"))).toMatchObject({ Mobile: "9222222222", Email: "e1@x.com" });
    expect(jobExport(by(jobRows, "id", "j1"))).toMatchObject({ "Employer mobile": "9222222222", "Employer email": "e1@x.com", "Shortlists used": "1/10", Status: "Open" });
  });
  it("an applicant row uses that application's contact first, then the profile", () => {
    const c1 = by(seekers, "uid", "c1");
    expect(applicantRow(applications[0], c1, { applicantPhone: "9000000001", resumePath: "resumes/c1/j1/2_cv.pdf" }, x => x)).toMatchObject({ phone: "9000000001", email: "p@x.com", resume: { path: "resumes/c1/j1/2_cv.pdf" }, isShortlisted: true });
    expect(applicantRow({ id: "a", applicantUid: "q", applicantPhone: "98" }, undefined, null, x => x)).toMatchObject({ phone: "98", stageLabel: "submitted", resume: null });
  });
  it("made-up phone-account emails are never shown", () => {
    expect(realEmail("9111111111@phone.tinit.in")).toBe("");
    expect(buildSeekers({ profiles: [{ id: "c1" }], privates: [], users, applications: [] })[0]).toMatchObject({ phone: "9111111111", email: "" });
  });
  it("dates: Timestamp, ISO, Date, junk", () => {
    expect(toDate(ts("2026-11-20T00:00:00"))).toBeInstanceOf(Date);
    expect(toDate("2026-11-20T00:00:00")).toBeInstanceOf(Date);
    expect(toDate("junk")).toBeNull();
    expect(toDate({})).toBeNull();
  });
});
