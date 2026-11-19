const { classifyMessage, MIN_SUGGESTED_ACTION_CONFIDENCE } = require('./classifyMessage');
const { INTENT_TYPES, SUGGESTED_ACTION_TYPES } = require('../intent/taxonomy');
// AI profile helper (TIN Jobs, docs/JOBS_BLUEPRINT.md §8).
const jobProfile = require('../jobProfile/suggest');
const jobProfileRateLimit = require('../jobProfile/rateLimit');

module.exports = {
  classifyMessage,
  MIN_SUGGESTED_ACTION_CONFIDENCE,
  INTENT_TYPES,
  SUGGESTED_ACTION_TYPES,
  jobProfile,
  jobProfileRateLimit,
};
