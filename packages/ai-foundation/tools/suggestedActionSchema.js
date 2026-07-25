const { INTENT_TYPES, SUGGESTED_ACTION_TYPES } = require('../intent/taxonomy');

// JSON Schema for the OpenAI structured-output call. `suggestedActionType`
// may be null when the message doesn't warrant a structured action even if
// intent is classifiable — the model must say so explicitly, never omit it.
//
// suggestedActionPayload is flat across all five in-taxonomy action types
// (OpenAI strict mode requires every declared property to appear in
// `required`, so per-type fields are nullable and the model fills only the
// ones relevant to suggestedActionType, leaving the rest null).
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
      suggestedActionPayload: {
        type: 'object',
        additionalProperties: false,
        properties: {
          // log_ledger_entry
          amount: { type: ['number', 'null'] },
          invoiceNumber: { type: ['string', 'null'] },
          dueDate: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          // set_milestone
          milestoneTitle: { type: ['string', 'null'] },
          milestoneDate: { type: ['string', 'null'] },
          // flag_snag
          snagDescription: { type: ['string', 'null'] },
          snagSeverity: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
          // tag_project
          projectName: { type: ['string', 'null'] },
          // share_reference
          referenceDescription: { type: ['string', 'null'] },
          referenceUrl: { type: ['string', 'null'] },
        },
        required: [
          'amount',
          'invoiceNumber',
          'dueDate',
          'description',
          'milestoneTitle',
          'milestoneDate',
          'snagDescription',
          'snagSeverity',
          'projectName',
          'referenceDescription',
          'referenceUrl',
        ],
      },
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
