# TIN Jobs — Redesign Blueprint

The contract for every phase of the TIN Jobs redesign. If a later phase needs
to differ from this document, update this document first, in the same commit.

- **Approved design:** `docs/jobs-prototype.html`, used for **features, flows,
  categories and data only**. Its look (dark theme, red accent, fonts, canvas
  art) is **not** used. Every screen is built with TIN's existing styles and
  classes (`fi`, `fta`, `chip`, `var(--s1)`, `var(--acc)` …), the same way
  `JobsPage.jsx` and `PostJobModal.jsx` are built today.
- **Option lists:** `src/data/jobsTaxonomy.js`, with labels copied exactly from the
  prototype. Firestore stores the stable slug **key**, never the label or a
  list position.
- **Job reader:** `src/utils/jobModel.js` → `normaliseJob()`. Every screen
  reads jobs through it, so old and new jobs look the same to the UI.
- **Working rules for every phase:** additive only (no migrations, no rewriting
  old documents); never invent a value (missing → hidden); no seed scripts;
  don't touch `src/lib/tenancy.js`; emulator suite green → diff → owner OK →
  one commit → deploy only what changed.

---

## 1. Screen inventory

**Reuse** = use as-is. **Extend** = existing TIN file/collection grows.
**New** = doesn't exist in TIN today.

### Find work (public)

| Prototype screen | What it does | TIN today | Plan | Phase |
|---|---|---|---|---|
| Jobs home (`home`) | Three lane entry points, "Needed Now" strip, recent jobs, browse by function | `JobsPage.jsx` (single list) | **Extend**: becomes the lanes landing | 2 |
| Browse by industry (on Jobs home) | Industry tiles linking to filtered lists | none | **New**. **Deferred to Phase 3** (owner decision, Phase 2): jobs don't record an industry yet; add once D2 is settled and the wizard saves one | 3 |
| Professional lane (`listing("pro")`) | List + filters: search, function, industry, city, work type | `JobsPage.jsx` filters (category/city/type) | **Extend** | 2 |
| Skilled Workforce lane (`listing("skill")`) | Trade picker (English + Hindi), filters: search, industry, city, work type | none | **New** (inside the JobsPage family) | 2 |
| Needed Now (`flexible`) | Short assignments as "tickets": how many, where, how long, pay | none | **New**: derived view, `isNeededNow()` | 2 |
| Job detail drawer (`openJob`) | Facts (pay, location, people, experience, duration/start), work types, duties, skills, "Why work with us", Apply / Save / Report | `JobDetailPage.jsx` (+ prerender, JSON-LD) | **Extend**: keep the real page + SEO, add the new facts | 2 |
| Save job | Saved list in My TIN | none | **New**: `users/{uid}/savedJobs/{jobId}` | 2 (save) / 4 (list) |
| Report job | Flags a listing to admin | none | **New**: `jobReports` collection | 2 |
| Sign-in gate (`gate`) | "Sign in to apply / save" | `onRequireLogin` + LoginPage | **Reuse** | 2 |
| Public employer page (`company`) | Business profile + its open vacancies | `StoreProfilePage.jsx` | **Extend**: add an "Open jobs" section. **Moved to Phase 3**: needs a store link on the job (written by the wizard). Phase 2 links the job page *to* the store / poster profile via `profiles/{uid}` | 3 |

### Post a job (employer)

| Prototype screen | What it does | TIN today | Plan | Phase |
|---|---|---|---|---|
| Wizard step 1: Business | Shows the poster's TIN business profile; or register a new business | `PostJobModal.jsx` (business name text box) | **Extend**: pull from the user's store/business profile | 3 |
| Step 2: The job | Lane, title (trade picker for skilled), headcount, functions, work types, short-assignment box (duration, start, urgency, cert/tools), location, experience, hours, education, duties, skills | `PostJobModal.jsx` single form | **New** wizard (replaces the modal) | 3 |
| Step 3: Pay | Period, min/max, show as (range / negotiable / undisclosed), incentives | free-text `salaryRange` | **New** structured `pay` | 3 |
| Step 4: Why work with you (optional) | Tick benefits with details, or write own text | none | **New** `benefits`, `evpText` | 3 |
| Step 5: Review & publish | Summary; publish / save draft / submit for approval | approve/pending logic in `PostJobModal.jsx` | **Extend**; every job goes live at once since §12 | 3 |
| Edit vacancy (`editJob`) | Re-opens the wizard on an existing job | not allowed (rules only allow `jobStatus`) | **New** + rules change (§5.3) | 3 |
| "Your vacancy is live" | Confirmation with links | toast + modal message | **Extend** | 3 |

### Candidate

| Prototype screen | What it does | TIN today | Plan | Phase |
|---|---|---|---|---|
| Create profile (`work`, 4 steps) | About you → your work / trade → what you want → availability & visibility | none (TIN user doc only) | **New** `jobProfiles` + `jobProfilesPrivate` (§4) | 4 |
| Apply | One tap with the saved profile and CV | `JobApplyModal.jsx` + `useJobApply.js` (name, phone, message, CV upload) | **Extend**: prefill from profile, snapshot into the application | 4 |
| My TIN → My applications (`myApps`) | Table of applications, stage pill, "next step" prompt | none | **New** | 4 |
| Application detail (`candAppDetail`) | Milestone stepper, timeline, interview invite (accept / another time / decline), offer (accept / decline), message employer, withdraw | none | **New**: messaging goes through TIN Conversations (§1, Phase 5) | 4 (tracker), 5 (messages) |
| My profile (`myProfile`) | Personal (phone private), professional, history, skills, preferences (current pay never shown), visibility & availability, email settings | `ProfilePage.jsx` (TIN profile) | **New** jobs tab, linked from ProfilePage | 4 |
| Saved jobs | List of saved jobs | none | **New** | 4 |
| Messages & notifications (`candInbox`) | In-app updates | `ConversationsPage.jsx` for messages | **Reuse** Conversations + **New** notifications | 5 / 6 |

### Employer Desk

| Prototype screen | What it does | TIN today | Plan | Phase |
|---|---|---|---|---|
| Desk header + KPIs | Active / drafts / paused / closed / applications / shortlisted / filled | `RetailerJobsPage.jsx` ("My Jobs") | **Extend** into the Employer Desk | 5 |
| Vacancies (`vacancies`) | Tabs by status; views, applied, shortlisted, interviews, filled; edit, pause, extend 30 days, close (closing gives open applicants a polite update) | `RetailerJobsPage.jsx` (Live/Filled/Closed buttons) | **Extend** | 5 |
| Applications: pipeline board (`applications`, board) | Kanban columns New / Reviewing / Shortlisted / Interview / Offer / Hired / Closed (prototype `BOARD`) | applicant list with a status dropdown | **New** | 5 |
| Applications: list & bulk actions | Filter all/new/active/closed; bulk set `BULK_SET` stages | none | **New** | 5 |
| Application drawer (`openEmpApp`) | Stepper, expected pay, availability, education, CV, full profile (contact visible because they applied; current pay never), set stage (`EMP_SET`), schedule interview, message | applicant row (name, phone, message, CV link) | **New** | 5 |
| Messaging a candidate | Per-application conversation | `src/lib/conversations.js`, job already in `LINKABLE_ENTITY_COLLECTIONS` | **Reuse**: open/continue a TIN conversation and `linkEntity({entityType:"job"})`. **No separate chat system.** | 5 |
| Find candidates (`finder`) | Employer Desk → Find candidates (A3): people who said yes and are looking; "Shortlist for job…" unlocks contact through `shortlistCandidate` (functions/jobs.js), uses a slot, 20 new people a day per employer | none | **Built** `src/components/jobs/desk/FindCandidates.jsx`, `ShortlistForJob.jsx`, `src/lib/findCandidates.js` | 5 |
| Team (`team`) | Owner / HR Manager / Recruiter / Employee; who can publish; per-person email prefs | `organizations` + `memberships` (tenancy) | **Extend** using existing org roles; no `tenancy.js` changes without separate approval | 5 |
| Business profile (`empProfile`) | TIN store/business profile + recruitment details (team size, hiring contact, culture text) | `stores` / store profile | **Extend** (additive recruitment fields) | 5 |
| Notifications (employer inbox) | New applications, candidate responses, vacancy expiry, milestones | none | **New** | 6 |

### Notifications & emails

| Prototype behaviour | TIN today | Plan | Phase |
|---|---|---|---|
| In-app notification for every stage change; email only where `ST[stage].email` is true and the person's email preference is on; duplicates within 10 minutes dropped | none | **New** `notifications` collection + email sending | 6 |
| Candidate email prefs: application updates, employer messages, contact requests | none | **New** (in `jobProfilesPrivate`) | 6 |
| Employer email prefs (per team member): new applications, candidate responses, vacancy updates, milestones | none | **New** | 6 |
| Team invite email | none | **New** | 6 |

### Admin

| Prototype screen | TIN today | Plan | Phase |
|---|---|---|---|
| Alerts (registrations, flagged vacancies, suspicious activity) | none | **New** | 7 |
| Recruitment analytics (funnel, by geography / function / work type) | none | **New** | 7 |
| Employers / Vacancies / Candidates tables | `JobsReviewSection.jsx` (pending + approved jobs, approve/reject) | **Extend** | 7 |
| Activity & audit log | none | **New** | 7 |
| Career intelligence | none | **New** | 7 |

### Career pathway (candidate)

| Prototype screen | TIN today | Plan | Phase |
|---|---|---|---|
| Career goals at 1 / 3 / 5 / 10 years from a role library (`LIB`, `TRACKS`), readiness per goal, TIN Career Score (`W` weights), qualifications tracker (`QST`), career log (`LOGT`), score history | none | **New**. Its option lists are added to `jobsTaxonomy.js` in Phase 7, not before | 7 |

---

## 2. Phase plan

| Phase | Scope | Visible on tinit.in? |
|---|---|---|
| **1 Foundation** | This blueprint, `jobsTaxonomy.js`, `jobModel.js` (`normaliseJob`), unit tests. No UI, rules or data changes. | No |
| **CV privacy fix** (between 1 and 2) | Storage rule: a CV can only be opened by its owner or the poster of a job they applied to; existing CVs keep working for their employers. Own plan, own commit, storage rules only. | No (security only) |
| **2 Find work** | Lanes landing (`/jobs`), lane pages (`/jobs/professional`, `/jobs/skilled`, `/jobs/needed-now`), saved jobs (`/jobs/saved`), new filters, extended job detail, save job, report job. All via `normaliseJob()`, old jobs included. Paged feed (30 at a time) needing index `jobListings: status, jobStatus, createdAt desc`. | Yes |
| **3 Post a job wizard** (shipped) | `/jobs/post` + `/jobs/{id}/edit` (5 steps, replaces PostJobModal; per-device autosave), industry (D2) + Browse by industry + Industry filter, Open jobs on the store page, users-record security fix, admin review card shows full new-job content. Store linking stays admin-only (one-off script until a Phase 7 admin tool). | Yes |
| **3 Post a job wizard** | 5-step wizard writing the new shape (§3) plus the legacy fields; drafts; edit vacancy (rules change §5.3). | Yes |
| **4 Candidate profile + apply + My Applications** (shipped) | `/jobs/profile` (4 steps; steps 3–4 optional, "save & finish later"; skilled lane bilingual with trade tiles), one-tap apply when name + mobile + trade/role + city are known (else a 4-field form that also fills the profile), CV optional (no CV → printable "TIN Profile" card for the employer), per-job CVs with live access checks (no saved download links; employer loses access on withdrawal), `stage` + `stageHistory`, `/jobs/applications` with the 6-milestone tracker and interview/offer replies, employer stage moves + interview invite in My Jobs and the Profile page. | Yes |
| **4b AI profile helper** (shipped, §8) | "Fill it for me" on `/jobs/profile`: 5 plain-language questions (Hindi/English/mixed, typed or 🎤 browser voice typing) → `suggestJobProfile` callable → draft marked "suggested" in the wizard → candidate reviews and saves. After the final Save: TIN Profile preview + "Find jobs" / "Apply to this job". | Yes |
| **5a Employer Desk** (built, §5.6b) | `/jobs/desk` for any poster: 4 numbers, vacancy tabs Live/Paused/Filled/Closed, pipeline board (6 columns; phone = one column at a time, tap to move), list + bulk (`BULK_SET`), close vacancy in one confirmed batch, application sheet, Message via TIN Conversations (job linked), candidate "Message employer", business card + more open jobs on the job page. Replaces My Jobs and the Profile page applicant list. | Yes |
| **5 Employer Desk + messaging** | Vacancies, pipeline board, list + bulk, application drawer, find candidates, team (existing org roles), recruitment details. Messaging = TIN Conversations with the job linked via `LINKABLE_ENTITY_COLLECTIONS` (no separate chat). | Yes |
| **6 Emails + notifications** | In-app notifications collection, email sending per `ST[stage].email`, per-person preferences, 10-minute de-duplication. | Yes |
| **7 Admin + career pathway** | Admin alerts, analytics, tables, audit log; career pathway + Career Score. | Yes |

---

## 3. Job data model (`jobListings`)

### 3.1 Fields

All new fields are **optional and additive**. Existing documents are never rewritten.

| Field | Type | Notes |
|---|---|---|
| `lane` | `"professional"` \| `"skilled"` | `LANES` keys. "Needed Now" is **not** stored; it's derived. |
| `functions` | `string[]` | `FUNCS` keys, one or more. |
| `trade` | `string` | `TRADES` key, skilled lane only (the prototype uses the trade as the title). |
| `workTypes` | `string[]` | `TYPES` keys. Any key in `SHORT_TYPES` makes it a short assignment. |
| `headcount` | integer ≥ 1 | "Number of people". |
| `experience` | string | Free text as in the prototype ("2–4 yrs"). |
| `education` | string | Free text, optional ("Any graduate"). |
| `workingHours` | string | "10 am – 7 pm, Mon–Sat". |
| `responsibilities` | `string[]` | One per line in the wizard. |
| `skills` | `string[]` | Wizard input is comma-separated; stored as an array. `normaliseJob` also accepts a string. |
| `shortAssignment` | `{ duration, startDate, urgency, certTools }` | Only for short work types. `urgency` = `URGENCY` key; `startDate` = `YYYY-MM-DD`. |
| `pay` | `{ period, min, max, display, incentives }` | `period` = `PAY_PERIODS` key; `min`/`max` = numbers in ₹ (`max` optional); `display` = `PAY_DISPLAY` key; `incentives` free text. |
| `benefits` | `{ [BENEFITS key]: details }` | Ticked benefits; details may be `""`. |
| `evpText` | string | "Write it yourself" alternative to `benefits`. |
| `industry` | string | `INDUSTRIES` key (decision D2, Phase 3). Prefilled from the linked store's `businessType` or the account role via `BUSINESS_TYPE_INDUSTRY` / `ROLE_INDUSTRY` in `jobsTaxonomy.js`; always editable. Old jobs have none. |
| `storeId` | string | Only when the poster's account has an **admin-set** store link (`users/{uid}.storeId`); rules enforce it. Drives "Open jobs" on `/store/{id}` and the JSON-LD `hiringOrganization.sameAs`. |

**Hidden pay (owner decision, Phase 3):** when `pay.display` is `negotiable` or `undisclosed`, `pay.min` / `pay.max` are **not saved** (null): job docs are publicly readable. Rules reject hidden pay with amounts.

Fields kept exactly as today: `jobTitle`, `description`, `city`, `state`,
`pincode`, `businessName`, `contactPhone`, `postedByUid`, `postedByName`,
`postedByType`, `notAgencyDeclaration`, `status` (moderation:
pending/approved/rejected), `jobStatus` (live/filled/closed), `createdAt`,
`updatedAt`.

### 3.2 Old fields keep working

- **Reading:** `normaliseJob()` handles both shapes (see `src/utils/jobModel.js`):
  - old job → `lane: "professional"`, `isLegacy: true`
  - **exception (owner decision, Phase 2):** an old job whose `category` is **exactly** "Site & Skilled Trades" → `lane: "skilled"` (exact name match only, same principle as the function mapping). No trade is recorded, so it shows under "All trades" only. A stored `lane` always wins.
  - `category` → `functions` **only on an exact label match** ("Sales & Business Development" → `sales_bd`, "Design & Architecture" → `design_architecture`); otherwise kept as `legacyCategory` for display
  - `jobType` → `workTypes` only on an exact match ("Full-time", "Part-time"); "Contract" stays `legacyJobType`
  - `salaryRange` → `pay` via `salaryParser.js`, with guards: shorthand like "25k" / "3 lakh" is treated as unreadable, a monthly amount under ₹1,000 or a yearly amount under ₹12,000 is treated as unreadable, and weekly pay has no period. The original text is always kept in `pay.text` and shown when numbers can't be read.
  - everything an old job never had → `null` / `[]` / `{}`, so the UI hides it
- **Writing (Phase 3):** until every reader uses `normaliseJob()`, the wizard
  also writes the legacy fields so the current screens, admin review, sitemap
  and prerender keep working: `category` (the label of the first function, or
  "Other"), `jobType` (label of the first work type), `salaryRange`
  (`formatPay()` text). New-shape fields win whenever both exist.
- **JSON-LD / prerender (Phase 2):** `jobJsonLd.js` moves onto `normaliseJob()`:
  `employmentType` from `workTypes`, `baseSalary` from structured pay, and
  `experienceRequirements` only when present. Never invented.

### 3.3 `normaliseJob()` output

```
{ id, isLegacy, lane, isNeededNow,
  title, description, responsibilities[], skills[],
  functions[], functionLabels[], legacyCategory,
  workTypes[], workTypeLabels[], legacyJobType,
  headcount, experience, education, workingHours, shortAssignment,
  pay { source: "structured"|"legacy", period, min, max, display, incentives, text },
  payText, benefits {}, evpText,
  city, state, pincode, businessName, postedByName, postedByUid, postedByType, contactPhone,
  status, jobStatus, createdAt, updatedAt }
```

---

## 4. Candidate profile & application stages (design, built in Phase 4)

### 4.1 Identity-first: one profile per TIN user

The job profile hangs off the user's existing TIN account (`uid`). There's no
second login, and the same person can be a candidate and an employer.

**`jobProfiles/{uid}`: shareable part.** Readable by the owner, the admin, and
(since A1, 25 Nov 2026) **employer accounts only when `searchable`** — the person
said yes to "Let employers find and call me" and is looking. Employer lists: 20 at a time.

| Field | Notes |
|---|---|
| `name`, `lane` | lane = `LANES` key |
| `role` (designation), `functions[]` (`FUNCS` keys), `trades[]` (`TRADES` keys) | |
| `experienceYears`, `education` (`EDU` key), `educationText`, `languages` | |
| `skills[]`, `history[] {role, org, years}`, `projects` (skilled) | |
| `city`, `areas` ("where you'll work") | |
| `workTypePrefs[]` | see open decision D3 |
| `availability` (`AVAIL` key), `visibility` (`VISIBILITY` key) | |
| `openToEmployers` (+ `openToEmployersAt`) | true / false; absent = not asked yet. Never assumed |
| `searchable` | `openToEmployers` and `visibility` is one of the 4 looking values; rules refuse any other value |
| `cityKey`, `expBand` | search form of `city` / `experienceYears` (`src/utils/candidateSearch.js`); admin backfill in Launch tools |
| `createdAt`, `updatedAt` | |

**`jobProfilesPrivate/{uid}`: owner only** (since §10 the TIN super admin can also read it).

| Field | Notes |
|---|---|
| `phone`, `email` | never on the public doc |
| `currentPay` | **never** leaves this doc, not even into applications |
| `expectedPay` | copied into an application only when the candidate applies |
| `cv { path, fileName, contentType, size, uploadedAt }` | file in Storage, see 4.3 |
| `emailPrefs { status, msg, contact }` | Phase 6 |

The rules also make sure the public doc can never contain `phone`, `email`,
`currentPay`, `expectedPay` or `cv`.

### 4.2 Applying = a private snapshot to one employer

On apply, the app copies what that employer needs into
`jobApplications/{jobId}_{uid}`, which only the applicant and the job's poster
can read (as today):

- existing fields kept: `jobId`, `applicantUid`, `applicantName`,
  `applicantPhone`, `message`, `resumeUrl`, `resumeFileName`,
  `applicantStatus`, `createdAt`
- new: `applicantEmail`, `resumePath`, `expectedPay`,
  `profileSnapshot { role, lane, experienceYears, education, educationText, skills[], city, availability, history[] }`,
  `stage`, `stageHistory[]`, `updatedAt`, `interview {…}` (Phase 5)

This is how phone, email and CV reach employers the candidate applied to. From
Find candidates (owner decision, 25 Nov 2026, replaces "Request contact"): an
employer can shortlist a candidate who said yes to "Let employers find and call
me" for their own live job; that unlocks phone, email and CV with no accept step.

### 4.3 CVs

- Uploaded under `resumes/{uid}/…` (unchanged path).
- Readable only by the owner, admin, or the poster of a job the owner applied
  to. This is the **CV privacy fix** scheduled between Phase 1 and Phase 2
  (its own plan and commit). It keeps CVs already uploaded readable by the
  employers they were sent to.

### 4.4 Application stages

- New field **`stage`**, holding `ST` keys exactly as in the prototype (`submitted`, `app_viewed`, …).
- **`stageHistory[]`** entries: `{ stage, at, by: "candidate" | "employer" | "system", byUid, note? }`. This drives the timeline and the milestone stepper.
- Legacy **`applicantStatus`** stays readable. The UI reads `stage ?? LEGACY[applicantStatus] ?? "submitted"`:

| Old `applicantStatus` | New `stage` | Why |
|---|---|---|
| `new` | `submitted` | |
| `shortlisted` | `shortlisted` | |
| `rejected` | `not_shortlisted` | The old flow had no interview step, so the early, polite ending fits. |
| `hired` | `offer_accepted` | |

Who may set which stage:

- **Employer** (job poster): `EMP_SET` plus the automatic `app_viewed` / `profile_viewed`, plus `int_invited` / `int_rescheduled` (schedule interview).
- **Candidate:**
  - `withdrawn`
  - `int_scheduled` (accepting an invite), only from `int_invited` / `int_rescheduled`
  - `offer_accepted` / `offer_declined`, only from `offer_sent`
- No one can move an application out of a `FINAL` stage.
- Closing a vacancy moves every open application to `closed`.

---

## 5. Security-rule changes (exact list; applied in the phase shown)

Every rule reading a field that may be missing guards it with
`resource == null ||` or `.get(field, default)`. Each change ships with
emulator tests. Function names (`signedIn()`, `isAdmin()`) are the existing
ones in `firestore.rules`.

### 5.1 Phase 2: saved jobs, reports

```
match /users/{userId}/savedJobs/{jobId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
match /jobReports/{reportId} {            // id = {jobId}_{uid}: one report per person per job
  allow create: if request.auth != null
    && request.resource.data.get("reporterUid", "") == request.auth.uid
    && reportId == request.resource.data.get("jobId", "") + "_" + request.auth.uid
    && request.resource.data.keys().hasOnly(["jobId", "reporterUid", "reason", "createdAt"])
    && request.resource.data.get("reason", "") in ["scam", "asks_money", "misleading", "agency", "other"]
    && exists(/databases/$(database)/documents/jobListings/$(request.resource.data.get("jobId", "")));
  allow read, update, delete: if isAdmin();
}
```

Shipped in Phase 2 as above. Reports are in Admin → Jobs Review since §12.

### 5.2 Phase 3: create with new fields (shipped)

*(Approval replaced by §12.)* The create rule keeps "pending, or approved only for a verified account" and adds `jobFieldsOk()` (lane is professional/skilled; headcount is an int ≥ 1; hidden pay carries no amounts) and `jobStoreIdOk()` (a `storeId` must equal the poster's admin-set `users/{uid}.storeId`). Every field read uses `.get(field, default)`. See `firestore.rules` and `test/rules/jobs-post.test.js`.

### 5.3 Phase 3: poster may edit content of their own listing (shipped)

Shipped as below, plus: `industry`, `storeId` and `notAgencyDeclaration` in the allowed keys; `jobStatus` limited to live/filled/closed; `jobFieldsOk()` on every edit; `jobStoreIdOk()` when `storeId` changes. **Owner decisions** *(replaced by §12: edits stay live)*: an unverified poster's content edit sends a live job back to pending; Live/Filled/Closed-only changes don't; a verified poster's edit stays live. (The old poster rule allowed only `jobStatus`, so My Jobs' Live/Filled/Closed — which also sends `updatedAt` — was failing for posters; fixed.) Original sketch:

```
|| (request.auth != null
    && resource.data.postedByUid == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
         "jobStatus", "updatedAt",
         "jobTitle", "description", "city", "state", "pincode", "businessName",
         "contactPhone", "category", "jobType", "salaryRange",
         "lane", "trade", "functions", "workTypes", "headcount", "experience",
         "education", "workingHours", "responsibilities", "skills",
         "shortAssignment", "pay", "benefits", "evpText", "status"])
    // status may only stay the same or drop back to "pending"
    && (request.resource.data.get("status", "") == resource.data.get("status", "")
        || request.resource.data.get("status", "") == "pending")
    // an unverified poster's content edit goes back to review
    && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get("verificationStatus", "") == "verified"
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(["jobStatus", "updatedAt"])
        || request.resource.data.get("status", "") == "pending"))
```

Also: `jobStatus` gains `"paused"` and `"draft"` (Employer Desk tabs, Phase 5 — the Phase 3 rule still allows only live/filled/closed). The public
feed query (`status == approved && jobStatus == live`) already excludes them.

### 5.3b Phase 3: users record — verification and store link are admin-only (shipped)

```
match /users/{userId} {
  allow create: if request.auth != null && request.auth.uid == userId
    && request.resource.data.get("verificationStatus", "pending") in ["pending", "unverified"]
    && request.resource.data.get("storeId", null) == null;
  allow update: if isAdmin()
    || (request.auth != null && request.auth.uid == userId
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(["verificationStatus", "storeId"]));
}
```

Before this, anyone could set their own `verificationStatus` to "verified" (jobs go live without review) or a `storeId`. No app code writes either field from the client.

### 5.4 Phase 4: candidate profiles

```
match /jobProfiles/{uid} {
  // Tightened in A1: see isSearchable() / searchFieldsOk() in firestore.rules.
  allow get: if owner, admin, or searchable + employer account;  allow list: admin, or searchable + employer account + limit <= 20;
  allow create, update: if request.auth != null && request.auth.uid == uid
    && !request.resource.data.keys().hasAny(["phone", "email", "currentPay", "expectedPay", "cv"]);
  allow delete: if request.auth != null && (request.auth.uid == uid || isAdmin());
}
match /jobProfilesPrivate/{uid} {
  allow read: if isAdmin() || (request.auth != null && request.auth.uid == uid); // admin read: §10
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

### 5.5 Phase 4: applications (create + candidate updates)

Replace the `jobApplications` create rule:

```
allow create: if request.auth != null
  && request.resource.data.applicantUid == request.auth.uid
  && applicationId == request.resource.data.jobId + "_" + request.auth.uid
  && !exists(/databases/$(database)/documents/jobApplications/$(applicationId))
  && exists(/databases/$(database)/documents/jobListings/$(request.resource.data.jobId))
  && get(/databases/$(database)/documents/jobListings/$(request.resource.data.jobId)).data.get("status", "") == "approved"
  && get(/databases/$(database)/documents/jobListings/$(request.resource.data.jobId)).data.get("jobStatus", "") == "live"
  && get(/databases/$(database)/documents/jobListings/$(request.resource.data.jobId)).data.get("postedByUid", "") != request.auth.uid
  && request.resource.data.get("stage", "submitted") == "submitted"
  && request.resource.data.get("applicantStatus", "new") == "new"
  && !("currentPay" in request.resource.data);
```

The `.get` defaults keep today's apply flow (no `stage` field) working during rollout.

Add a candidate update branch:

```
|| (request.auth != null
    && resource.data.applicantUid == request.auth.uid
    && !(resource.data.get("stage", "submitted") in ["not_shortlisted", "offer_accepted", "offer_declined", "not_selected", "withdrawn", "closed"])
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["stage", "stageHistory", "updatedAt", "interviewResponse"])
    && (request.resource.data.get("stage", "") == "withdrawn"
        || (request.resource.data.get("stage", "") == "int_scheduled"
            && resource.data.get("stage", "submitted") in ["int_invited", "int_rescheduled"])
        || (request.resource.data.get("stage", "") in ["offer_accepted", "offer_declined"]
            && resource.data.get("stage", "submitted") == "offer_sent")))
```

### 5.6 Phase 5: employer updates

Replace the poster branch of the `jobApplications` update rule:

```
allow update: if request.auth != null
  && get(/databases/$(database)/documents/jobListings/$(resource.data.jobId)).data.get("postedByUid", "") == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["applicantStatus", "stage", "stageHistory", "updatedAt", "interview"])
  && !(resource.data.get("stage", "submitted") in ["not_shortlisted", "offer_accepted", "offer_declined", "not_selected", "withdrawn", "closed"])
  && request.resource.data.get("stage", "review") in [
       "review", "shortlisted", "not_shortlisted", "contacted", "int_done", "info_req", "assess_req",
       "selected", "offer_sent", "not_selected", "closed",
       "app_viewed", "profile_viewed", "int_invited", "int_rescheduled"];
```

`applicantStatus` stays in the allowed keys so the current My Jobs screen keeps
working until Phase 5 replaces it. Team access (HR Manager / Recruiter acting
for the business) is designed in the Phase 5 plan on top of the existing
`organizations` / `memberships` rules, without changing `tenancy.js` unless
separately approved.

### 5.6b Phase 5a: Employer Desk (built)

- **`jobListings` update:** `jobStatus` may also be `"paused"` (list is now
  live/paused/filled/closed). The feed, sitemap, prerender, store "Open jobs"
  and the apply rule all require `live`, so a paused job leaves search and
  takes no applications; its page still opens by direct link ("isn't taking
  applications right now"), like filled/closed jobs. `"draft"` stays out.
- **`conversations` create:** a personal 1:1 may start `accepted` when it
  carries `viaApplication: "{jobId}_{uid}"` and `applicationLinksPair()` holds:
  that application exists, isn't withdrawn, and its applicant and its job's
  poster are exactly the two participants. **Update:** either participant may
  flip an earlier `requested` thread to `accepted` with the same proof
  (keys `status` + `viaApplication` only). Strangers still get `requested`.
- No rule change for bulk updates or closing: both are batched writes through
  the existing employer branch (employer stages, timeline +1, never out of a
  closed stage), so a batch fully passes or changes nothing.
- Indexes: `jobListings (postedByUid, createdAt desc)` (Desk, 20 per page) and
  `(postedByUid, status, jobStatus, createdAt desc)` (job page "More open jobs").
- Owner decisions (5a): "To reply" = reschedule requests + `int_scheduled`;
  closing as **Filled** keeps Selected / Offer sent / Offer accepted; polite
  notes (English, plus Hindi for skilled-lane jobs) are pre-filled and
  editable; views (D5) and expiry (D6) excluded.
- Code: `src/utils/employerDesk.js` (board columns, counts, bulk/close plans,
  notes; unit-tested), `src/lib/employerDesk.js`, `src/lib/jobMessages.js`,
  `openApplicationConversation()` in `src/lib/conversations.js`, UI in
  `src/components/jobs/desk/`, `/jobs/desk` (`EmployerDeskPage`). Tests:
  `test/unit/employerDesk.test.js`, `test/rules/employer-desk.test.js`.

### 5.7 Phase 6: notifications

```
match /notifications/{id} {
  allow read: if request.auth != null && resource.data.get("toUid", "") == request.auth.uid;
  allow update: if request.auth != null && resource.data.get("toUid", "") == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["read"]);
  allow create, delete: if false; // written by Cloud Functions (Admin SDK) only
}
```

---

## 6. Open decisions

| # | Decision | Needed by | Notes |
|---|---|---|---|
| D1 | **Email service for Phase 6** | Phase 6 | **Open.** TIN has no email sending today. Options to compare when Phase 6 is planned: a transactional email API (e.g. Resend, SendGrid, Amazon SES) called from Cloud Functions, or Firebase's "Trigger Email" extension writing to a `mail` collection. Needs: the sending domain (tinit.in) verified by the owner, monthly cost at expected volume, and Hindi/English templates. The owner decides; nothing is sent until then. |
| D2 | Prototype industries vs TIN business types | Phase 3 | **Decided (Phase 3):** prefill from the linked store's business type, else the account role, via the fixed table in `jobsTaxonomy.js` (Retailer/Distributor/Wholesaler → Retailers, Distributors & Dealers; Manufacturer → Manufacturers; Contractor → General & Specialist Contractors; Architect/Designer → Architects & Interior Design Firms; Consultant → Consultants); otherwise the poster picks. Always editable. |
| D7 | Admin tool to link an account to its store | Phase 7 | Store linking (`users/{uid}.storeId`) is admin-only. Until an admin tool exists, links are made with a one-off script on request. |
| D3 | Candidate work-type preferences | Phase 4 | **Decided (Phase 4):** reuse the job `TYPES` keys. The skilled lane sees only Daily-wage, Project-based, Full-time, Temporary, Fixed-term contractual and On-call (`SKILLED_WORK_TYPES`); the professional lane sees the full list. |
| D4 | City list | Phase 2 | The prototype's 8 cities are sample data. TIN's existing `CITIES` list stays unless decided otherwise. |
| D5 | Job view counts | Phase 5 | The prototype shows views and view→apply rate. Counting views needs a write from every visitor. Decide between a Cloud Function counter or leaving views out. |
| D6 | Vacancy expiry | Phase 5 | The prototype expires vacancies after 30 days, with "Extend 30 days". Needs an `expiresAt` field and a decision on what happens at expiry. |

## 7. Known gaps in today's live code (for the record)

- **CVs:** any signed-in user could read any file under `resumes/`. Fixed after Phase 1
  (owner + admin only; old saved links kept working). Phase 4 closes the forwarded-link
  gap for **new** CVs: they live in `resumes/{uid}/{jobId}/`, open only through a live
  rules check (candidate, admin, or that job's employer while the application isn't
  withdrawn), and no download link is saved. Old CVs keep their saved links.
- **Apply (fixed in Phase 4):** the `jobApplications` create rule didn't check that the job exists, is live,
  or that the status starts as "new". Fixed in Phase 4 (§5.5).
- **Editing:** posters couldn't edit job content (rules allowed `jobStatus` only, and not
  even `updatedAt`). Fixed in Phase 3 (§5.3).
- **Self-verification:** users could set their own `verificationStatus` / `storeId`.
  Fixed in Phase 3 (§5.3b).
- **Store verified badge:** whoever added a store (`contributorId`) could set its
  `verificationStatus`, and anyone could create a store already marked verified.
  Fixed separately after Phase 3: only the admin sets `verificationStatus` /
  `verifiedAt` / `verifiedBy`, and `contributorId` can't be changed by the contributor
  (`test/rules/stores-verification.test.js`).
- **GST Verified badge (future fix):** `AddPage.jsx` sets `gstVerified` (the store page's
  "🏛 GST Verified" badge) and `gstVerifiedData` from the browser after its own GST
  lookup, so the badge can be faked by writing those fields directly. Fix: move the GST
  check to the server (a Cloud Function that looks up the GSTIN and writes
  `gstVerified` / `gstVerifiedData` with the Admin SDK), then make both fields
  admin/server-only in `firestore.rules`. Not started.
- **Pay parsing:** `salaryParser.js` reads "₹25k" as ₹25 for JSON-LD `baseSalary`. Phase 2
  moves JSON-LD onto `normaliseJob()`, which treats shorthand as unreadable.

## 8. Phase 4b — AI profile helper (built)

**Goal:** a mason or helper who finds forms hard can answer about five simple
questions — typed or dictated, in Hindi, English or a mix — and get a profile
draft to check and save. **Suggest, then confirm:** nothing is ever saved
without the candidate pressing Save on the review screen.

**Flow (in `/jobs/profile`, "Fill it for me" button):**
1. Five short questions, shown one at a time, bilingual, each with an example:
   1. "What work do you do?" · "आप कौन सा काम करते हैं?"
   2. "How many years have you done this work?" · "कितने साल से यह काम कर रहे हैं?"
   3. "What kind of work have you done? (sites, buildings, shops…)" · "आपने कहाँ-कहाँ, कैसा काम किया है?"
   4. "Which areas can you work in, and which languages do you speak?" · "किन इलाकों में काम करेंगे, कौन सी भाषा बोलते हैं?"
   5. "What kind of work do you want, and when can you start?" · "कैसा काम चाहिए, कब से शुरू कर सकते हैं?"
2. The answers go to a callable Cloud Function, which returns a **draft** in the
   profile shape (taxonomy keys only).
3. The wizard opens with the draft filled in and every AI-filled field marked
   "suggested". The candidate edits anything, then presses **Save**, the normal
   `saveJobProfile` path and rules.

**Cloud Function `suggestJobProfile`** (`functions/ai.js`, same setup as today):
- `onCall({ region: "asia-south1", secrets: [OPENAI_API_KEY], enforceAppCheck: false, cors: true })`,
  requiring `request.auth`.
- Input: `{ answers: string[5], lane?: "professional" | "skilled" }`. Each answer is
  trimmed to 500 characters, and the request is rejected if the total is over 2,500.
- **Privacy:** only these five work answers are sent to OpenAI. The function
  never reads `jobProfilesPrivate` or `users/{uid}`, and never sends a name,
  phone, email or pay. Answers are also scrubbed of anything that looks like a
  phone number or email before sending (regex), and are not stored.
- Model: `gpt-4o-mini` (the `fast` tier in `packages/ai-foundation`), with
  `response_format: json_schema`. The schema allows only fields of the profile,
  with `trades` / `functions` / `workTypePrefs` / `availability` / `education`
  restricted to taxonomy keys (enum) and `experienceYears` a number 0–60.
- The server validates the output again through `splitProfile()`-style
  filtering (unknown keys dropped), so the AI can never add fields or invent
  options. Fields it isn't sure of come back empty, never guessed.
- Returns `{ draft, notes }`. `notes` is one plain-language line per field it
  couldn't fill ("Experience not mentioned"). Nothing is written to Firestore.

**Rate limits:**
- **Per user:** at most 5 calls per day and 20 per month, counted in
  `aiUsage/{uid}` (written only by the function with the Admin SDK; rules deny
  client writes).
- **Global:** at most 2,000 calls per day across TIN (`aiUsage/_global`), with
  a clear "try again tomorrow" message when reached.
- The client button is disabled while a call is running; OpenAI's timeout is 20 s.

**Cost per call (re-checked 2026-11-19, measured on the emulator with the real key):**
- gpt-4o-mini list price, checked on OpenAI's model page: **$0.15 per million
  input tokens, $0.60 per million output tokens** (unchanged).
- Measured: about **1,720 input tokens** per call (instructions + option lists
  + schema + answers; more than the 1,200 first guessed, because the option
  lists are in the prompt) and **60–115 output tokens** (far less than the 350
  guessed). Logged per call as `[suggestJobProfile] tokens` (counts only).
- That's about **$0.0003 per call ≈ ₹0.03** (at roughly ₹90 per $; worst case
  with 350 output tokens ≈ $0.0005 ≈ ₹0.04). At the 5-calls-a-day cap: under
  ₹0.25 per person per day.
- 10,000 calls ≈ ₹300 (worst case ≈ ₹420). The global cap of 2,000 calls a day
  limits the worst possible OpenAI spend to about **₹85 a day**.
- Cloud Functions invocation cost is negligible at this volume.

**⚠ gpt-4o-mini shuts down on Jan 14, 2027** (OpenAI deprecations page,
notice dated Oct 14, 2026: `gpt-4o-mini-2024-07-18`, its only snapshot;
recommended replacement **gpt-6-luna**). Both AI features use it today, so
both must move before that date. Avoid gpt-5-mini / gpt-5-nano (shut down
Dec 11, 2026) and gpt-4.1-mini (also Jan 14, 2027).

**Model settings (one per feature, `functions/.env`, not secret):**

| Feature | Function | Model | Reasoning effort |
|---|---|---|---|
| Message classifier | `onMessageCreate` | `AI_CLASSIFIER_MODEL` | `AI_CLASSIFIER_REASONING_EFFORT` |
| Profile helper | `suggestJobProfile` | `AI_PROFILE_MODEL` | `AI_PROFILE_REASONING_EFFORT` |

Each prompt names its own setting (`modelTier` in its prompt file), resolved
by `packages/ai-foundation/providers/openai/modelConfig.js`. Changing one pair
never changes the other feature. Reasoning effort is sent only when set.
To switch: edit the one line, then redeploy only that function.

**Switch plan (each step: emulator check → results to owner → OK → deploy that one function):**
1. **Profile helper first** — `AI_PROFILE_MODEL=gpt-6-luna`,
   `AI_PROFILE_REASONING_EFFORT=none` (it's a reasoning model; the default
   "medium" would add billed reasoning tokens and delay). Repeat the emulator
   check with mixed Hindi–English answers: strict option lists honoured,
   experience 0–60, phone/email scrubbed, notes instead of guesses. Compare
   speed and cost per call with gpt-4o-mini side by side (same answers).
   Expected: $0.10 / $0.50 per million tokens → about ₹0.02 per call (vs ₹0.03).
   **✅ Done 2026-11-19** (owner approved; `suggestJobProfile` deployed on
   gpt-6-luna). Emulator comparison, 5 mixed Hindi–English answer sets × 2
   runs per model, warm, real key; a direct call confirmed gpt-6-luna with
   0 reasoning tokens and that it accepts the strict schema (incl. 0–60):

   | | gpt-4o-mini | gpt-6-luna (effort "none") |
   |---|---|---|
   | Speed, median (min–max) | 2.09 s (1.41–2.27) | 2.15 s (1.97–5.69, one slow call) |
   | Tokens per call in / out | 1,717 / 95 | 1,713 / 113 |
   | Cost per call | $0.000314 ≈ ₹0.028 | $0.000228 ≈ ₹0.021 (−27%) |
   | Option lists respected | 10/10 | 10/10 |
   | Phone + email scrubbed | ✅ | ✅ |
   | "sau saal" (100 yrs) experience | ❌ 0.5 (taken from another answer) | ✅ empty + note |
   | 3 answers skipped | ✅ 5 notes, no guesses | ✅ 5 notes, no guesses |
   | "Mumbai aur Pune" → city | guessed Mumbai | left empty (areas filled) |
   | Company history (Kajaria) | not filled | ✅ filled |
   | Run-to-run option changes | 2 of 5 cases | 2 of 5 cases |

   The comparison also found that the AI could fill fields the lane's wizard
   doesn't show (e.g. skills for a skilled worker), saved unseen; fixed first
   in `applyDraft()` (only fields the lane's wizard shows), commit 549f67c.
2. **Message classifier after its own check** — same way with
   `AI_CLASSIFIER_MODEL` / `AI_CLASSIFIER_REASONING_EFFORT`, on representative
   conversation messages (intent + suggested action + confidence threshold).
3. Target: both switched by **mid-December 2026**, leaving a month of margin.
   Re-check prices and the deprecations page before each step.

**As built (details the design above didn't fix):**
- Code: `packages/ai-foundation/jobProfile/suggest.js` (scrub, input checks,
  strict schema, output filter, notes) and `jobProfile/rateLimit.js` (pure
  counter logic, India time); prompt `prompts/job-profile-suggestion/1.0.0.json`;
  the callable in `functions/ai.js` (`invoker: "public"` and a 60 s timeout,
  like the other callables); UI `src/components/jobs/ProfileHelper.jsx`,
  `src/hooks/useSpeechInput.js`, `src/lib/jobProfileAi.js`, `applyDraft()` in
  `src/utils/jobProfile.js`.
- The option lists live in the web app (`src/data/jobsTaxonomy.js`, an ES
  module), but only `functions/` is uploaded, so `scripts/vendor-ai-foundation.js`
  (the existing predeploy build) also writes `functions/vendor/jobsTaxonomy.json`.
  A unit test checks it matches the app's lists.
- The OpenAI adapter gained an optional options argument (timeout 20 s, no
  retries, throw on error). Without it the request is exactly as before, so
  `onMessageCreate` is unchanged.
- `aiUsage/{uid}`: `profileDay`, `profileDayCount`, `profileMonth`,
  `profileMonthCount`, `updatedAt`; `aiUsage/_global`: `profileDay`,
  `profileDayCount`, `updatedAt`. Counted in one transaction **before** the
  OpenAI call, so a failed or timed-out call still counts (abuse can't bypass
  the limit by forcing errors). Rules: `allow read, write: if false`.
- `notes` are built by the server from the empty fields (bilingual), not by the
  model, so they're always accurate.
- The candidate's own lane always wins; the AI's lane is used only when none
  was chosen. Draft values replace the wizard's values only for fields the
  draft actually filled, and never name, phone, email, pay, CV or visibility.
- **Voice input:** 🎤 per question, browser Web Speech API. Skilled lane tries
  `hi-IN` then `en-IN`; professional lane tries `en-IN` then `hi-IN`
  (English-first lane). The text lands in the answer box for editing; the
  button is hidden where the browser has no speech recognition. TIN never
  receives or stores audio (in Chrome, the browser's own speech service does
  the recognition).
- **Language order:** skilled lane Hindi-first with big buttons; professional
  lane English-first. No lane yet → the helper asks first (two big buttons).
- **After the final Save:** "Your profile is ready" with the TIN Profile card
  employers see, a primary "Find jobs" (to the lane page) and, when the page was
  opened from the apply sheet's "Edit profile" link (`?job=<id>`), a primary
  "Apply to this job".

**Tests (built):** `npm run test:functions` (auth + firestore + functions
emulators under the `demo-tin-test` project, no OpenAI key): refuses
unauthenticated calls and bad input, blocks call 6 of the day, writes nothing to
the profile. Package tests (`packages/ai-foundation/tests/jobProfile*.test.js`),
`test/unit/jobProfileAi.test.js` and `test/rules/ai-usage.test.js` cover the
items below. Originally specified: emulator test that the function refuses unauthenticated
calls; unit tests that the output filter drops unknown keys and non-taxonomy
values, that phone/email scrubbing works, and that the rate-limit counter
blocks call 6 of the day. A manual check with mixed Hindi–English answers.

## 9. Launch (22 Nov 2026) — week-1 follow-ups

Items deliberately left out of the launch pack, to do in the first week after launch:

1. **Lock public store reads; move "Find your business" search to a server function.**
   Today `match /stores/{storeId}` is `allow read: if true`, so imported stores that are
   hidden from the site (L2a: sitemap, prerender, `/store/:id` "not available") can still
   be read straight from the Firestore API. Fix: make store reads public only for public
   stores (verified / claimed / linked / not imported — same rule as
   `src/utils/storeVisibility.js`, which needs a store-level `isPublic` flag kept in sync,
   since rules can't read `users/*.storeId` cheaply), and move the L2b search
   (`src/lib/storeClaims.js` `searchStoresForClaim`) into a callable function that returns
   only id, name, city, address and business type of matching stores, rate-limited per user.
   The claim, admin approval and owner-edit flows don't change.

## 10. TIN Jobs Admin (super admin dashboard)

Admin panel → **TIN Jobs Admin**, shown only to the TIN super admin (the signed-in
account's email, `src/lib/superAdmin.js` — not `users.role`, which people can write
themselves). Owner decision (23 Nov 2026): super admin means that ONE account — not
hom_admin, business owners/admins, staff, or any delegated role added later
(`test/rules/jobs-admin-roles.test.js`). Summary cards; Overview (businesses waiting for approval, recent
activity), Businesses, Job Seekers and Jobs tabs with search, filters and Excel download;
a page per candidate and per job. Read-only except approve / reject and job
pause / resume / close / delete (25 Nov 2026).

- **Job seeker** = has a job profile or applied to a job. **Employer** = posted a job, or
  a business account (retailer role or linked store, as in `utils/jobRoles.js`).
  One account can be both. **Shortlist** = contact unlocked (`isContactUnlocked`).
  `x/10` on a job = slots used (`shortlistCount`) / `config/pricing.shortlistLimit`.
- **Business** = an employer account, someone claiming a business, or a store page no
  account covers (never a bulk-imported listing nobody verified or claimed). There is no
  "approved" field: **approved** = account verified, store verified, or store linked by TIN;
  **pending** = pending claim or self-listed store still `community_added`; **rejected** =
  store rejected or latest claim rejected; otherwise **not verified** (`buildBusinesses`).
- **Approve / reject** reuses `storeClaims.approveClaim/rejectClaim` and
  `storeVerification.verifyStore/rejectStore` (moved out of AdminDashboard, same logic).
- **Profile complete** = `isApplyReady` (name, mobile, role/trade, city).
- **Pause / close** = the Employer Desk's `setJobStatus` / `closeVacancy` (the employer can
  reopen). **Delete** closes the open applications first, then deletes the job document;
  applications and shortlist slots stay. No rules or index change was needed
  (`test/rules/jobs-admin-actions.test.js`).
- **Rules:** admin read added on `users/{uid}` and `jobProfilesPrivate/{uid}`; the other
  reads (jobs, applications, contact, profiles, every resume path) already allowed the
  admin. Employers' and candidates' access is unchanged (`test/rules/jobs-admin.test.js`).
- **Resumes** open through the Firebase Storage download URL, requested on click. Such a
  URL carries its own key: anyone holding it can open the file until the file or its token
  is removed, so exported sheets must be kept private.
- Files: `src/utils/jobsAdmin.js` (pure), `src/lib/jobsAdmin.js` (reads),
  `src/components/admin/jobsAdmin/`.

### 10.1 "Mark as hired" (25 Nov 2026)

Stage `hired`: the employer sets it, only from `selected` or `offer_sent` (rules + `HIRE_FROM`). Final, like
`offer_accepted`; both count in the Desk's **Hired**. Contact and CV stay open. The candidate sees it in My
applications.

## 11. Skilled-worker login by one-time code (B2)

Skilled workers sign up (`/signup/skilled`) and log in on a new phone (`/login/otp`) with an
SMS code, no password. Professionals and employers keep email / mobile + password (owner
decision, 25 Nov 2026). `FEATURES.skilledOtp` switches it off. After sign-in Firebase keeps the
person signed in on that phone, so a code is needed only on a new one.

- **Identity = the phone number on the Firebase account** (`+91…`), not the provider.
- **Screens → `src/lib/otp` → one provider.** `sendOtp(phone)` gives a session with
  `confirm(code)`; errors are the fixed list in `src/utils/otp.js`. Today: `firebaseProvider.js`.
- **To change provider** (MSG91, WhatsApp OTP via DLT…): no screen, account or rule changes.
  1. Two callable functions: `sendCode({ phone })` (DLT template, per-number and per-IP limits)
     and `checkCode({ phone, code })`, which after a correct code finds the account with
     `getUserByPhoneNumber("+91…")`, or makes it with `createUser({ phoneNumber })`, and returns
     `createCustomToken(uid)`. The functions' service account needs the *Service Account Token
     Creator* role for that.
  2. `src/lib/otp/<name>Provider.js` with `send(phone)`: calls them, then
     `signInWithCustomToken(auth, token)` in `confirm`, mapping errors to `OtpError`.
  3. Add it to `PROVIDERS` in `src/lib/otp/index.js` and name it in `src/data/otp.js`.
- **Older password accounts** (`{number}@phone.tinit.in`, number never checked): a code alone never
  opens one. After the code, the old password is asked for once and `joinPhoneAccount`
  (`functions/phoneAccounts.js`) puts the number on the old account and removes the empty phone
  one. Business and professional accounts are told to use their password. "Not mine / forgot" makes a
  new account and leaves the old one alone.
- **Firebase console:** Phone sign-in on, SMS region policy India only, authorised domains.

## 12. Beta mode, and jobs checked after posting (owner decision, 25 Nov 2026)

**One switch:** `config/pricing.betaMode` (Admin → Pricing). ON unless it is exactly `false`; only the
TIN admin writes it. Read by the rules (`betaMode()` / `shortlistLimit()`), by `shortlistCandidate`
(`shortlistLimitNow` / `searchDailyLimitNow` in `src/utils/shortlist.js`) and by the screens.

| | Beta ON (now) | Beta OFF (paid version) |
|---|---|---|
| Shortlists per job | no limit | `shortlistLimit`, default 10 |
| Shortlists from search per employer per day | no limit | `searchShortlistDailyLimit`, default 20; 0 = search shortlisting off |
| Job TIN has checked needed to shortlist from search | no | no |
| Price of a profile / job post | free | Pricing page: list / offer price, launch discount (no payments built yet) |
| Contact unlock at Shortlisted (L8) | yes | yes |
| Slots, `shortlistCount`, daily count | recorded | recorded and enforced |

Switching OFF applies at once to what beta counted: a job past the limit can't shortlist anyone new, but keeps
the people it has. In beta the 0 setting doesn't stop search shortlisting.

**Posting:** every new job is `approved` + `live`, verified account or not; edits stay live and never go back to
pending. The poster can't change `status`. `createdAt` must be the server's time, and `verified_business` is
accepted only from a verified account. A pending job is still accepted from pages opened before the change.

**Checking afterwards** (Admin → Jobs Review, `src/lib/jobModeration.js`): new jobs newest first; job reports, most
reported first (`checkedAt` marks them done); **Approve all pending jobs** for those sent before beta. No automatic
hiding after reports.

- **Take down:** `status: "taken_down"` + `takedown: { reason, at }`, shown to the employer. Hidden from the public,
  and the poster can't read or change its applications, contacts or CVs (`isActivePoster()` in both rules files)
  until **Restore**. Details already seen, and chats already started, can't be taken back. `rejected` (before beta)
  counts as taken down. Restoring or approving keeps a job the employer had closed closed.
- **Block from posting:** `users/{uid}.postingBlocked` (+ `postingBlockedReason`, `postingBlockedAt`), admin only.
  Blocks new jobs, edits, reopening and shortlisting from search; pausing and closing still work. Jobs already up
  stay up until taken down.
- **Employer closes a job** at any time from the Desk ("Close job"), also one still waiting.
- **Google:** the sitemap and job data cover only approved + live jobs, at each hosting build. Between builds the page
  itself drops its job data and asks not to be indexed once the job isn't live.

**Future options:** a daily posting limit per account after beta (would need posting to go through a server function);
automatic hiding after several reports; search shortlisting only for checked jobs or verified businesses.
