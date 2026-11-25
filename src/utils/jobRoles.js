// L3: which floating buttons a visitor sees (unit-tested in test/unit/jobRoles.test.js).
//  guest                         → Search Jobs + Post a Job
//  employer (posted a job, linked business, or retailer) → Post a Job
//  job seeker (job profile or any application)           → Search Jobs
//  both, or neither yet (new account)                    → both
//  admin / hom_admin                                     → none
export function floatingButtonsFor(user, roles) {
  if (!user) return { search: true, post: true };
  if (user.role === "admin" || user.role === "hom_admin") return { search: false, post: false };
  const employer = !!roles?.employer;
  const seeker = !!roles?.seeker;
  if (employer && !seeker) return { search: false, post: true };
  if (seeker && !employer) return { search: true, post: false };
  return { search: true, post: true };
}

// Who may use Find candidates — mirrors isEmployerAccount() on jobProfiles in
// firestore.rules.
export const EMPLOYER_ROLES = ["retailer", "contractor", "architect", "manufacturer", "employer"];
export const isEmployerAccount = (user) => EMPLOYER_ROLES.includes(user?.role) || user?.storeId != null || user?.jobBusiness != null;

// Signals available without a read.
export const isEmployerByAccount = (user) => !!user?.storeId || user?.role === "retailer" || user?.role === "employer";
export const isSeekerByAccount = (user) => user?.role === "jobseeker";

// Where the floating buttons appear, and which one is pointless on that page.
// Left out: pages with their own bottom controls (wizard, profile form, Desk
// bulk bar, messages, store edit) and the admin/HOM screens.
const LANE_PATHS = ["/jobs/professional", "/jobs/skilled", "/jobs/needed-now"];
const HIDDEN_PREFIXES = ["/signup", "/jobs/post", "/jobs/profile", "/jobs/desk", "/conversations", "/homsystems"];

export function floatingButtonsPlacement(pathname, { page } = {}) {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  if (HIDDEN_PREFIXES.some(x => p === x || p.startsWith(x + "/"))) return null;
  if (/^\/jobs\/[^/]+\/edit$/.test(p) || /^\/store\/[^/]+\/edit$/.test(p)) return null;
  if (p === "/") return page === "profile" ? { hideSearch: false } : null; // "/" is otherwise admin/retailer/add-store screens
  if (LANE_PATHS.includes(p)) return { hideSearch: true };
  return { hideSearch: false, searchFocusesBox: p === "/jobs" };
}
