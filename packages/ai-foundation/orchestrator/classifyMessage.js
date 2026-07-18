const { buildContext } = require('../context/builder');
const { resolvePrompt } = require('../prompts/registry');
const { classify } = require('../intent/classifier');
const { attachExplainability } = require('../explainability/attach');

// Below this, a suggested action is not confident enough to surface —
// classifyMessage returns null rather than writing a low-confidence guess.
const MIN_SUGGESTED_ACTION_CONFIDENCE = 0.7;

// Public entry point: build context -> resolve prompt -> classify ->
// validate (inside classify) -> attach explainability -> return.
async function classifyMessage(messageId) {
  const prompt = resolvePrompt('intent-classification');
  const context = await buildContext(messageId, prompt.contextRequirements);

  const classification = await classify(prompt, context);
  if (!classification) return null;

  const proposal = attachExplainability(classification);

  if (
    !proposal.suggestedActionType ||
    proposal.suggestedActionConfidence < MIN_SUGGESTED_ACTION_CONFIDENCE
  ) {
    return null;
  }

  return proposal;
}

module.exports = { classifyMessage, MIN_SUGGESTED_ACTION_CONFIDENCE };
