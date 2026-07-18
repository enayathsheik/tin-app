const Ajv = require('ajv');
const { SUGGESTED_ACTION_SCHEMA } = require('./suggestedActionSchema');

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(SUGGESTED_ACTION_SCHEMA.schema);

const STRICT_REMINDER =
  '\n\nIMPORTANT: Your previous response did not match the required JSON shape. ' +
  'Return ONLY a single JSON object with exactly these fields: intent, intentConfidence, ' +
  'suggestedActionType (or null), suggestedActionConfidence, suggestedActionPayload, reasoning, evidenceMessageId. ' +
  'No extra fields, no prose outside the JSON.';

function validateOutput(raw) {
  if (validate(raw)) return { valid: true, value: raw };
  return { valid: false, errors: validate.errors };
}

// Calls `callFn` (expected shape: (systemPromptSuffix) => Promise<object|null>),
// validates the result, retries once with a stricter reminder on failure, and
// returns null (never throws) if both attempts fail.
async function callAndValidate(callFn) {
  const first = await callFn('');
  if (first) {
    const result = validateOutput(first);
    if (result.valid) return result.value;
    console.error('[ai-foundation] output validation failed (attempt 1):', result.errors);
  }

  const second = await callFn(STRICT_REMINDER);
  if (second) {
    const result = validateOutput(second);
    if (result.valid) return result.value;
    console.error('[ai-foundation] output validation failed (attempt 2):', result.errors);
  }

  return null;
}

module.exports = { validateOutput, callAndValidate, STRICT_REMINDER };
