// The ONLY file in this package allowed to import the OpenAI SDK.
// Every other module must go through callStructured() below.
const OpenAI = require('openai');
const { MODEL_CONFIG } = require('./modelConfig');

let client = null;
let warnedMissingKey = false;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn(
        '[ai-foundation] OPENAI_API_KEY is not set — AI classification calls will be skipped. ' +
        'Set it via `firebase functions:secrets:set OPENAI_API_KEY` (or the local .env) when ready.'
      );
      warnedMissingKey = true;
    }
    return null;
  }
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

// prompt: resolved prompt template ({ systemPrompt, ... }) from prompts/registry.js
// context: assembled context object from context/builder.js
// schema: JSON schema descriptor ({ name, strict, schema }) from tools/suggestedActionSchema.js
// modelTier: 'fast' | 'capable'
// systemPromptSuffix: optional extra instructions appended for a stricter retry
// options (optional, used by the AI profile helper): { timeoutMs, maxRetries,
//   throwOnError }. When omitted the request is exactly as before.
async function callStructured(prompt, context, schema, modelTier, systemPromptSuffix = '', options) {
  const openai = getClient();
  if (!openai) return null;

  const model = MODEL_CONFIG[modelTier] || MODEL_CONFIG.fast;

  try {
    const body = {
      model,
      messages: [
        { role: 'system', content: prompt.systemPrompt + systemPromptSuffix },
        { role: 'user', content: JSON.stringify(context) },
      ],
      response_format: { type: 'json_schema', json_schema: schema },
    };
    const requestOptions = options
      ? { ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}), ...(options.maxRetries != null ? { maxRetries: options.maxRetries } : {}) }
      : undefined;
    const response = requestOptions
      ? await openai.chat.completions.create(body, requestOptions)
      : await openai.chat.completions.create(body);
    if (options && options.onUsage && response.usage) options.onUsage(response.usage);

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (err) {
    console.error('[ai-foundation] OpenAI call failed:', err.message);
    if (options && options.throwOnError) throw err;
    return null;
  }
}

module.exports = { callStructured };
