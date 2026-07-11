// Best-effort parser for the free-text `salaryRange` field on job listings
// (e.g. "₹25,000 – ₹35,000/month"). Never emits partial/guessed data — if
// currency, a numeric value, or a recognized pay period can't all be
// confidently extracted, returns null so the caller omits baseSalary
// entirely rather than publishing malformed structured data.
//
// Plain function, zero React/Firebase imports, so it's importable both from
// the Vite client bundle and directly by the Node prerender script.
export function parseSalaryRange(salaryRange) {
  if (!salaryRange || typeof salaryRange !== "string") return null;
  const s = salaryRange.trim();
  if (!s) return null;

  const hasCurrency = /₹|rs\.?|inr/i.test(s);
  if (!hasCurrency) return null;
  const currency = "INR";

  const numberMatches = s.match(/[\d][\d,]*(?:\.\d+)?/g);
  if (!numberMatches || numberMatches.length === 0) return null;
  const numbers = numberMatches.map(n => parseFloat(n.replace(/,/g, ""))).filter(n => !isNaN(n) && n > 0);
  if (numbers.length === 0) return null;

  const minValue = Math.min(...numbers);
  const maxValue = Math.max(...numbers);

  let unitText = null;
  if (/year|annum|annual/i.test(s)) unitText = "YEAR";
  else if (/month/i.test(s)) unitText = "MONTH";
  else if (/week/i.test(s)) unitText = "WEEK";
  else if (/day|daily/i.test(s)) unitText = "DAY";
  else if (/hour|hr\b/i.test(s)) unitText = "HOUR";
  if (!unitText) return null;

  return { currency, minValue, maxValue, unitText };
}
