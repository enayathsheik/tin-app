// Generates static, crawler-visible HTML for every live job and store page,
// baking real <title>/meta/OG/JSON-LD into <head> at build time. WhatsApp and
// most search crawlers don't reliably execute JS, so the SPA's client-side
// Helmet tags (see src/pages/JobDetailPage.jsx / StoreProfilePage.jsx) are
// invisible to them without this step.
//
// This is intentionally NOT server-side rendering: <div id="root"> is left
// empty, identical to the base dist/index.html, so the React app just mounts
// normally on top once JS loads — no hydration mismatch is possible since the
// body never differs between variants, only <head>.
//
// Run after `vite build` (needs dist/index.html to already exist) and before
// `firebase deploy`. See scripts/firebaseAdmin.js for one-time credential setup.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { initAdmin, requireServiceAccountPath } from "./firebaseAdmin.js";
import { buildJobPostingJsonLd } from "../src/utils/jobJsonLd.js";
import { normaliseJob } from "../src/utils/jobModel.js";
import { JOBS_HOME_META, JOB_LANE_PAGES } from "../src/data/jobsLanes.js";
import { JOBS_ONLY } from "../src/data/features.js";

const SITE_URL = "https://tinit.in";
const DIST_DIR = "dist";
const META_REGION = /<!--SEO-META-START-->[\s\S]*?<!--SEO-META-END-->/;

// Fails the build if no key is found (unless SKIP_SEO_PAGES=1) — see scripts/firebaseAdmin.js.
requireServiceAccountPath("prerender");

const truncate = (str, len) => (str && str.length > len ? str.slice(0, len - 1).trimEnd() + "…" : str || "");
const escapeHtml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildJobMetaBlock(job) {
  // Old and new job shapes both go through normaliseJob() (same as the page).
  const n = normaliseJob(job);
  const orgName = n.businessName || n.postedByName || "TIN";
  const title = escapeHtml(`${n.title} at ${orgName} | TIN Jobs`);
  const description = escapeHtml(truncate(n.description || n.responsibilities.join(". "), 160));
  const url = `${SITE_URL}/jobs/${job.id}`;
  const image = `${SITE_URL}/og-image.png`;
  const jsonLd = buildJobPostingJsonLd(job);

  return `<!--SEO-META-START-->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <!--SEO-META-END-->`;
}

// Static <head> for /jobs and the lane pages (/jobs/professional etc.) —
// same text as the pages' own Helmet tags (src/data/jobsLanes.js).
function buildStaticMetaBlock({ path: pagePath, title: rawTitle, description: rawDescription }) {
  const title = escapeHtml(rawTitle);
  const description = escapeHtml(rawDescription);
  const url = `${SITE_URL}${pagePath}`;
  const image = `${SITE_URL}/og-image.png`;
  return `<!--SEO-META-START-->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="${url}" />
    <!--SEO-META-END-->`;
}

function writePage(pagePath, html) {
  const outDir = path.join(DIST_DIR, ...pagePath.split("/").filter(Boolean));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "index.html"), html);
}

function buildStoreMetaBlock(store) {
  const title = escapeHtml(`${store.storeName} | TIN`);
  const descriptionSource = [
    store.businessType && `${store.businessType} in ${store.city || "India"}`,
    store.brands && `Brands: ${store.brands}`,
  ].filter(Boolean).join(". ") || `${store.storeName} on TIN — India's building materials & construction network.`;
  const description = escapeHtml(truncate(descriptionSource, 160));
  const url = `${SITE_URL}/store/${store.id}`;
  const image = store.logo || `${SITE_URL}/og-image.png`;

  return `<!--SEO-META-START-->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <!--SEO-META-END-->`;
}

async function main() {
  const templatePath = path.join(DIST_DIR, "index.html");
  if (!existsSync(templatePath)) {
    throw new Error(`Missing ${templatePath} — run "vite build" before scripts/prerender.js.`);
  }
  const template = readFileSync(templatePath, "utf8");
  if (!META_REGION.test(template)) {
    throw new Error(`${templatePath} is missing the <!--SEO-META-START/END--> markers expected by scripts/prerender.js.`);
  }

  // Jobs home + lane pages: static text, no data needed.
  for (const page of [JOBS_HOME_META, ...JOB_LANE_PAGES]) {
    writePage(page.path, template.replace(META_REGION, buildStaticMetaBlock(page)));
  }

  const db = initAdmin();

  const jobsSnap = await db.collection("jobListings")
    .where("status", "==", "approved")
    .where("jobStatus", "==", "live")
    .get();

  let jobCount = 0;
  for (const docSnap of jobsSnap.docs) {
    const raw = docSnap.data();
    const createdAtISO = raw.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
    const job = { id: docSnap.id, ...raw, createdAtISO };

    const pay = normaliseJob(job).pay;
    if (pay?.source === "legacy" && pay.min == null) {
      console.warn(`[prerender] Could not read salaryRange for job ${job.id}: "${job.salaryRange}" (shown as text, no baseSalary)`);
    }

    const html = template.replace(META_REGION, buildJobMetaBlock(job));
    const outDir = path.join(DIST_DIR, "jobs", job.id);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "index.html"), html);
    jobCount++;
  }

  const storesSnap = await db.collection("stores").get();
  let storeCount = 0;
  for (const docSnap of storesSnap.docs) {
    const store = { id: docSnap.id, ...docSnap.data() };
    const html = template.replace(META_REGION, buildStoreMetaBlock(store));
    const outDir = path.join(DIST_DIR, "store", store.id);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "index.html"), html);
    storeCount++;
  }

  // L1 Jobs-only launch: "/" opens the Jobs home, so the root page carries the
  // Jobs home title/description (canonical /jobs). Written last — every page
  // above was built from the untouched template.
  if (JOBS_ONLY) writeFileSync(templatePath, template.replace(META_REGION, buildStaticMetaBlock(JOBS_HOME_META)));

  console.log(`[prerender] Generated ${1 + JOB_LANE_PAGES.length} jobs landing/lane page(s), ${jobCount} job page(s) and ${storeCount} store page(s).`);
}

main().catch(e => { console.error("[prerender] Fatal:", e.message); process.exit(1); });
