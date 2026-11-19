// Per-feature model settings: the message classifier (onMessageCreate) and
// the profile helper (suggestJobProfile) each have their own model and
// reasoning-effort setting, so switching one never changes the other.
const { resolveModel } = require('../providers/openai/modelConfig');
const { buildRequestBody } = require('../providers/openai/adapter');
const { resolvePrompt } = require('../prompts/registry');

const prompt = { systemPrompt: 'SYS' };
const schema = { name: 's', strict: true, schema: { type: 'object' } };

describe('resolveModel', () => {
  it('defaults both features to gpt-4o-mini with no reasoning effort', () => {
    expect(resolveModel('messageClassifier', {})).toEqual({ model: 'gpt-4o-mini', reasoningEffort: null });
    expect(resolveModel('profileHelper', {})).toEqual({ model: 'gpt-4o-mini', reasoningEffort: null });
  });

  it('switching the profile helper never changes the classifier (and the reverse)', () => {
    const profileSwitched = { AI_PROFILE_MODEL: 'gpt-6-luna', AI_PROFILE_REASONING_EFFORT: 'none' };
    expect(resolveModel('profileHelper', profileSwitched)).toEqual({ model: 'gpt-6-luna', reasoningEffort: 'none' });
    expect(resolveModel('messageClassifier', profileSwitched)).toEqual({ model: 'gpt-4o-mini', reasoningEffort: null });

    const classifierSwitched = { AI_CLASSIFIER_MODEL: 'gpt-6-luna', AI_CLASSIFIER_REASONING_EFFORT: 'low' };
    expect(resolveModel('messageClassifier', classifierSwitched)).toEqual({ model: 'gpt-6-luna', reasoningEffort: 'low' });
    expect(resolveModel('profileHelper', classifierSwitched)).toEqual({ model: 'gpt-4o-mini', reasoningEffort: null });
  });

  it('the old generic AI_FAST_MODEL no longer moves either feature', () => {
    expect(resolveModel('messageClassifier', { AI_FAST_MODEL: 'x' }).model).toBe('gpt-4o-mini');
    expect(resolveModel('profileHelper', { AI_FAST_MODEL: 'x' }).model).toBe('gpt-4o-mini');
    expect(resolveModel('fast', { AI_FAST_MODEL: 'x' }).model).toBe('x');
  });

  it('ignores empty or unknown reasoning-effort values and trims names', () => {
    expect(resolveModel('profileHelper', { AI_PROFILE_MODEL: '  gpt-6-luna ', AI_PROFILE_REASONING_EFFORT: '' })).toEqual({ model: 'gpt-6-luna', reasoningEffort: null });
    expect(resolveModel('profileHelper', { AI_PROFILE_REASONING_EFFORT: 'turbo' }).reasoningEffort).toBeNull();
    expect(resolveModel('profileHelper', { AI_PROFILE_REASONING_EFFORT: 'NONE' }).reasoningEffort).toBe('none');
  });

  it('unknown tier falls back to fast', () => {
    expect(resolveModel('nope', {}).model).toBe('gpt-4o-mini');
  });
});

describe('buildRequestBody', () => {
  it('with default settings the request is exactly the pre-split shape', () => {
    const body = buildRequestBody(prompt, { a: 1 }, schema, 'messageClassifier', '', {});
    expect(body).toEqual({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'SYS' }, { role: 'user', content: '{"a":1}' }],
      response_format: { type: 'json_schema', json_schema: schema },
    });
  });

  it('adds reasoning_effort only for the tier that has one', () => {
    const env = { AI_PROFILE_MODEL: 'gpt-6-luna', AI_PROFILE_REASONING_EFFORT: 'none' };
    expect(buildRequestBody(prompt, {}, schema, 'profileHelper', '', env)).toMatchObject({ model: 'gpt-6-luna', reasoning_effort: 'none' });
    expect(buildRequestBody(prompt, {}, schema, 'messageClassifier', '', env)).not.toHaveProperty('reasoning_effort');
  });
});

describe('prompts name their own feature setting', () => {
  it('intent-classification → messageClassifier, job-profile-suggestion → profileHelper', () => {
    expect(resolvePrompt('intent-classification').modelTier).toBe('messageClassifier');
    expect(resolvePrompt('job-profile-suggestion').modelTier).toBe('profileHelper');
  });
});
