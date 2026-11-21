// Generates dist/sitemap.xml and dist/robots.txt from live Firestore data.
// Run after `vite build` (writes directly into dist/). See
// scripts/firebaseAdmin.js for one-time credential setup.
import { writeFileSync } from "fs";
import path from "path";
import { initAdmin, requireServiceAccountPath } from "./firebaseAdmin.js";
import { JOB_LANE_PAGES } from "../src/data/jobsLanes.js";
import { JOBS_ONLY } from "../src/data/features.js";

const SITE_URL = "https://tinit.in";
const DIST_DIR = "dist";

// Fails the build if no key is found (unless SKIP_SEO_PAGES=1) — see scripts/firebaseAdmin.js.
requireServiceAccountPath("sitemap");

const xmlEscape = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function urlEntry(loc, { lastmod, priority } = {}) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    priority != null ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n");
}

async function main() {
  const db = initAdmin();

  const jobsSnap = await db.collection("jobListings")
    .where("status", "==", "approved")
    .where("jobStatus", "==", "live")
    .get();

  const storesSnap = await db.collection("stores").get();

  const entries = [
    // L1 Jobs-only launch: "/" just redirects to /jobs, so /jobs is the top entry.
    ...(JOBS_ONLY ? [] : [urlEntry(`${SITE_URL}/`, { priority: 1.0 })]),
    urlEntry(`${SITE_URL}/jobs`, { priority: JOBS_ONLY ? 1.0 : 0.8 }),
    ...JOB_LANE_PAGES.map(l => urlEntry(`${SITE_URL}${l.path}`, { priority: 0.7 })),
  ];

  jobsSnap.docs.forEach(docSnap => {
    const job = docSnap.data();
    const lastmodTs = job.updatedAt || job.createdAt;
    const lastmod = lastmodTs?.toDate?.()?.toISOString();
    entries.push(urlEntry(`${SITE_URL}/jobs/${docSnap.id}`, { lastmod, priority: 0.6 }));
  });

  storesSnap.docs.forEach(docSnap => {
    const store = docSnap.data();
    const lastmod = store.createdAt?.toDate?.()?.toISOString();
    entries.push(urlEntry(`${SITE_URL}/store/${docSnap.id}`, { lastmod, priority: 0.6 }));
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
  writeFileSync(path.join(DIST_DIR, "sitemap.xml"), sitemap);

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  writeFileSync(path.join(DIST_DIR, "robots.txt"), robots);

  console.log(`[sitemap] Wrote dist/sitemap.xml (${jobsSnap.size} jobs, ${storesSnap.size} stores) and dist/robots.txt.`);
}

main().catch(e => { console.error("[sitemap] Fatal:", e.message); process.exit(1); });
