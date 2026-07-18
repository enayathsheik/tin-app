// Wraps a validated classification result into an ExplainabilityBlock
// (see schema.js). Only message IDs are carried as evidence — never
// re-quoted message content.
function attachExplainability(classification) {
  return {
    ...classification,
    explanation: {
      reasoning: classification.reasoning,
      evidence: [classification.evidenceMessageId],
      confidence: classification.suggestedActionConfidence,
      recommendedAction: classification.suggestedActionType,
    },
  };
}

module.exports = { attachExplainability };
