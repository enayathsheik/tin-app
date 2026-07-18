const { classifyMessage, MIN_SUGGESTED_ACTION_CONFIDENCE } = require('./classifyMessage');
const { INTENT_TYPES, SUGGESTED_ACTION_TYPES } = require('../intent/taxonomy');

module.exports = {
  classifyMessage,
  MIN_SUGGESTED_ACTION_CONFIDENCE,
  INTENT_TYPES,
  SUGGESTED_ACTION_TYPES,
};
