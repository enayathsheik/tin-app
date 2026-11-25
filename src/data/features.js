// Launch feature flags (L1 "Jobs-only site", launch 22 Nov 2026).
//
// tinit.in launches as a Jobs-only site. Everything below that is `false` is
// hidden from every menu and its in-app page redirects to /jobs — the code is
// NOT deleted. Flip a flag back to `true` (and redeploy hosting) to bring that
// area back. Read by src/App.jsx, src/pages/RetailerDashboard.jsx and the
// build scripts (scripts/generate-sitemap.js, scripts/prerender.js).
export const FEATURES = {
  home: false,           // old marketplace Home (HeroPage) + Consumer/Contractor/Architect homes
  discover: false,       // Discover (store directory/search)
  inspi: false,          // Inspi (design inspiration feed)
  marketChampion: false, // Market Champion home + Rewards, My Zone, Leaderboard
  staff: false,          // Staff profiles
  skilledOtp: false,     // B2: skilled workers sign up / log in with an SMS code. false = off
                         // straight away (e.g. SMS trouble); password sign-up still works.
                         // OFF until Phone sign-in is on in the Firebase console (owner, 25 Nov 2026).
  oldSignup: false,      // old register form on the login page (Consumer, Market Champion,
                         // Retailer, Contractor, Architect; referral code; work email).
                         // Sign-up is /signup since B1. Existing accounts keep working.
  deals: false,          // Deals
  addStoreMenu: false,   // "+ Add Store" menu buttons (the Add Store page itself stays
                         // reachable from Post a Job → "List your store on TIN")
};

// When the old Home is off, "/" is the Jobs home.
export const JOBS_ONLY = !FEATURES.home;

// In-app `page` ids (App.jsx state at "/") → the flag that controls them.
export const PAGE_FLAGS = {
  home: "home",
  discover: "discover",
  inspi: "inspi",
  rewards: "marketChampion",
  myzone: "marketChampion",
  leaderboard: "marketChampion",
  staff: "staff",
  deals: "deals",
  add: "addStoreMenu",
};

// Is this page id visible in menus? Unknown ids (jobs, messages, profile,
// admin, homSystems, login…) are always visible.
export const isPageEnabled = (id) => {
  const flag = PAGE_FLAGS[id];
  return flag ? FEATURES[flag] !== false : true;
};
