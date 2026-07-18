const { INTENT_TYPES, SUGGESTED_ACTION_TYPES } = require('../intent/taxonomy');

// JSON Schema for the OpenAI structured-output call. `suggestedActionType`
// may be null when the message doesn't warrant a structured action even if
// intent is classifiable — the model must say so explicitly, never omit it.
const SUGGESTED_ACTION_SCHEMA = {
  name: 'suggested_action_proposal',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string', enum: [...INTENT_TYPES] },
      intentConfidence: { type: 'number', minimum: 0, maximum: 1 },
      suggestedActionType: {
        type: ['string', 'null'],
        enum: [...SUGGESTED_ACTION_TYPES, null],
      },
      suggestedActionConfidence: { type: 'number', minimum: 0, maximum: 1 },
      suggestedActionPayload: { type: 'object' },
      reasoning: { type: 'string' },
      evidenceMessageId: { type: 'string' },
    },
    required: [
      'intent',
      'intentConfidence',
      'suggestedActionType',
      'suggestedActionConfidence',
      'suggestedActionPayload',
      'reasoning',
      'evidenceMessageId',
    ],
  },
};

module.exports = { SUGGESTED_ACTION_SCHEMA };
