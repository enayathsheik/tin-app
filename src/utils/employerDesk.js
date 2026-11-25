// Employer Desk logic (Jobs redesign phase 5a, docs/JOBS_BLUEPRINT.md).
// Plain functions, zero React/Firebase imports — unit-tested. The stage
// rules themselves live in utils/applications.js + firestore.rules; this
// file only decides what the Desk offers and counts.
import { BULK_SET, EMP_SET } from "../data/jobsTaxonomy.js";
import { currentStage, isContactUnlocked, isFinal, isFromSearch } from "./applications.js";

// ── Pipeline board ───────────────────────────────────────────
// Six columns (owner-approved plan). Every stage belongs to exactly one.
export const BOARD_COLUMNS = [
  { key: "new", label: "New", stages: ["submitted"] },
  { key: "viewed", label: "Viewed", stages: ["app_viewed", "profile_viewed", "review"] },
  { key: "shortlisted", label: "Shortlisted / Contacted", stages: ["shortlisted", "contacted", "info_req", "assess_req"] },
  { key: "interview", label: "Interview", stages: ["int_invited", "int_scheduled", "int_rescheduled", "int_done"] },
  { key: "offer", label: "Selected / Offer", stages: ["selected", "offer_sent", "offer_accepted"] },
  { key: "closed", label: "Closed", stages: ["not_shortlisted", "not_selected", "offer_declined", "withdrawn", "closed"] },
];

export function columnOf(stage) {
  return (BOARD_COLUMNS.find(c => c.stages.includes(stage)) || BOARD_COLUMNS[0]).key;
}

export function groupByColumn(apps) {
  const out = Object.fromEntries(BOARD_COLUMNS.map(c => [c.key, []]));
  for (const a of apps) out[columnOf(currentStage(a))].push(a);
  return out;
}

// ── People (C) ───────────────────────────────────────────────
// Where people are NOW, past Shortlisted. (Shortlists used, x of 10, is another
// number: it never goes down.) Hired = the candidate accepted the offer on TIN.
export const PEOPLE_BUCKETS = [
  { key: "shortlisted", label: "Shortlisted", stages: ["shortlisted", "info_req", "assess_req"] },
  { key: "contacted", label: "Contacted", stages: ["contacted"] },
  { key: "interview", label: "Interviews", stages: ["int_invited", "int_scheduled", "int_rescheduled", "int_done"] },
  { key: "offer", label: "Offers", stages: ["selected", "offer_sent"] },
  { key: "hired", label: "Hired", stages: ["offer_accepted"] },
];
export const isPeopleBucket = (k) => PEOPLE_BUCKETS.some(b => b.key === k);
const bucketOf = (app) => (isContactUnlocked(app) ? PEOPLE_BUCKETS.find(b => b.stages.includes(currentStage(app)))?.key : undefined);

export function peopleCounts(apps) {
  const out = Object.fromEntries(PEOPLE_BUCKETS.map(b => [b.key, 0]));
  for (const a of apps || []) { const k = bucketOf(a); if (k) out[k]++; }
  return out;
}

const at = (a) => a?.updatedAt?.seconds || a?.createdAt?.seconds || 0;
// The people in one bucket: interviews by date (soonest first, undated and
// done after), everyone else latest change first.
export function peopleIn(apps, key) {
  const list = (apps || []).filter(a => bucketOf(a) === key).sort((a, b) => at(b) - at(a));
  if (key !== "interview") return list;
  const when = (a) => (currentStage(a) !== "int_done" && a.interview?.date ? `${a.interview.date} ${a.interview.time || ""}` : "~");
  return list.sort((a, b) => (when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : 0));
}

// "Shortlisted 2 · Interviews 1" — only what isn't zero.
export const peopleLine = (apps) => {
  const c = peopleCounts(apps);
  return PEOPLE_BUCKETS.filter(b => c[b.key]).map(b => `${b.label} ${c[b.key]}`).join(" · ");
};

// "Not shortlisted" fits only before the interview; "Not selected" only
// from the interview on (owner-approved plan). Everything else in EMP_SET
// is always offered.
const BEFORE_INTERVIEW = new Set(["new", "viewed", "shortlisted"]);
export function stageFitsNow(app, to) {
  const col = columnOf(currentStage(app));
  if (to === "not_shortlisted") return BEFORE_INTERVIEW.has(col);
  if (to === "not_selected") return !BEFORE_INTERVIEW.has(col);
  return true;
}

// Stages offered in the "Move…" sheet for one application.
export function moveOptions(app) {
  const stage = currentStage(app);
  if (isFinal(stage)) return [];
  return EMP_SET.filter(s => s !== stage && stageFitsNow(app, s));
}

// The one big "next step" button on a card. `stage` = move straight there;
// `action: "invite"` = open the interview form. null = waiting on the
// candidate (or closed) — the card just opens.
export function nextAction(app) {
  const stage = currentStage(app);
  switch (stage) {
    case "submitted": case "app_viewed": case "profile_viewed": case "review":
      return { stage: "shortlisted", label: "Shortlist" };
    case "shortlisted": case "contacted": case "info_req": case "assess_req":
      return { action: "invite", label: "Invite to interview" };
    case "int_scheduled":
      return { stage: "int_done", label: "Interview done" };
    case "int_done":
      return { stage: "selected", label: "Select" };
    case "selected":
      return { stage: "offer_sent", label: "Send offer" };
    default:
      return null;
  }
}

// ── Desk numbers ─────────────────────────────────────────────
const INTERVIEW_STAGES = ["int_invited", "int_scheduled", "int_rescheduled"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Monday–Sunday of the week containing `now` (local time), as YYYY-MM-DD.
export function weekRange(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (d.getDay() + 6) % 7; // Monday = 0
  const start = new Date(d); start.setDate(d.getDate() - back);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start: ymd(start), end: ymd(end) };
}

export function isInterviewThisWeek(app, now = new Date()) {
  const date = app?.interview?.date;
  if (!date || !INTERVIEW_STAGES.includes(currentStage(app))) return false;
  const { start, end } = weekRange(now);
  return date >= start && date <= end;
}

// "To reply" (owner decision): the candidate asked for another interview
// time, or accepted/confirmed an interview that still awaits "Interview done".
export function isToReply(app) {
  const stage = currentStage(app);
  if (stage === "int_scheduled") return true;
  return (stage === "int_invited" || stage === "int_rescheduled") && app?.interviewResponse?.type === "reschedule_request";
}

export const isNew = (app) => currentStage(app) === "submitted";
export const isOpenJob = (job) => job?.status === "approved" && (job.jobStatus || "live") === "live";

export function deskCounts(jobs, appsByJob, now = new Date()) {
  const apps = Object.values(appsByJob || {}).flat();
  return {
    openJobs: (jobs || []).filter(isOpenJob).length,
    newApplicants: apps.filter(isNew).length,
    interviewsThisWeek: apps.filter(a => isInterviewThisWeek(a, now)).length,
    toReply: apps.filter(isToReply).length,
  };
}

// Vacancy tabs. A job without jobStatus is live (legacy); pending /
// rejected jobs sit under Live with their review badge.
export const VACANCY_TABS = [
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "filled", label: "Filled" },
  { key: "closed", label: "Closed" },
];
export const vacancyTab = (job) => (["paused", "filled", "closed"].includes(job?.jobStatus) ? job.jobStatus : "live");

// ── Polite notes (owner-approved wording) ─────────────────────
export const POLITE_NOTES = {
  reject: {
    en: "Thank you for applying. We've decided to go ahead with other candidates this time. We wish you all the best.",
    hi: "आवेदन के लिए धन्यवाद। इस बार हमने दूसरे उम्मीदवार चुने हैं। आपको शुभकामनाएँ।",
  },
  close: {
    en: "This position is now closed. Thank you for your interest.",
    hi: "यह पद अब बंद हो गया है। आपकी रुचि के लिए धन्यवाद।",
  },
};

// Default note for a stage, or "" when none applies. Skilled-lane jobs get
// the Hindi text alongside (owner decision). Always editable before sending.
// Someone found in search never applied, so they aren't thanked for it.
const FOUND = { en: ["Thank you for applying.", "Thank you for your time."], hi: ["आवेदन के लिए धन्यवाद।", "आपके समय के लिए धन्यवाद।"] };
export function defaultNote(stage, lane, apps = []) {
  const kind = stage === "not_shortlisted" || stage === "not_selected" ? "reject" : stage === "closed" ? "close" : null;
  if (!kind) return "";
  const found = [].concat(apps).some(isFromSearch);
  const say = (l) => (found ? POLITE_NOTES[kind][l].replace(...FOUND[l]) : POLITE_NOTES[kind][l]);
  const n = { en: say("en"), hi: say("hi") };
  return lane === "skilled" ? `${n.en}\n${n.hi}` : n.en;
}

// ── Bulk updates ─────────────────────────────────────────────
// Which of `apps` a bulk move to `stage` will change, and why the rest are
// skipped. Only BULK_SET stages; never a closed application.
export function bulkPlan(apps, stage) {
  const update = [];
  const skipped = { closed: 0, same: 0, notFitting: 0 };
  if (!BULK_SET.includes(stage)) return { update, skipped, invalid: true };
  for (const a of apps) {
    const s = currentStage(a);
    if (isFinal(s)) skipped.closed++;
    else if (s === stage) skipped.same++;
    else if (!stageFitsNow(a, stage)) skipped.notFitting++;
    else update.push(a);
  }
  return { update, skipped, invalid: false };
}

// ── Closing a vacancy ────────────────────────────────────────
// Closing as "filled" keeps Selected / Offer sent / Offer accepted as they
// are (owner decision); closing as "closed" ends every open application.
export const KEPT_WHEN_FILLED = ["selected", "offer_sent", "offer_accepted"];

export function closePlan(apps, jobStatus) {
  const close = [];
  const kept = [];
  let alreadyClosed = 0;
  for (const a of apps) {
    const s = currentStage(a);
    if (jobStatus === "filled" && KEPT_WHEN_FILLED.includes(s)) kept.push(a);
    else if (isFinal(s)) alreadyClosed++;
    else close.push(a);
  }
  // Pending offers = kept applications still waiting on the candidate or employer.
  const pendingOffers = kept.filter(a => currentStage(a) !== "offer_accepted").length;
  return { close, kept, alreadyClosed, pendingOffers };
}
