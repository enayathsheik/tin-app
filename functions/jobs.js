// ============================================================
// TIN Jobs — shortlist from Find candidates (A2)
// File: functions/jobs.js
// Deploy: firebase deploy --only functions:shortlistCandidate
//
// An employer's browser can't read a candidate's phone, email or CV, so it
// can't make the application itself. This does, on the server. The Admin SDK
// bypasses firestore.rules, so EVERY check the rules would make is made here:
// own job, approved and live, shortlist limit (L10), consent, daily cap.
// The stage, profile and shortlist logic is the app's own (vendor/jobs, copied
// from src/ by scripts/vendor-ai-foundation.js), so the two can't drift.
// ============================================================
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const db = getFirestore();

let corePromise = null;
function loadCore() {
  corePromise = corePromise || Promise.all([
    import("./vendor/jobs/utils/jobProfile.js"),
    import("./vendor/jobs/utils/applications.js"),
    import("./vendor/jobs/utils/shortlist.js"),
    import("./vendor/jobs/utils/candidateSearch.js"),
    import("./vendor/jobs/utils/pricing.js"),
  ]).then((mods) => Object.assign({}, ...mods));
  return corePromise;
}

const refuse = (status, code, message) => new HttpsError(status, message, { code });
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
// The cap runs on the Indian calendar day.
const dayInIndia = (now = new Date()) => new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

// The candidate writes cv.path themselves, and this copies with admin rights:
// only ever a file of their own.
function ownCvPath(candidateUid, cv) {
  const parts = typeof cv?.path === "string" ? cv.path.split("/") : [];
  const ok = parts[0] === "resumes" && parts[1] === candidateUid
    && ((parts.length === 4 && parts[2] === "profile") || parts.length === 3)
    && parts.every((x) => x && x !== "." && x !== "..");
  return ok ? cv.path : null;
}

// What this call would do now, or an error. Run once before the CV copy, and
// again inside the transaction, where it decides. getAll(...refs) → snapshots.
async function plan(getAll, { uid, jobId, candidateUid }, core) {
  const appId = `${jobId}_${candidateUid}`;
  const refs = {
    job: db.doc(`jobListings/${jobId}`),
    app: db.doc(`jobApplications/${appId}`),
    pub: db.doc(`jobProfiles/${candidateUid}`),
    priv: db.doc(`jobProfilesPrivate/${candidateUid}`),
    config: db.doc("config/pricing"),
    usage: db.doc(`searchShortlistUsage/${uid}`),
  };
  const snaps = await getAll(...Object.values(refs));
  const d = {};
  Object.keys(refs).forEach((k, i) => { d[k] = snaps[i].exists ? snaps[i].data() : null; });

  // Same answer for "not yours" and "doesn't exist".
  if (!d.job || d.job.postedByUid !== uid) throw refuse("permission-denied", "not_your_job", "You can shortlist only for your own jobs.");
  if (d.job.status !== "approved" || d.job.jobStatus !== "live") throw refuse("failed-precondition", "job_not_live", "This job isn't live. Choose a live job.");

  if (d.app) {
    if (core.isFinal(core.currentStage(d.app))) {
      throw refuse("failed-precondition", "closed", "This person's application for this job is already closed, so they can't be shortlisted for it again.");
    }
    if (core.isContactUnlocked(d.app)) return { kind: "already", appId };
  }

  const limit = core.shortlistLimitFrom(d.config);
  const count = core.shortlistCountOf(d.job);
  if (count >= limit) throw refuse("resource-exhausted", "shortlist_full", core.SHORTLIST_FULL_MESSAGE(limit));
  const slot = { refs, appId, n: count + 1, limit, job: d.job };

  // They applied to this job themselves: the normal shortlist, no daily cap.
  if (d.app) return { kind: "existing", ...slot, app: d.app };

  // One answer for hidden, not asked, said no and doesn't exist.
  if (!d.pub || !core.isSearchable(d.pub)) throw refuse("failed-precondition", "not_available", "This person isn't available on employer search any more.");
  if (String(d.priv?.phone || "").replace(/\D/g, "").length < 10) throw refuse("failed-precondition", "no_phone", "This person hasn't added a phone number yet, so they can't be shortlisted.");

  const day = dayInIndia();
  const usedToday = d.usage?.day === day ? Number(d.usage.count) || 0 : 0;
  const dailyLimit = core.searchDailyLimitFrom(d.config);
  if (usedToday >= dailyLimit) {
    throw refuse("resource-exhausted", "daily_limit", dailyLimit === 0
      ? "Shortlisting from search is switched off for now."
      : `You've reached today's limit of ${dailyLimit} shortlists from search. Please try again tomorrow.`);
  }
  return { kind: "new", ...slot, day, usedToday, dailyLimit, profile: core.profileFromDocs(d.pub, d.priv) };
}

// Copy the saved CV into this job's folder, where the existing access rule
// (and its end when the candidate withdraws) applies. {} = no CV.
async function copyCv(candidateUid, jobId, cv) {
  const from = ownCvPath(candidateUid, cv);
  if (!from) return {};
  const bucket = getStorage().bucket();
  const src = bucket.file(from);
  const [exists] = await src.exists();
  if (!exists) return {};
  const fileName = String(cv.fileName || "CV").slice(0, 200);
  const safe = fileName.replace(/[^\w.\- ]+/g, "_").slice(-80);
  const resumePath = `resumes/${candidateUid}/${jobId}/${Date.now()}_${safe}`;
  const [meta] = await src.getMetadata();
  // metadata: {} — a download token belongs to the original file only.
  await src.copy(bucket.file(resumePath), { contentType: meta.contentType, metadata: {} });
  return { resumePath, resumeFileName: fileName };
}

async function removeCopy(cv) {
  if (!cv.resumePath) return;
  try { await getStorage().bucket().file(cv.resumePath).delete(); } catch (e) { console.warn("[shortlistCandidate] CV copy not removed:", e && e.message); }
}

exports.shortlistCandidate = onCall(
  { region: "asia-south1", cors: true, invoker: "public", enforceAppCheck: false, timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) throw refuse("unauthenticated", "not_signed_in", "Please log in first.");
    const { jobId, candidateUid } = request.data && typeof request.data === "object" ? request.data : {};
    if (typeof jobId !== "string" || typeof candidateUid !== "string" || !ID_RE.test(jobId) || !ID_RE.test(candidateUid)) {
      throw refuse("invalid-argument", "bad_input", "Choose a job and a person.");
    }
    if (candidateUid === uid) throw refuse("invalid-argument", "yourself", "You can't shortlist yourself.");

    const core = await loadCore();
    const who = { uid, jobId, candidateUid };
    const first = await plan((...refs) => db.getAll(...refs), who, core);
    if (first.kind === "already") return { status: "already", applicationId: first.appId };

    let cv = {};
    if (first.kind === "new") {
      try { cv = await copyCv(candidateUid, jobId, first.profile.cv); } catch (e) {
        console.error("[shortlistCandidate] CV copy failed:", e && e.message);
        throw refuse("unavailable", "cv_copy", "Couldn't shortlist right now. Please try again.");
      }
    }

    let result;
    try {
      result = await db.runTransaction(async (tx) => {
        const p = await plan((...refs) => tx.getAll(...refs), who, core);
        if (p.kind === "already") return { status: "already", applicationId: p.appId };
        const now = FieldValue.serverTimestamp();

        if (p.kind === "existing") {
          const u = core.stageUpdate(p.app, "shortlisted", "employer", uid);
          tx.update(p.refs.app, {
            ...u,
            stageHistory: u.stageHistory.map((e) => (e.at instanceof Date ? { ...e, at: Timestamp.fromDate(e.at) } : e)),
            contactUnlockedAt: now, shortlistSlot: p.n, updatedAt: now,
          });
        } else {
          // Pay stays out: "Show my pay" covers employers the person applies to.
          const snap = core.applicationSnapshot({ ...p.profile, showPayToEmployers: false });
          tx.create(p.refs.app, {
            jobId, applicantUid: candidateUid, ...snap, message: "", hasCv: !!cv.resumePath,
            jobSnapshot: { title: p.job.jobTitle || "", businessName: p.job.businessName || p.job.postedByName || "", city: p.job.city || "" },
            source: "employer_search",
            stage: "shortlisted",
            stageHistory: [{ stage: "shortlisted", at: Timestamp.now(), by: "employer", byUid: uid }],
            applicantStatus: "new", // as on every application; only `stage` counts
            contactUnlockedAt: now, shortlistSlot: p.n, createdAt: now, updatedAt: now,
          });
          tx.create(p.refs.app.collection("private").doc("contact"), { ...core.applicationContact(p.profile), ...cv, createdAt: now });
          tx.set(p.refs.usage, { day: p.day, count: p.usedToday + 1, updatedAt: now });
        }
        // create(): a slot that exists already can never be taken twice.
        tx.create(p.refs.job.collection("shortlistSlots").doc(String(p.n)), { appId: p.appId, createdAt: now });
        tx.update(p.refs.job, { shortlistCount: p.n });
        return {
          status: "shortlisted", applicationId: p.appId, created: p.kind === "new", used: p.n, limit: p.limit,
          ...(p.kind === "new" ? { leftToday: p.dailyLimit - p.usedToday - 1 } : {}),
        };
      });
    } catch (e) {
      await removeCopy(cv);
      if (e instanceof HttpsError) throw e;
      console.error("[shortlistCandidate] failed:", e && e.message);
      throw refuse("unavailable", "try_again", "Couldn't shortlist right now. Please try again.");
    }
    if (!result.created) await removeCopy(cv);
    return result;
  }
);
