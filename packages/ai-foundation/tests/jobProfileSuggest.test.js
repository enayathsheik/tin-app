// AI profile helper (docs/JOBS_BLUEPRINT.md §8): input checks, contact
// scrubbing, output schema and the splitProfile-style output filter.
// Uses the real TIN Jobs taxonomy from the web app.
const path = require('path');
const { pathToFileURL } = require('url');
const {
  scrubContact, prepareAnswers, buildProfileSchema, filterDraft, draftNotes, suggestJobProfile, optionsText,
} = require('../jobProfile/suggest');

let tax;
beforeAll(async () => {
  tax = await import(pathToFileURL(path.join(__dirname, '..', '..', '..', 'src', 'data', 'jobsTaxonomy.js')).href);
});

describe('scrubContact', () => {
  it('removes phone numbers in common Indian formats', () => {
    for (const p of ['9876543210', '+91 98765 43210', '098765-43210', '98765.43210', '+91-9876-543-210', '(+91) 98765 43210', '९८७६५४३२१०']) {
      expect(scrubContact(`call me on ${p} ok`)).toBe('call me on [number removed] ok');
    }
  });

  it('removes email addresses, including spelled-out ones', () => {
    expect(scrubContact('mail ramesh.k@gmail.com please')).toBe('mail [email removed] please');
    expect(scrubContact('ramesh (at) yahoo (dot) in')).toBe('[email removed]');
  });

  it('keeps ordinary numbers: years, counts, pincodes, year ranges', () => {
    const text = '5 saal, 3 towers, 400601 Thane, 2019-2024, ₹900 per day';
    expect(scrubContact(text)).toBe(text);
  });
});

describe('prepareAnswers', () => {
  const five = (a = 'x') => [a, a, a, a, a];

  it('needs exactly five text answers', () => {
    expect(prepareAnswers(undefined).ok).toBe(false);
    expect(prepareAnswers(['a', 'b']).ok).toBe(false);
    expect(prepareAnswers(['a', 'b', 'c', 'd', 5]).ok).toBe(false);
    expect(prepareAnswers(five('mistri')).ok).toBe(true);
  });

  it('rejects all-empty answers (or only contact details)', () => {
    expect(prepareAnswers(five('  ')).ok).toBe(false);
    expect(prepareAnswers(['9876543210', '', '', '', '']).ok).toBe(false);
  });

  it('trims each answer to 500 characters', () => {
    const r = prepareAnswers(['a'.repeat(600), 'b', '', '', '']);
    expect(r.ok).toBe(true);
    expect(r.answers[0]).toHaveLength(500);
  });

  it('rejects a request over 2,500 characters in total', () => {
    expect(prepareAnswers(five('a'.repeat(500))).ok).toBe(true);
    expect(prepareAnswers(five('a'.repeat(501))).ok).toBe(false);
  });

  it('scrubs phone and email before anything is sent', () => {
    const r = prepareAnswers(['mason, call 9876543210', 'x@y.com', '', '', '']);
    expect(r.answers[0]).toBe('mason, call [number removed]');
    expect(r.answers[1]).toBe('[email removed]');
  });
});

describe('buildProfileSchema', () => {
  it('is strict and allows only profile fields — never name, phone, email, pay, cv or visibility', () => {
    const { strict, schema } = buildProfileSchema(tax, null);
    expect(strict).toBe(true);
    expect(schema.additionalProperties).toBe(false);
    const fields = Object.keys(schema.properties);
    expect(schema.required).toEqual(fields);
    for (const f of ['name', 'phone', 'email', 'currentPay', 'expectedPay', 'cv', 'visibility']) expect(fields).not.toContain(f);
  });

  it('restricts option fields to taxonomy keys and experience to 0–60', () => {
    const { schema } = buildProfileSchema(tax, null);
    const p = schema.properties;
    expect(p.trades.items.enum).toEqual(tax.TRADES.map((o) => o.key));
    expect(p.functions.items.enum).toEqual(tax.FUNCS.map((o) => o.key));
    expect(p.workTypePrefs.items.enum).toEqual(tax.TYPES.map((o) => o.key));
    expect(p.availability.enum).toEqual([...tax.AVAIL.map((o) => o.key), null]);
    expect(p.education.enum).toEqual([...tax.EDU.map((o) => o.key), null]);
    expect(p.experienceYears).toMatchObject({ minimum: 0, maximum: 60 });
  });

  it('offers the skilled lane only its work types', () => {
    const { schema } = buildProfileSchema(tax, 'skilled');
    expect(schema.properties.workTypePrefs.items.enum.sort()).toEqual([...tax.SKILLED_WORK_TYPES].sort());
  });

  it('lists option keys with labels (and Hindi for trades) in the prompt', () => {
    const text = optionsText(tax, 'skilled');
    expect(text).toContain('mason = Mason / राजमिस्त्री');
    expect(text).not.toContain('internship');
  });
});

describe('filterDraft (output filter)', () => {
  it('drops unknown keys, so the AI can never add a field', () => {
    const d = filterDraft({ role: 'Mason', name: 'Ramesh', phone: '9876543210', expectedPay: '900', visibility: 'actively_looking', hacked: true }, tax, 'skilled');
    expect(d.role).toBe('Mason');
    for (const k of ['name', 'phone', 'expectedPay', 'visibility', 'hacked']) expect(d).not.toHaveProperty(k);
    expect(Object.keys(d).sort()).toEqual(Object.keys(buildProfileSchema(tax, null).schema.properties).sort());
  });

  it('drops non-taxonomy values and duplicates', () => {
    const d = filterDraft({
      trades: ['mason', 'Mason', 'astronaut', 'mason', 'tile_layer'],
      functions: ['sales_bd', 'selling'],
      workTypePrefs: ['daily_wage', 'internship', 'weekly'],
      availability: 'tomorrow',
      education: 'phd',
    }, tax, 'skilled');
    expect(d.trades).toEqual(['mason', 'tile_layer']);
    expect(d.functions).toEqual(['sales_bd']);
    expect(d.workTypePrefs).toEqual(['daily_wage']); // internship isn't a skilled-lane type
    expect(d.availability).toBe('');
    expect(d.education).toBe('');
  });

  it('keeps experience only as a number from 0 to 60', () => {
    expect(filterDraft({ experienceYears: 5 }, tax).experienceYears).toBe(5);
    expect(filterDraft({ experienceYears: 0.5 }, tax).experienceYears).toBe(0.5);
    for (const bad of [-1, 61, '5', NaN, null, undefined]) expect(filterDraft({ experienceYears: bad }, tax).experienceYears).toBeNull();
  });

  it('keeps the lane the candidate chose; uses the AI lane only when none was given', () => {
    expect(filterDraft({ lane: 'professional' }, tax, 'skilled').lane).toBe('skilled');
    expect(filterDraft({ lane: 'skilled' }, tax, null).lane).toBe('skilled');
    expect(filterDraft({ lane: 'astronaut' }, tax, null).lane).toBe('');
  });

  it('survives garbage output', () => {
    for (const raw of [null, undefined, 'text', 42, [], { trades: 'mason', history: 'x', skills: { a: 1 } }]) {
      const d = filterDraft(raw, tax, null);
      expect(d.trades).toEqual([]);
      expect(d.history).toEqual([]);
      expect(d.skills).toEqual([]);
    }
  });

  it('keeps only history rows with a company and caps text', () => {
    const d = filterDraft({ history: [{ role: 'Mason', org: '', years: '2' }, { role: 'Mason', org: 'L&T', years: '2019–2022', extra: 1 }], projects: 'x'.repeat(900) }, tax);
    expect(d.history).toEqual([{ role: 'Mason', org: 'L&T', years: '2019–2022' }]);
    expect(d.projects).toHaveLength(500);
  });
});

describe('draftNotes', () => {
  it('gives one plain line per main field that is missing', () => {
    const empty = filterDraft({}, tax, 'skilled');
    expect(draftNotes(empty)).toHaveLength(7);
    const full = filterDraft({ trades: ['mason'], experienceYears: 5, projects: 'Plaster', city: 'Thane', languages: 'Hindi', workTypePrefs: ['daily_wage'], availability: 'immediate' }, tax, 'skilled');
    expect(draftNotes(full)).toEqual([]);
    expect(draftNotes({ ...full, experienceYears: null })).toEqual(['Experience not mentioned · अनुभव नहीं बताया']);
  });
});

describe('suggestJobProfile', () => {
  it('throws (never returns a fake draft) when the AI is not available', async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(suggestJobProfile({ answers: ['mason', '', '', '', ''], lane: 'skilled' }, tax)).rejects.toThrow();
    if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
  });
});
