const { callStructured } = require('../providers/openai/adapter');
const { callAndValidate } = require('../tools/outputValidation');
const { SUGGESTED_ACTION_SCHEMA } = require('../tools/suggestedActionSchema');

// Calls the provider adapter with the resolved prompt + assembled context +
// schema, validates the output, and returns the structured result or null.
async function classify(prompt, context) {
  return callAndValidate((systemPromptSuffix) =>
    callStructured(prompt, context, SUGGESTED_ACTION_SCHEMA, prompt.modelTier, systemPromptSuffix)
  );
}

module.exports = { classify };
