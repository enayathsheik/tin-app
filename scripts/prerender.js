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
import { initAdmin } from "./firebaseAdmin.js";
import { buildJobPostingJsonLd } from "../src/utils/jobJsonLd.js";
import { parseSalaryRange } from "../src/utils/salaryParser.js";

const SITE_URL = "https://tinit.in";
const DIST_DIR = "dist";
const META_REGION = /<!--SEO-META-START-->[\s\S]*?<!--SEO-META-END-->/;

const truncate = (str, len) => (str && str.length > len ? str.slice(0, len - 1).trimEnd() + "…" : str || "");
const escapeHtml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildJobMetaBlock(job) {
  const orgName = job.businessName || job.postedByName || "TIN";
  const title = escapeHtml(`${job.jobTitle} at ${orgName} | TIN Jobs`);
  const description = escapeHtml(truncate(job.description, 160));
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

    if (job.salaryRange && !parseSalaryRange(job.salaryRange)) {
      console.warn(`[prerender] Could not parse salaryRange for job ${job.id}: "${job.salaryRange}"`);
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

  console.log(`[prerender] Generated ${jobCount} job page(s) and ${storeCount} store page(s).`);
}

main().catch(e => { console.error("[prerender] Fatal:", e.message); process.exit(1); });
