// Rate limits for the AI profile helper (docs/JOBS_BLUEPRINT.md §8).
// Pure: takes the current aiUsage docs (possibly missing or malformed) and
// returns whether this call is allowed plus the docs to write. The Cloud
// Function runs it inside a Firestore transaction (Admin SDK).
//
// aiUsage/{uid}:    { profileDay, profileDayCount, profileMonth, profileMonthCount, updatedAt }
// aiUsage/_global:  { profileDay, profileDayCount, updatedAt }
// Days and months are counted in India time (Asia/Kolkata).

const USER_DAY_LIMIT = 5;
const USER_MONTH_LIMIT = 20;
const GLOBAL_DAY_LIMIT = 2000;

function istDay(now) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Guarded reads: a missing doc, a missing field or a wrong type all count as 0.
const count = (d, dateField, countField, current) => {
  const data = d && typeof d === 'object' ? d : {};
  const n = data[countField];
  return data[dateField] === current && typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
};

function checkUsage(userDoc, globalDoc, now = new Date()) {
  const day = istDay(now);
  const month = day.slice(0, 7);
  const userDay = count(userDoc, 'profileDay', 'profileDayCount', day);
  const userMonth = count(userDoc, 'profileMonth', 'profileMonthCount', month);
  const globalDay = count(globalDoc, 'profileDay', 'profileDayCount', day);

  if (globalDay >= GLOBAL_DAY_LIMIT) {
    return { ok: false, code: 'global_day', message: 'Too many people are using this today. Please try again tomorrow, or fill the form yourself. · आज बहुत लोग इसका इस्तेमाल कर चुके हैं। कल फिर कोशिश करें, या खुद फ़ॉर्म भरें।' };
  }
  if (userDay >= USER_DAY_LIMIT) {
    return { ok: false, code: 'user_day', message: `You can use "Fill it for me" ${USER_DAY_LIMIT} times a day. Please try again tomorrow, or fill the form yourself. · आज की सीमा पूरी हो गई। कल फिर कोशिश करें।` };
  }
  if (userMonth >= USER_MONTH_LIMIT) {
    return { ok: false, code: 'user_month', message: `You can use "Fill it for me" ${USER_MONTH_LIMIT} times a month. Please fill the form yourself. · इस महीने की सीमा पूरी हो गई।` };
  }
  return {
    ok: true,
    user: { profileDay: day, profileDayCount: userDay + 1, profileMonth: month, profileMonthCount: userMonth + 1 },
    global: { profileDay: day, profileDayCount: globalDay + 1 },
  };
}

module.exports = { USER_DAY_LIMIT, USER_MONTH_LIMIT, GLOBAL_DAY_LIMIT, istDay, checkUsage };
