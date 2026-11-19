// Which OpenAI model each AI feature uses. Every feature has its OWN setting,
// so switching one never changes another:
//
//   messageClassifier  onMessageCreate (prompts/intent-classification)
//                      model:            AI_CLASSIFIER_MODEL
//                      reasoning effort: AI_CLASSIFIER_REASONING_EFFORT
//   profileHelper      suggestJobProfile (prompts/job-profile-suggestion)
//                      model:            AI_PROFILE_MODEL
//                      reasoning effort: AI_PROFILE_REASONING_EFFORT
//
// Set them in functions/.env (not secret) and redeploy only that function.
// Reasoning effort is sent only when set (for reasoning models such as
// gpt-6-luna, e.g. "none"); unset → the request is exactly as before.
// `fast` / `capable` remain as generic fallbacks for unknown tiers.
//
// Read at call time (not module load), so tests and env changes apply.
// See docs/JOBS_BLUEPRINT.md §8 for the gpt-4o-mini shutdown (Jan 14, 2027)
// and the switch plan.

const DEFAULT_MODEL = 'gpt-4o-mini';

const TIERS = {
  fast: { modelVar: 'AI_FAST_MODEL', fallback: DEFAULT_MODEL },
  capable: { modelVar: 'AI_CAPABLE_MODEL', fallback: 'gpt-4o' },
  messageClassifier: { modelVar: 'AI_CLASSIFIER_MODEL', effortVar: 'AI_CLASSIFIER_REASONING_EFFORT', fallback: DEFAULT_MODEL },
  profileHelper: { modelVar: 'AI_PROFILE_MODEL', effortVar: 'AI_PROFILE_REASONING_EFFORT', fallback: DEFAULT_MODEL },
};

const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// tier → { model, reasoningEffort|null }. Unknown tier → `fast`.
function resolveModel(tier, env = process.env) {
  const t = TIERS[tier] || TIERS.fast;
  const model = clean(env[t.modelVar]) || t.fallback;
  const effort = t.effortVar ? clean(env[t.effortVar]).toLowerCase() : '';
  return { model, reasoningEffort: REASONING_EFFORTS.includes(effort) ? effort : null };
}

// Back-compat snapshot of the model names (as read at load time).
const MODEL_CONFIG = Object.fromEntries(Object.keys(TIERS).map((k) => [k, resolveModel(k).model]));

module.exports = { MODEL_CONFIG, TIERS, REASONING_EFFORTS, resolveModel };
