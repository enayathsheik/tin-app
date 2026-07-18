const MODEL_CONFIG = {
  fast: process.env.AI_FAST_MODEL || 'gpt-4o-mini', // placeholder default, confirm before going live
  capable: process.env.AI_CAPABLE_MODEL || 'gpt-4o', // not used in Phase 1, included for future phases
};

module.exports = { MODEL_CONFIG };
