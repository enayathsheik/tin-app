import { chromium } from "playwright";

const SHOTS = "C:/Users/rw_sa/AppData/Local/Temp/claude/C--Users-rw-sa-tin-app/1f5aca48-cbd6-4a6e-9bd4-2cfb8d883362/scratchpad";
const STAMP = Date.now();
const WORK_EMAIL = `tin-schema-test-${STAMP}@example.com`;
const PASSWORD = "TestPass123!";
const NAME = "Schema Test User";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
const dialogs = [];
page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", err => errors.push("pageerror: " + err.message));
page.on("dialog", async d => { dialogs.push(d.message()); await d.dismiss(); });

await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Login", { timeout: 15000 });
await page.click("text=Login");
await page.waitForSelector("text=Create account");
await page.click("text=Create account");
await page.waitForSelector("text=Market Champion");

// Contributor role is the default selection; fill in the work-email fields
await page.fill('input[placeholder="Your full name"]', NAME);
await page.fill('input[placeholder="you@yourcompany.com"]', WORK_EMAIL);
await page.fill('input[placeholder="••••••••"]', PASSWORD);

await page.screenshot({ path: `${SHOTS}/mig-01-register-form.png` });
await page.click("text=Create Account →");

const homeAppeared = await page.waitForSelector("text=Ways to Earn Points", { timeout: 15000 }).then(()=>true).catch(()=>false);
await page.screenshot({ path: `${SHOTS}/mig-02-champion-home-fresh.png` });
if (!homeAppeared) {
  console.log("DIALOGS SEEN:", JSON.stringify(dialogs));
  console.log("PAGE TEXT:", (await page.locator("body").innerText()).slice(0, 500));
  console.log("ERRORS:", JSON.stringify(errors));
  await browser.close();
  process.exit(1);
}

const homeStatsText = await page.locator("body").innerText();
const hasUndefined = /undefined|NaN/.test(homeStatsText);

// Profile page
await page.click(".avatar");
await page.waitForSelector("text=Market Champion Progress", { timeout: 10000 });
await page.screenshot({ path: `${SHOTS}/mig-03-profile-fresh.png` });
const profileText = await page.locator("body").innerText();
const profileHasUndefined = /undefined|NaN/.test(profileText);

// Leaderboard
await page.click("text=Leaderboard");
await page.waitForSelector("text=Leaderboard", { timeout: 10000 });
await page.screenshot({ path: `${SHOTS}/mig-04-leaderboard.png` });
const leaderboardText = await page.locator("body").innerText();
const leaderboardHasUndefined = /undefined|NaN/.test(leaderboardText);

// Add a store to exercise the points/storesAdded write path
await page.click("text=+ Add Store");
await page.waitForSelector('input[placeholder="e.g. Sharma Hardware & Tools"], input', { timeout: 10000 }).catch(()=>{});
await page.screenshot({ path: `${SHOTS}/mig-05-add-page.png` });

console.log(JSON.stringify({
  WORK_EMAIL, PASSWORD,
  homeStatsHasUndefined: hasUndefined,
  profileHasUndefined,
  leaderboardHasUndefined,
  consoleErrors: errors,
}, null, 2));

await page.waitForTimeout(500);
await browser.close();
