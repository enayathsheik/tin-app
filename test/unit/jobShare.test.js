import { describe, it, expect } from "vitest";
import { normaliseJob } from "../../src/utils/jobModel.js";
import {
  OG_IMAGE, jobOrgName, jobShareDescription, jobShareSummary, jobShareText, jobShareUrl, shareLinks,
} from "../../src/utils/jobShare.js";

const job = normaliseJob({
  id: "abc123", jobTitle: "Tile layer", businessName: "Sai Tiles & Sanitary", city: "Pune", state: "Maharashtra",
  lane: "skilled", trade: "tile_layer", workTypes: ["full_time"],
  pay: { period: "month", min: 15000, max: 22000, display: "range" },
  description: "Lay floor and wall tiles on residential sites.",
  status: "approved", jobStatus: "live",
});

describe("L6 job sharing", () => {
  it("links to the public job page and uses the TIN default image", () => {
    expect(jobShareUrl("abc123")).toBe("https://tinit.in/jobs/abc123");
    expect(OG_IMAGE).toBe("https://tinit.in/og-image.png");
  });
  it("summary puts pay, city and work type first", () => {
    const s = jobShareSummary(job);
    expect(s).toMatch(/^₹15,000.22,000 \/ month · Pune · Full-time$/);
  });
  it("an old bare-number pay shows as rupees", () => {
    expect(jobShareSummary({ payText: "35000", city: "Mumbai", workTypeLabels: [] })).toBe("₹35,000 · Mumbai");
  });
  it("description = summary — job text, max 160 chars", () => {
    const d = jobShareDescription(job);
    expect(d.startsWith(jobShareSummary(job) + " — Lay floor")).toBe(true);
    expect(jobShareDescription({ ...job, description: "x".repeat(400) }).length).toBeLessThanOrEqual(160);
  });
  it("description falls back to whichever part exists", () => {
    expect(jobShareDescription({ title: "A", description: "Only text", responsibilities: [] })).toBe("Only text");
    expect(jobShareDescription({ title: "A", city: "Pune", responsibilities: [] })).toBe("Pune");
  });
  it("share text names the job and business", () => {
    expect(jobShareText(job)).toMatch(/^Tile layer at Sai Tiles & Sanitary · ₹15,000/);
    expect(jobOrgName({ postedByName: "Ramesh" })).toBe("Ramesh");
    expect(jobOrgName({})).toBe("TIN");
  });
  it("builds WhatsApp, LinkedIn, Facebook and X links with the URL encoded", () => {
    const l = shareLinks("https://tinit.in/jobs/abc123", "Tile layer & more");
    const enc = encodeURIComponent("https://tinit.in/jobs/abc123");
    expect(l.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent("Tile layer & more\nhttps://tinit.in/jobs/abc123")}`);
    expect(l.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${enc}`);
    expect(l.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${enc}`);
    expect(l.x).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent("Tile layer & more")}&url=${enc}`);
  });
});
