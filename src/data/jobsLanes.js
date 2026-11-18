// Jobs lane pages — URL slugs, headings and per-page SEO text. Shared by the
// React pages (Helmet) and scripts/prerender.js (static <head> per page), so
// the two can never drift apart. Plain data, no imports.
export const JOBS_HOME_META = {
  path: "/jobs",
  title: "TIN Jobs — Jobs in building materials, construction & interiors",
  description: "Find professional roles, skilled trade work and short assignments across building materials, construction, interiors and exteriors in India. Free to browse.",
};

export const JOB_LANE_PAGES = [
  {
    slug: "professional",
    lane: "professional",
    path: "/jobs/professional",
    heading: "Professional careers",
    lead: "Sales, design, engineering, finance and leadership roles across the building materials industry.",
    title: "Professional jobs in building materials & interiors | TIN Jobs",
    description: "Sales, design, engineering, accounts and management jobs with dealers, manufacturers, architects, contractors and developers on TIN.",
  },
  {
    slug: "skilled",
    lane: "skilled",
    path: "/jobs/skilled",
    heading: "Skilled workforce",
    lead: "Steady jobs, project crews and day work for the trades that build every home, shop and tower.",
    title: "Skilled trade jobs — masons, electricians, carpenters & more | TIN Jobs",
    description: "Jobs and day work for masons, electricians, plumbers, carpenters, fabricators, tile layers, painters and other skilled trades on TIN.",
  },
  {
    slug: "needed-now",
    lane: "needed-now",
    path: "/jobs/needed-now",
    heading: "Needed now",
    lead: "Short work, posted clearly: how many people, where, how long and what it pays.",
    title: "Short-term & daily-wage work — needed now | TIN Jobs",
    description: "Temporary, project-based, daily-wage and on-call work in building materials, construction and interiors — posted with headcount, duration and pay.",
  },
];

export const laneBySlug = (slug) => JOB_LANE_PAGES.find(l => l.slug === slug) || null;
