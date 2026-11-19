// AI profile helper (docs/JOBS_BLUEPRINT.md §8). Turns five short work
// answers into a DRAFT job profile. Suggest, then confirm: nothing here
// writes anywhere — the candidate reviews the draft and presses Save.
//
// The option lists (taxonomy) are passed in, never hard-coded here: the
// Cloud Function passes functions/vendor/jobsTaxonomy.json (generated from
// src/data/jobsTaxonomy.js at build time), tests pass the real module.
// Taxonomy shape: { TRADES, FUNCS, TYPES, AVAIL, EDU, LANES, SKILLED_WORK_TYPES }
// where each list is [{ key, label, labelHi? }] (SKILLED_WORK_TYPES is keys).
const { resolvePrompt } = require('../prompts/registry');
const { callStructured } = require('../providers/openai/adapter');

const ANSWER_COUNT = 5;
const MAX_ANSWER_CHARS = 500;
const MAX_TOTAL_CHARS = 2500;
const OPENAI_TIMEOUT_MS = 20000;

// ── Input ─────────────────────────────────────────────────────

// Anything that looks like an email address or a phone number (10+ digits,
// optionally +91, spaces/dashes/dots between; Devanagari digits too) is
// replaced before the text leaves our server.
const EMAIL_RE = /[A-Za-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Za-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[A-Za-z]{2,}/gi;
const PHONE_RUN_RE = /\(?\+?[0-9०-९][0-9०-९\s\-.()]{7,}[0-9०-९]/g;
const digitCount = (s) => (s.match(/[0-9०-९]/g) || []).length;

function scrubContact(text) {
  return String(text ?? '')
    .replace(EMAIL_RE, '[email removed]')
    .replace(PHONE_RUN_RE, (m) => (digitCount(m) >= 10 ? '[number removed]' : m));
}

// Returns { ok: true, answers: string[5] } or { ok: false, reason }.
function prepareAnswers(input) {
  if (!Array.isArray(input) || input.length !== ANSWER_COUNT) return { ok: false, reason: 'Please answer the five questions.' };
  if (!input.every((a) => typeof a === 'string')) return { ok: false, reason: 'Answers must be text.' };
  const total = input.reduce((n, a) => n + a.length, 0);
  if (total > MAX_TOTAL_CHARS) return { ok: false, reason: `Answers are too long (max ${MAX_TOTAL_CHARS} characters in total).` };
  const answers = input.map((a) => scrubContact(a.trim().slice(0, MAX_ANSWER_CHARS)));
  if (!answers.some((a) => a.replace(/\[(email|number) removed\]/g, '').trim())) return { ok: false, reason: 'Please answer at least one question.' };
  return { ok: true, answers };
}

const normLane = (tax, lane) => (Array.isArray(tax.LANES) && tax.LANES.some((l) => l.key === lane) ? lane : null);
const keysOf = (list) => (Array.isArray(list) ? list.map((o) => o.key) : []);
const typeKeysFor = (tax, lane) => (lane === 'skilled'
  ? keysOf(tax.TYPES).filter((k) => (tax.SKILLED_WORK_TYPES || []).includes(k))
  : keysOf(tax.TYPES));

// ── Output schema (OpenAI structured output, strict) ──────────
// Only profile fields the five answers can speak to. No name, phone, email,
// pay, CV or visibility — those never come from the AI.
function buildProfileSchema(tax, lane) {
  const str = { type: 'string' };
  const enumArr = (keys) => ({ type: 'array', items: { type: 'string', enum: keys } });
  const nullableEnum = (keys) => ({ type: ['string', 'null'], enum: [...keys, null] });
  const properties = {
    lane: nullableEnum(keysOf(tax.LANES)),
    role: str,
    trades: enumArr(keysOf(tax.TRADES)),
    functions: enumArr(keysOf(tax.FUNCS)),
    experienceYears: { type: ['number', 'null'], minimum: 0, maximum: 60 },
    skills: { type: 'array', items: str },
    projects: str,
    history: {
      type: 'array',
      items: {
        type: 'object',
        properties: { role: str, org: str, years: str },
        required: ['role', 'org', 'years'],
        additionalProperties: false,
      },
    },
    education: nullableEnum(keysOf(tax.EDU)),
    educationText: str,
    city: str,
    areas: str,
    languages: str,
    workTypePrefs: enumArr(typeKeysFor(tax, lane)),
    availability: nullableEnum(keysOf(tax.AVAIL)),
  };
  return {
    name: 'job_profile_draft',
    strict: true,
    schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  };
}

// The option keys with labels, so the model can map words to keys.
function optionsText(tax, lane) {
  const line = (title, list, keys) => `${title}: ${(list || [])
    .filter((o) => !keys || keys.includes(o.key))
    .map((o) => `${o.key} = ${o.label}${o.labelHi ? ` / ${o.labelHi}` : ''}`).join('; ')}`;
  return [
    '\n\nAllowed option keys:',
    line('trades', tax.TRADES),
    line('functions', tax.FUNCS),
    line('workTypePrefs', tax.TYPES, typeKeysFor(tax, lane)),
    line('availability', tax.AVAIL),
    line('education', tax.EDU),
  ].join('\n');
}

// ── Output filter (splitProfile-style) ────────────────────────
// Rebuilds the draft from scratch: unknown keys are dropped, list values
// outside the taxonomy are dropped, text is trimmed and capped. The AI can
// never add a field or invent an option.
const s = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pickKeys = (arr, keys) => [...new Set((Array.isArray(arr) ? arr : []).filter((k) => typeof k === 'string' && keys.includes(k)))];
const oneKey = (v, keys) => (typeof v === 'string' && keys.includes(v) ? v : '');

function filterDraft(raw, tax, inputLane) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const lane = normLane(tax, inputLane) || normLane(tax, r.lane) || '';
  const yrs = typeof r.experienceYears === 'number' && Number.isFinite(r.experienceYears) && r.experienceYears >= 0 && r.experienceYears <= 60
    ? Math.round(r.experienceYears * 10) / 10 : null;
  return {
    lane,
    role: s(r.role, 80),
    trades: pickKeys(r.trades, keysOf(tax.TRADES)),
    functions: pickKeys(r.functions, keysOf(tax.FUNCS)),
    experienceYears: yrs,
    skills: (Array.isArray(r.skills) ? r.skills : []).map((x) => s(x, 60)).filter(Boolean).slice(0, 30),
    projects: s(r.projects, 500),
    history: (Array.isArray(r.history) ? r.history : [])
      .map((h) => (h && typeof h === 'object' ? { role: s(h.role, 80), org: s(h.org, 80), years: s(h.years, 30) } : null))
      .filter((h) => h && h.org)
      .slice(0, 10),
    education: oneKey(r.education, keysOf(tax.EDU)),
    educationText: s(r.educationText, 120),
    city: s(r.city, 60),
    areas: s(r.areas, 200),
    languages: s(r.languages, 120),
    workTypePrefs: pickKeys(r.workTypePrefs, typeKeysFor(tax, lane)),
    availability: oneKey(r.availability, keysOf(tax.AVAIL)),
  };
}

// One plain-language line per main field the answers didn't fill.
function draftNotes(draft) {
  const notes = [];
  const skilled = draft.lane === 'skilled';
  if (skilled ? !draft.trades.length : !draft.role && !draft.trades.length) notes.push('Your work/trade was not clear · आपका काम साफ़ नहीं था');
  if (draft.experienceYears == null) notes.push('Experience not mentioned · अनुभव नहीं बताया');
  if (!draft.projects && !draft.history.length) notes.push('Work done not mentioned · किया हुआ काम नहीं बताया');
  if (!draft.city && !draft.areas) notes.push('Work area not mentioned · इलाका नहीं बताया');
  if (!draft.languages) notes.push('Languages not mentioned · भाषा नहीं बताई');
  if (!draft.workTypePrefs.length) notes.push('Kind of work wanted not mentioned · कैसा काम चाहिए, नहीं बताया');
  if (!draft.availability) notes.push('Start date not mentioned · कब से शुरू करेंगे, नहीं बताया');
  return notes;
}

// Full call. Returns { draft, notes }. Throws on an OpenAI failure (the
// caller turns that into a friendly message). `answers` must already have
// passed prepareAnswers().
async function suggestJobProfile({ answers, lane }, tax, { timeoutMs = OPENAI_TIMEOUT_MS, onUsage } = {}) {
  const prompt = resolvePrompt('job-profile-suggestion');
  const inLane = normLane(tax, lane);
  const raw = await callStructured(
    { systemPrompt: prompt.systemPrompt + optionsText(tax, inLane) },
    { answers, lane: inLane },
    buildProfileSchema(tax, inLane),
    prompt.modelTier || 'fast',
    '',
    { timeoutMs, maxRetries: 0, throwOnError: true, onUsage }
  );
  if (!raw) throw new Error('AI is not available');
  const draft = filterDraft(raw, tax, inLane);
  return { draft, notes: draftNotes(draft) };
}

module.exports = {
  ANSWER_COUNT, MAX_ANSWER_CHARS, MAX_TOTAL_CHARS, OPENAI_TIMEOUT_MS,
  scrubContact, prepareAnswers, buildProfileSchema, optionsText, filterDraft, draftNotes, suggestJobProfile,
};
