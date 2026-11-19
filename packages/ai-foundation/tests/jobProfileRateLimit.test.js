// AI profile helper rate limits (docs/JOBS_BLUEPRINT.md §8): 5 a day and
// 20 a month per person, 2,000 a day across TIN. Days in India time.
const { checkUsage, istDay, USER_DAY_LIMIT, USER_MONTH_LIMIT, GLOBAL_DAY_LIMIT } = require('../jobProfile/rateLimit');

const NOW = new Date('2026-11-19T10:00:00+05:30');

// Simulate N calls in a row, writing back what checkUsage returns.
function run(n, start = { user: null, global: null }, now = NOW) {
  let { user, global } = start;
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = checkUsage(user, global, now);
    results.push(r);
    if (r.ok) { user = { ...user, ...r.user }; global = { ...global, ...r.global }; }
  }
  return { results, user, global };
}

describe('per-person limits', () => {
  it('limits are as designed', () => {
    expect([USER_DAY_LIMIT, USER_MONTH_LIMIT, GLOBAL_DAY_LIMIT]).toEqual([5, 20, 2000]);
  });

  it('allows 5 calls a day and blocks call 6', () => {
    const { results, user } = run(6);
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]).toMatchObject({ ok: false, code: 'user_day' });
    expect(results[5].message).toMatch(/try again tomorrow/);
    expect(user).toMatchObject({ profileDay: '2026-11-19', profileDayCount: 5, profileMonth: '2026-11', profileMonthCount: 5 });
  });

  it('starts a new day at midnight India time', () => {
    const { user, global } = run(5);
    const lateNight = checkUsage(user, global, new Date('2026-11-19T23:59:00+05:30'));
    expect(lateNight.ok).toBe(false);
    const nextDay = checkUsage(user, global, new Date('2026-11-20T00:01:00+05:30'));
    expect(nextDay.ok).toBe(true);
    expect(nextDay.user).toMatchObject({ profileDay: '2026-11-20', profileDayCount: 1, profileMonthCount: 6 });
  });

  it('blocks call 21 of the month', () => {
    const user = { profileDay: '2026-11-18', profileDayCount: 5, profileMonth: '2026-11', profileMonthCount: 20 };
    expect(checkUsage(user, null, NOW)).toMatchObject({ ok: false, code: 'user_month' });
    const december = checkUsage(user, null, new Date('2026-12-01T09:00:00+05:30'));
    expect(december.ok).toBe(true);
    expect(december.user.profileMonthCount).toBe(1);
  });
});

describe('global limit', () => {
  it('blocks everyone after 2,000 calls in a day, with a try-tomorrow message', () => {
    const global = { profileDay: '2026-11-19', profileDayCount: 2000 };
    const r = checkUsage(null, global, NOW);
    expect(r).toMatchObject({ ok: false, code: 'global_day' });
    expect(r.message).toMatch(/try again tomorrow/);
    expect(checkUsage(null, { ...global, profileDayCount: 1999 }, NOW)).toMatchObject({ ok: true, global: { profileDayCount: 2000 } });
  });
});

describe('guarded reads', () => {
  it('treats missing or malformed counter docs as zero', () => {
    for (const bad of [null, undefined, {}, 'x', { profileDay: 5, profileDayCount: 'lots' }, { profileDay: '2026-11-19', profileDayCount: -3 }, { profileDay: '2026-11-19', profileDayCount: NaN }]) {
      const r = checkUsage(bad, bad, NOW);
      expect(r.ok).toBe(true);
      expect(r.user.profileDayCount).toBe(1);
      expect(r.global.profileDayCount).toBe(1);
    }
  });

  it('uses India time for the date', () => {
    expect(istDay(new Date('2026-11-19T20:00:00Z'))).toBe('2026-11-20'); // 01:30 IST
  });
});
