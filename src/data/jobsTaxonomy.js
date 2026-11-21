// TIN Jobs taxonomy — option lists for the Jobs redesign.
//
// Labels are copied exactly from the approved prototype (docs/jobs-prototype.html,
// TAXONOMIES + "Application lifecycle" blocks). Each option has a stable slug
// `key`: Firestore stores the KEY, never the display label or an array
// position, so wording/order can change without breaking saved documents.
// Never rename or reuse a key once it ships — add a new one instead.
//
// Plain data + tiny helpers, zero React/Firebase imports, so it's importable
// from the Vite bundle, Node scripts (prerender/sitemap) and unit tests.
// See docs/JOBS_BLUEPRINT.md for how each list is used.

// ── Employer industry (business category) ────────────────────
export const INDUSTRIES = [
  { key: "retail_distribution", label: "Retailers, Distributors & Dealers" },
  { key: "architects_interior_firms", label: "Architects & Interior Design Firms" },
  { key: "manufacturers", label: "Manufacturers" },
  { key: "importers_exporters", label: "Importers & Exporters" },
  { key: "brands", label: "Brands" },
  { key: "interior_fitout", label: "Interior Fit-out Companies" },
  { key: "contractors", label: "General & Specialist Contractors" },
  { key: "epc_construction", label: "EPC & Construction Companies" },
  { key: "real_estate_developers", label: "Real Estate Developers" },
  { key: "consultants", label: "Consultants" },
  { key: "other", label: "Other" },
];

// ── Job function ─────────────────────────────────────────────
export const FUNCS = [
  { key: "sales_bd", label: "Sales & Business Development" },
  { key: "marketing_brand", label: "Marketing & Brand Management" },
  { key: "retail_showroom", label: "Retail & Showroom Operations" },
  { key: "channel_sales", label: "Channel Sales & Distribution" },
  { key: "architectural_project_sales", label: "Architectural & Project Sales" },
  { key: "design_architecture", label: "Design & Architecture" },
  { key: "technical_design_viz", label: "Technical Design & Visualisation" },
  { key: "engineering_technical", label: "Engineering & Technical Services" },
  { key: "production_manufacturing", label: "Production & Manufacturing" },
  { key: "quality", label: "Quality Control & Assurance" },
  { key: "projects_site_execution", label: "Projects & Site Execution" },
  { key: "installation_trades", label: "Installation & Skilled Trades" },
  { key: "procurement_sourcing", label: "Procurement & Sourcing" },
  { key: "supply_chain_logistics", label: "Supply Chain & Logistics" },
  { key: "warehouse_inventory", label: "Warehouse & Inventory Management" },
  { key: "estimation_boq", label: "Estimation, BOQ & Quantity Surveying" },
  { key: "tendering_contracts", label: "Tendering & Contracts Management" },
  { key: "finance_accounts", label: "Finance & Accounts" },
  { key: "hr_admin", label: "Human Resources & Administration" },
  { key: "customer_service", label: "Customer Service & After-Sales Support" },
  { key: "business_operations", label: "Business Operations & Management" },
  { key: "it_digital", label: "Information Technology & Digital" },
  { key: "ecommerce", label: "E-commerce & Digital Commerce" },
  { key: "research_product_dev", label: "Research, Product Development & Innovation" },
  { key: "safety_health_env", label: "Safety, Health & Environment" },
  { key: "legal_compliance", label: "Legal & Compliance" },
  { key: "training_skill_dev", label: "Training & Skill Development" },
  { key: "leadership_executive", label: "Leadership & Executive Management" },
  { key: "other", label: "Other" },
];

// ── Work type ────────────────────────────────────────────────
export const TYPES = [
  { key: "full_time", label: "Full-time" },
  { key: "part_time", label: "Part-time" },
  { key: "permanent", label: "Permanent" },
  { key: "fixed_term", label: "Fixed-term contractual" },
  { key: "temporary", label: "Temporary" },
  { key: "project_based", label: "Project-based" },
  { key: "freelance", label: "Freelance" },
  { key: "consultative", label: "Consultative" },
  { key: "retainer", label: "Retainer-based" },
  { key: "on_call", label: "On-call" },
  { key: "daily_wage", label: "Daily-wage" },
  { key: "apprenticeship", label: "Apprenticeship" },
  { key: "internship", label: "Internship" },
];

// Work types that make a job a short assignment (shown on "Needed Now").
// Keys into TYPES, same order as the prototype's SHORT_TYPES.
export const SHORT_TYPES = ["temporary", "project_based", "freelance", "on_call", "daily_wage", "fixed_term"];

// ── Skilled trades (English + Hindi) ─────────────────────────
export const TRADES = [
  { key: "mason", label: "Mason", labelHi: "राजमिस्त्री" },
  { key: "electrician", label: "Electrician", labelHi: "बिजली मिस्त्री" },
  { key: "plumber", label: "Plumber", labelHi: "प्लंबर" },
  { key: "carpenter", label: "Carpenter", labelHi: "बढ़ई" },
  { key: "furniture_installer", label: "Furniture installer", labelHi: "फर्नीचर फिटर" },
  { key: "aluminium_fabricator", label: "Aluminium fabricator", labelHi: "एल्युमिनियम कारीगर" },
  { key: "polisher", label: "Polisher", labelHi: "पॉलिश कारीगर" },
  { key: "painter", label: "Painter", labelHi: "पेंटर" },
  { key: "pop_gypsum", label: "POP & gypsum", labelHi: "पीओपी कारीगर" },
  { key: "tile_layer", label: "Tile layer", labelHi: "टाइल मिस्त्री" },
  { key: "waterproofing", label: "Waterproofing", labelHi: "वॉटरप्रूफिंग" },
  { key: "glass_installer", label: "Glass installer", labelHi: "काँच फिटर" },
  { key: "hardware_fitter", label: "Hardware fitter", labelHi: "हार्डवेयर फिटर" },
  { key: "helper", label: "Helper", labelHi: "हेल्पर" },
  { key: "general_labour", label: "General labour", labelHi: "मज़दूर" },
  { key: "site_technician", label: "Site technician", labelHi: "साइट टेक्नीशियन" },
  { key: "machine_operator", label: "Machine operator", labelHi: "मशीन ऑपरेटर" },
  { key: "other_trade", label: "Other trade", labelHi: "अन्य काम" },
];

// ── Benefits ("Why work with you") ───────────────────────────
export const BENEFITS = [
  { key: "performance_bonus", label: "Performance-linked bonus" },
  { key: "annual_bonus", label: "Annual / general bonus" },
  { key: "sales_incentives", label: "Sales incentives" },
  { key: "target_rewards", label: "Target achievement rewards" },
  { key: "travel_allowance", label: "Travel allowance" },
  { key: "food_allowance", label: "Food allowance" },
  { key: "accommodation", label: "Accommodation" },
  { key: "medical", label: "Medical benefits" },
  { key: "insurance", label: "Insurance" },
  { key: "paid_leave", label: "Paid leave" },
  { key: "flexible_working", label: "Flexible working" },
  { key: "training", label: "Training & skill development" },
  { key: "career_progression", label: "Career progression" },
  { key: "promotions", label: "Promotions & internal growth" },
  { key: "recognition", label: "Employee recognition" },
  { key: "long_term_benefits", label: "Long-term association benefits" },
  { key: "other_benefits", label: "Other benefits" },
];

// ── Candidate availability ───────────────────────────────────
export const AVAIL = [
  { key: "immediate", label: "Immediate" },
  { key: "within_15_days", label: "Within 15 days" },
  { key: "within_30_days", label: "Within 30 days" },
  { key: "within_60_days", label: "Within 60 days" },
  { key: "employed_open", label: "Employed, open to offers" },
];

// ── Candidate profile visibility ─────────────────────────────
export const VISIBILITY = [
  { key: "actively_looking", label: "Actively looking" },
  { key: "open_to_opportunities", label: "Open to opportunities" },
  { key: "freelance_project", label: "Available for freelance / project work" },
  { key: "employed_open_suitable", label: "Employed, open to suitable roles" },
  { key: "not_looking", label: "Not currently looking" },
  { key: "not_discoverable", label: "Profile not discoverable" },
];

// ── Candidate education level ────────────────────────────────
export const EDU = [
  { key: "school", label: "School" },
  { key: "secondary_iti", label: "10th / 12th / ITI" },
  { key: "diploma", label: "Diploma" },
  { key: "graduate", label: "Graduate" },
  { key: "postgraduate", label: "Postgraduate" },
];

// ── Pay ──────────────────────────────────────────────────────
// `label` = the wizard option ("Paid: Per month"); `suffix` = how the
// prototype prints it after an amount ("₹22,000–28,000 / month").
export const PAY_PERIODS = [
  { key: "month", label: "Per month", suffix: "/ month" },
  { key: "year", label: "Per year", suffix: "/ year" },
  { key: "day", label: "Per day", suffix: "/ day" },
  { key: "hour", label: "Per hour", suffix: "/ hour" },
  { key: "project", label: "Per project", suffix: "/ project" },
];

// `label` = the wizard option ("Show pay as"); `text` = what the job shows
// instead of an amount (null for show_range: the amount itself is shown).
export const PAY_DISPLAY = [
  { key: "show_range", label: "Show range", text: null },
  { key: "negotiable", label: "Negotiable", text: "Negotiable" },
  { key: "undisclosed", label: "Don't disclose", text: "Not disclosed" },
];

// ── Short-assignment urgency ─────────────────────────────────
export const URGENCY = [
  { key: "today_tomorrow", label: "Today / tomorrow" },
  { key: "this_week", label: "This week" },
  { key: "flexible", label: "Flexible" },
];

// ── Application lifecycle ────────────────────────────────────
// Prototype ST, keys unchanged. tone: g = positive, w = action needed,
// n = neutral, e = ended. email: true = this stage also triggers an email
// (not just in-app). text = the candidate-facing explanation.
export const TONES = { g: "positive", w: "action", n: "neutral", e: "ended" };

export const ST = {
  submitted: { label: "Application Submitted", tone: "n", email: false, text: "Your application reached the employer." },
  app_viewed: { label: "Application Viewed", tone: "n", email: false, text: "The employer opened your application." },
  profile_viewed: { label: "Profile Viewed", tone: "n", email: false, text: "The employer opened your full professional profile." },
  review: { label: "Under Review", tone: "n", email: false, text: "Your application is being reviewed." },
  shortlisted: { label: "Shortlisted", tone: "g", email: true, text: "You're on the shortlist. The employer may contact you soon." },
  not_shortlisted: { label: "Not Shortlisted", tone: "e", email: true, text: "The employer has decided not to take this application forward. Thank you for applying. Your profile stays visible to other employers." },
  contacted: { label: "Employer Contacted", tone: "g", email: true, text: "The employer has reached out to you." },
  int_invited: { label: "Interview Invited", tone: "w", email: true, text: "You're invited to an interview. Please respond." },
  int_scheduled: { label: "Interview Scheduled", tone: "g", email: true, text: "Your interview is confirmed." },
  int_rescheduled: { label: "Interview Rescheduled", tone: "w", email: true, text: "Your interview has a new time. Please confirm it." },
  int_done: { label: "Interview Completed", tone: "n", email: false, text: "Interview completed. The employer will update you." },
  info_req: { label: "Additional Information Requested", tone: "w", email: true, text: "The employer needs a little more information from you." },
  assess_req: { label: "Assessment Requested", tone: "w", email: true, text: "The employer has asked you to complete a short assessment." },
  selected: { label: "Selected", tone: "g", email: true, text: "Congratulations, you've been selected." },
  offer_sent: { label: "Offer Sent", tone: "w", email: true, text: "An offer is waiting for your response." },
  offer_accepted: { label: "Offer Accepted", tone: "g", email: true, text: "You accepted the offer." },
  offer_declined: { label: "Offer Declined", tone: "e", email: true, text: "You declined the offer." },
  not_selected: { label: "Not Selected", tone: "e", email: true, text: "The employer has chosen another candidate this time. Thank you for your time and interest." },
  withdrawn: { label: "Application Withdrawn", tone: "e", email: true, text: "You withdrew this application." },
  closed: { label: "Position Filled / Application Closed", tone: "e", email: true, text: "This position has been filled or closed. Thank you for applying." },
};

// Stages after which the application is closed (no further moves).
export const FINAL = ["not_shortlisted", "offer_accepted", "offer_declined", "not_selected", "withdrawn", "closed"];
// Stages an employer may set on a single application.
export const EMP_SET = ["review", "shortlisted", "not_shortlisted", "contacted", "int_done", "info_req", "assess_req", "selected", "offer_sent", "not_selected", "closed"];
// L8 (launch): reaching any of these stages — Shortlisted or later — unlocks
// the applicant's phone, email and CV for whoever manages the job. Mirrored
// in firestore.rules (contactUnlockStages) and storage.rules.
export const CONTACT_UNLOCK_STAGES = [
  "shortlisted", "contacted", "int_invited", "int_scheduled", "int_rescheduled", "int_done",
  "info_req", "assess_req", "selected", "offer_sent", "offer_accepted", "offer_declined",
];
// Stages an employer may set in bulk from the list view.
export const BULK_SET = ["review", "shortlisted", "not_shortlisted", "not_selected", "closed"];
// "Your next step" prompt shown to the candidate at these stages.
export const NEXT = {
  int_invited: "Respond to the interview invitation",
  int_rescheduled: "Confirm the new interview time",
  info_req: "Reply with the requested information",
  assess_req: "Complete the assessment and reply",
  offer_sent: "Accept or decline the offer",
};
// Progress-tracker milestones: [label, stages that count as reaching it].
export const MILESTONES = [
  ["Submitted", ["submitted"]],
  ["Viewed", ["app_viewed", "profile_viewed"]],
  ["Shortlisted", ["shortlisted", "contacted"]],
  ["Interview", ["int_invited", "int_scheduled", "int_rescheduled", "int_done"]],
  ["Selected", ["selected"]],
  ["Offer", ["offer_sent", "offer_accepted"]],
];

// Phase 4: who may set which stage (docs/JOBS_BLUEPRINT.md §4.4; mirrored
// in firestore.rules). Employers: EMP_SET + the automatic "viewed" stages +
// interview invite / reschedule. Candidates: withdraw, accept an interview,
// answer an offer.
export const EMPLOYER_STAGES = [...EMP_SET, "app_viewed", "profile_viewed", "int_invited", "int_rescheduled"];
export const CANDIDATE_STAGES = ["withdrawn", "int_scheduled", "offer_accepted", "offer_declined"];
// Old applicantStatus values → stage (owner-approved mapping).
export const LEGACY_APPLICANT_STATUS = {
  new: "submitted",
  shortlisted: "shortlisted",
  rejected: "not_shortlisted",
  hired: "offer_accepted",
};

// Work types offered to the skilled lane (owner decision, Phase 4); the
// professional lane gets the full TYPES list.
export const SKILLED_WORK_TYPES = ["daily_wage", "project_based", "full_time", "temporary", "fixed_term", "on_call"];
export const workTypesForLane = (lane) =>
  lane === "skilled" ? TYPES.filter(t => SKILLED_WORK_TYPES.includes(t.key)) : TYPES;

// ── Lanes ────────────────────────────────────────────────────
// Only two lanes are stored. "Needed Now" is derived (short work type or a
// duration set) — see isNeededNow() in src/utils/jobModel.js.
export const LANES = [
  { key: "professional", label: "Professional" },
  { key: "skilled", label: "Skilled workforce" },
];

// ── Industry prefill (decision D2, owner-approved in Phase 3) ──
// TIN business type (stores.businessType, see BUSINESS_TYPES in
// constants.js) → INDUSTRIES key. Exact table; anything not listed means
// the poster picks. The prefill is always editable.
export const BUSINESS_TYPE_INDUSTRY = {
  Retailer: "retail_distribution",
  Distributor: "retail_distribution",
  Wholesaler: "retail_distribution",
  Manufacturer: "manufacturers",
  Contractor: "contractors",
  Architect: "architects_interior_firms",
  Designer: "architects_interior_firms",
  Consultant: "consultants",
};
// TIN account role (ROLES in constants.js) → INDUSTRIES key, for accounts
// with no linked store. Only roles that name a business type map.
export const ROLE_INDUSTRY = {
  retailer: "retail_distribution",
  manufacturer: "manufacturers",
  contractor: "contractors",
  architect: "architects_interior_firms",
};
// Linked store's businessType wins; else the account role; else null.
export function industryPrefill({ businessType, role } = {}) {
  return BUSINESS_TYPE_INDUSTRY[businessType] || ROLE_INDUSTRY[role] || null;
}

// ── Helpers ──────────────────────────────────────────────────
export const keysOf = (list) => list.map(o => o.key);
export const isKey = (list, key) => typeof key === "string" && list.some(o => o.key === key);
export const labelOf = (list, key) => list.find(o => o.key === key)?.label ?? null;
// Exact label → key (used only for mapping legacy job fields; no fuzzy matching).
export const keyForLabel = (list, label) => list.find(o => o.label === label)?.key ?? null;
