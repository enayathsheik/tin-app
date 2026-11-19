const { validateOutput, callAndValidate } = require('../tools/outputValidation');

const GOOD_SAMPLE = {
  intent: 'payment',
  intentConfidence: 0.87,
  suggestedActionType: 'log_ledger_entry',
  suggestedActionConfidence: 0.91,
  // Strict mode (f944624): every payload field is present; the ones that
  // don't apply to this action type are null.
  suggestedActionPayload: {
    amount: 5000,
    invoiceNumber: null,
    dueDate: null,
    description: 'Advance payment',
    milestoneTitle: null,
    milestoneDate: null,
    snagDescription: null,
    snagSeverity: null,
    projectName: null,
    referenceDescription: null,
    referenceUrl: null,
  },
  reasoning: 'Sender confirmed an advance payment amount.',
  evidenceMessageId: 'msg_123',
};

const BAD_SAMPLE = {
  intent: 'not_a_real_intent', // not in the fixed taxonomy
  intentConfidence: 1.5, // out of [0,1] range
  suggestedActionType: 'log_ledger_entry',
  // missing suggestedActionConfidence, suggestedActionPayload, reasoning, evidenceMessageId
};

describe('validateOutput', () => {
  it('accepts a known-good sample', () => {
    const result = validateOutput(GOOD_SAMPLE);
    expect(result.valid).toBe(true);
    expect(result.value).toEqual(GOOD_SAMPLE);
  });

  it('rejects a payload that leaves out a field instead of sending null', () => {
    const { invoiceNumber, ...payload } = GOOD_SAMPLE.suggestedActionPayload; // eslint-disable-line no-unused-vars
    const result = validateOutput({ ...GOOD_SAMPLE, suggestedActionPayload: payload });
    expect(result.valid).toBe(false);
  });

  it('rejects a known-malformed sample', () => {
    const result = validateOutput(BAD_SAMPLE);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('callAndValidate', () => {
  it('returns the value when the first attempt is valid', async () => {
    const callFn = vi.fn().mockResolvedValue(GOOD_SAMPLE);
    const result = await callAndValidate(callFn);
    expect(result).toEqual(GOOD_SAMPLE);
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('retries once with a stricter reminder, then returns null if still invalid', async () => {
    const callFn = vi.fn().mockResolvedValue(BAD_SAMPLE);
    const result = await callAndValidate(callFn);
    expect(result).toBeNull();
    expect(callFn).toHaveBeenCalledTimes(2);
    expect(callFn.mock.calls[1][0]).toContain('IMPORTANT');
  });

  it('recovers if the retry attempt is valid', async () => {
    const callFn = vi.fn().mockResolvedValueOnce(BAD_SAMPLE).mockResolvedValueOnce(GOOD_SAMPLE);
    const result = await callAndValidate(callFn);
    expect(result).toEqual(GOOD_SAMPLE);
    expect(callFn).toHaveBeenCalledTimes(2);
  });
});
