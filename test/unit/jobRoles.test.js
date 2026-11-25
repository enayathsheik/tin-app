import { describe, it, expect } from "vitest";
import { floatingButtonsFor, floatingButtonsPlacement, isEmployerByAccount } from "../../src/utils/jobRoles.js";

describe("L3 floating buttons by user type", () => {
  const u = { uid: "u1", role: "consumer" };
  it("guest sees both", () => {
    expect(floatingButtonsFor(null)).toEqual({ search: true, post: true });
  });
  it("employer sees only Post a Job", () => {
    expect(floatingButtonsFor(u, { employer: true, seeker: false })).toEqual({ search: false, post: true });
  });
  it("job seeker sees only Search Jobs", () => {
    expect(floatingButtonsFor(u, { employer: false, seeker: true })).toEqual({ search: true, post: false });
  });
  it("both, or neither yet, sees both", () => {
    expect(floatingButtonsFor(u, { employer: true, seeker: true })).toEqual({ search: true, post: true });
    expect(floatingButtonsFor(u, { employer: false, seeker: false })).toEqual({ search: true, post: true });
  });
  it("admin and HOM admin see none", () => {
    expect(floatingButtonsFor({ role: "admin" }, null)).toEqual({ search: false, post: false });
    expect(floatingButtonsFor({ role: "hom_admin" }, null)).toEqual({ search: false, post: false });
  });
  it("a linked business or retailer account counts as employer without a read", () => {
    expect(isEmployerByAccount({ storeId: "s1" })).toBe(true);
    expect(isEmployerByAccount({ role: "retailer" })).toBe(true);
    expect(isEmployerByAccount({ role: "consumer" })).toBe(false);
  });
});

describe("where the buttons appear", () => {
  it("jobs home: both allowed, Search focuses the search box", () => {
    expect(floatingButtonsPlacement("/jobs")).toEqual({ hideSearch: false, searchFocusesBox: true });
  });
  it("lane result pages hide Search Jobs", () => {
    expect(floatingButtonsPlacement("/jobs/skilled").hideSearch).toBe(true);
    expect(floatingButtonsPlacement("/jobs/needed-now/").hideSearch).toBe(true);
  });
  it("job page, saved, applications, store and public profile pages show them", () => {
    ["/jobs/abc123", "/jobs/saved", "/jobs/applications", "/store/s1", "/@ramesh"].forEach(p =>
      expect(floatingButtonsPlacement(p)).not.toBeNull());
  });
  it("pages with their own bottom controls don't", () => {
    ["/signup", "/signup/work", "/signup/hire", "/signup/skilled", "/login/otp", "/jobs/post", "/jobs/abc/edit", "/jobs/profile", "/jobs/desk", "/conversations", "/conversations/x", "/store/s1/edit", "/homsystems"].forEach(p =>
      expect(floatingButtonsPlacement(p)).toBeNull());
  });
  it('"/" only on the account profile screen', () => {
    expect(floatingButtonsPlacement("/", { page: "profile" })).not.toBeNull();
    expect(floatingButtonsPlacement("/", { page: "admin" })).toBeNull();
    expect(floatingButtonsPlacement("/", { page: "add" })).toBeNull();
  });
});
