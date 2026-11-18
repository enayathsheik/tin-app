// Application stages, milestones and allowed moves (docs/JOBS_BLUEPRINT.md
// §4.4). Plain functions, zero React/Firebase imports — unit-tested, and
// mirrored by the jobApplications rules in firestore.rules.
import {
  CANDIDATE_STAGES, EMPLOYER_STAGES, EMP_SET, FINAL, LEGACY_APPLICANT_STATUS, MILESTONES, NEXT, ST,
} from "../data/jobsTaxonomy.js";

// The application's current stage: the new `stage` field, else the old
// applicantStatus through the approved mapping, else "submitted".
export function currentStage(app) {
  if (app && typeof app.stage === "string" && ST[app.stage]) return app.stage;
  return LEGACY_APPLICANT_STATUS[app?.applicantStatus] || "submitted";
}

export const isFinal = (stage) => FINAL.includes(stage);
export const stageLabel = (stage) => ST[stage]?.label || stage;
export const stageText = (stage) => ST[stage]?.text || "";
export const stageTone = (stage) => ST[stage]?.tone || "n";
export const nextStep = (stage) => NEXT[stage] || null;

// The 6 milestones with reached / current flags. A milestone is reached if
// the application was ever in one of its stages (history), or is now.
// `stopped` = closed without an accepted offer (the tracker greys out).
export function milestoneProgress(app) {
  const stage = currentStage(app);
  const seen = new Set([...(app?.stageHistory || []).map(e => e.stage), stage]);
  // Old applications have no history: a later stage implies the earlier ones.
  const order = MILESTONES.map(([, ks]) => ks);
  const currentIdx = order.findIndex(ks => ks.includes(stage));
  const steps = MILESTONES.map(([label, ks], i) => ({
    label,
    reached: ks.some(k => seen.has(k)) || (currentIdx >= 0 && i <= currentIdx),
    current: i === currentIdx,
  }));
  if (!steps[0].reached) steps[0].reached = true; // every application was submitted
  return { steps, stopped: isFinal(stage) && stage !== "offer_accepted", stage };
}

// ── Candidate moves ──────────────────────────────────────────

// What the candidate may do now: { withdraw, acceptInterview, requestReschedule, answerOffer }.
export function candidateActions(app) {
  const stage = currentStage(app);
  if (isFinal(stage)) return { withdraw: false, acceptInterview: false, requestReschedule: false, answerOffer: false };
  const invited = stage === "int_invited" || stage === "int_rescheduled";
  return { withdraw: true, acceptInterview: invited, requestReschedule: invited, answerOffer: stage === "offer_sent" };
}

export function canCandidateMoveTo(app, to) {
  const stage = currentStage(app);
  if (isFinal(stage) || !CANDIDATE_STAGES.includes(to)) return false;
  if (to === "withdrawn") return true;
  if (to === "int_scheduled") return stage === "int_invited" || stage === "int_rescheduled";
  if (to === "offer_accepted" || to === "offer_declined") return stage === "offer_sent";
  return false;
}

// ── Employer moves ───────────────────────────────────────────

// Stages the employer can pick from the "Move to" list (EMP_SET, minus the
// current one). Interview invite/reschedule has its own form.
export function employerStageOptions(app) {
  const stage = currentStage(app);
  if (isFinal(stage)) return [];
  return EMP_SET.filter(s => s !== stage);
}

export function canEmployerMoveTo(app, to) {
  return !isFinal(currentStage(app)) && EMPLOYER_STAGES.includes(to);
}

// Opening an application records "Application Viewed" once — only while
// it's still at "submitted".
export const shouldMarkViewed = (app) => currentStage(app) === "submitted";

// One stageHistory entry. `at` is a Date (Firestore stores it as a Timestamp).
export function stageEntry(stage, by, byUid, note = "", at = new Date()) {
  const e = { stage, at, by, byUid };
  const n = typeof note === "string" ? note.trim() : "";
  if (n) e.note = n.slice(0, 500);
  return e;
}

// The update to write for a stage change (history grows by exactly one).
export function stageUpdate(app, stage, by, byUid, { note = "", interview = null, at = new Date() } = {}) {
  const update = {
    stage,
    stageHistory: [...(app?.stageHistory || []), stageEntry(stage, by, byUid, note, at)],
  };
  if (interview) update.interview = interview;
  return update;
}

// Interview details entered by the employer.
export const INTERVIEW_MODES = ["In person", "Phone call", "Video call"];
export function cleanInterview(i = {}) {
  const s = (v) => (typeof v === "string" ? v.trim() : "");
  return {
    date: s(i.date), time: s(i.time),
    mode: INTERVIEW_MODES.includes(i.mode) ? i.mode : "In person",
    where: s(i.where), instructions: s(i.instructions),
  };
}
export const interviewComplete = (i) => !!(i && i.date && i.time && (i.mode !== "In person" || i.where));
