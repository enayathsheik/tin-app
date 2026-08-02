# Business Objects Contract — Phase 1 Foundation

Design contract for the canonical Business Object model. This slice defines the
shape and proves permissions for exactly ONE type (`ledger_entry`). It is
**additive and parallel** to the existing AI Foundation Layer
(`suggestedActions` / `ledgerEntries` / `milestones` / `snags`) — nothing
existing is touched, migrated, or deprecated by this document. The org-only
`ledgerEntries` path stays live and unchanged.

Nothing writes to `businessObjects` yet. `confirmSuggestedAction` is not wired
to this collection in this slice — that is a deliberately separate, later step
requiring its own review.

## Discrepancies found before writing this (per task instruction)

- `docs/AI_FOUNDATION_CONTRACT.md` §8 describes the `suggestedActions` /
  `ledgerEntries` read rule as gated only by `isConversationParticipant()`.
  Live `firestore.rules` additionally requires `canReadAiRecord()` (an
  `ownerUid`/`orgId` scope check) — the contract doc predates that change.
  This document was written against live `firestore.rules`, not the stale doc.
- No store-membership primitive exists anywhere in the schema. `stores/{storeId}`
  is `allow read: if true` with a single `contributorId` field for write
  ownership — there is no multi-user "linked to this store" concept to reuse.
  See "Design decisions" below — this is intentionally left as-is.

## Why this collection exists

A confirmed AI suggestion should become **one** persistent record, not a
record duplicated/re-owned per screen. Personal, org, store, project, and
conversation views are all just *queries* over the same `businessObjects`
collection, filtered by different `scopeTags`. This is what lets the
personal/org distinction dissolve: it's not two data models, it's one record
with more than one tag set on it.

## Canonical shape — `businessObjects/{objectId}`

| Field | Type | Notes |
|---|---|---|
| `type` | string enum | Only `'ledger_entry'` exists in this slice. Closed set, extend later. |
| `status` | string enum | `'active'` (only value ever written in this slice) or `'voided'` (reserved for a future non-destructive correction flow — no code writes this yet). |
| `originConversationId` | string | The conversation the source message lived in. |
| `originMessageId` | string | The message that triggered the original AI suggestion. |
| `sourceActionId` | string | The `suggestedActions/{id}` this object was confirmed from. One-to-one lookup back to the AI's reasoning/evidence/confidence. |
| `createdBy` | string (uid) | Whoever triggered the confirm. |
| `createdAt` | Timestamp | Server timestamp. |
| `linkedEntities` | array of `{kind, id}` | `kind` ∈ `'store' \| 'project' \| 'organisation' \| 'person'`. Links to DOMAIN objects (an existing `stores/{id}`, `organizations/{id}`, etc.) — a linkedEntity reference never *becomes* a domain object, and a domain object is never duplicated into `businessObjects`. This is the Business/Domain split: `businessObjects` are events/records; `stores`/`organizations`/etc. remain the things those records point at. (Note: this `kind` enum spells it `'organisation'` for the domain-object reference; the scope tag below is `orgId`, matching the rest of the schema's field-naming convention — these are two different things, a linked-entity kind label vs. a permission field name, and are allowed to diverge.) |
| `scopeTags` | map | Denormalized, flat permission surface — see below. Always written with all five keys present (possibly null/empty), never partially, so rules can use cheap `.get(key, default)` checks uniformly. |
| `payload` | map | Type-specific. See `ledger_entry` shape below. |

### `scopeTags` (the permission surface)

| Key | Type | Set when |
|---|---|---|
| `ownerUid` | string \| null | Personal-origin only — the individual who owns this record. |
| `orgId` | string \| null | Org-origin only. Named `orgId` (not `organisationId`) to match every other collection in the schema (`conversations.orgId`, `suggestedActions.orgId`, `ledgerEntries.orgId`, `memberships.orgId`) — no collection uses a different name for the same concept. |
| `storeId` | string \| null | Set only if a `linkedEntities` entry of kind `'store'` exists at write time (denormalized for cheap read-rule filtering — not authoritative, `linkedEntities` is). |
| `projectId` | string \| null | Same denormalization pattern as `storeId`, for a `'project'` linked entity. **Schema-only in this slice — see "Design decisions," no read-rule branch grants access via this key yet.** |
| `participantUids` | array of string | Personal-origin only — every participant of `originConversationId` at confirm time. Always populated for personal-origin records regardless of `type`, even though the current read rule only grants access via it for non-`ledger_entry` types (see below) — kept on every doc so a future shared type doesn't need a backfill. |

**Personal-origin entry**: `ownerUid` set to the confirming user, `participantUids` set to the conversation's full participant list, `orgId: null`.

**Org-origin entry**: `orgId` set, `ownerUid: null`, `participantUids: []`.

This is the intentional design decision that dissolves the personal/org
question: same collection, same rule, different tag values — not a branch in
the data model, only in what's populated.

### Read grant is per-`type`, not uniform across all scope tags

**Decision**: for `type == 'ledger_entry'`, a personal-origin record is
readable by `ownerUid` **only**. The other 1:1 participant, though present in
`participantUids`, is **denied** read. Reasoning: a ledger is private books,
not shared two-party truth — the fact that both people were in the
conversation that produced the entry doesn't mean both should see the
resulting financial record.

`participantUids` stays a first-class scope tag on every personal-origin
record regardless of type, because future object types (e.g. a `commitment` —
something both parties in a 1:1 explicitly agreed to) SHOULD be readable by
both participants. The read rule (`canReadBusinessObject` in `firestore.rules`)
implements this as an explicit type gate:

```
tags.get('ownerUid', null) == request.auth.uid
  || (data.get('type', null) != 'ledger_entry' && request.auth.uid in tags.get('participantUids', []))
  || ...
```

**This means read behavior differs per `type`, by design, and any new type
added later must make its own explicit call here** — don't assume a new
type inherits `ledger_entry`'s owner-only behavior, and don't assume it
inherits shared-by-default behavior either. Decide and encode it in this same
function, one type-branch at a time.

### `payload` for `type: 'ledger_entry'`

Checked against the actual doc shape a real `confirmSuggestedAction` call
writes to `ledgerEntries` today (verified empirically against a live doc,
`ledgerEntries/W4SpRfPbAVAwhDrtmca2`):

```js
{
  amount: number | null,
  invoiceNumber: string | null,
  dueDate: string | null,
  description: string | null,
}
```

**Deliberate deviation from a byte-for-byte mirror**: the live `ledgerEntries`
doc also carries `milestoneTitle`, `milestoneDate`, `snagDescription`,
`snagSeverity`, `projectName`, `referenceDescription`, `referenceUrl` — all
always `null` for a `log_ledger_entry` action. These are artifacts of
`suggestedActionPayload` being one flat union schema across all six action
types (`suggestedActionSchema.js`), not meaningful ledger data. The canonical
`ledger_entry` payload here carries only the four fields that are ever
non-null for this type. If a future `businessObjects` type needs its own
fields, it gets its own payload shape — the union-schema noise is not
propagated into the canonical model.

## Example doc

```js
// businessObjects/bo_abc123
{
  type: "ledger_entry",
  status: "active",
  originConversationId: "personal_2XseX8..._FGXUFf...",
  originMessageId: "LY4IuS8SxHEH7EGxyG7a",
  sourceActionId: "MlHSPf7vaPOEef7Q1iBr",
  createdBy: "FGXUFfXrgMbsf6sGM1YP7LzzU0R2",
  createdAt: <Timestamp>,
  linkedEntities: [],
  scopeTags: {
    ownerUid: "FGXUFfXrgMbsf6sGM1YP7LzzU0R2",
    orgId: null,
    storeId: null,
    projectId: null,
    // Present for a future shared type's read grant, but NOT consulted for
    // read access on this doc — type is 'ledger_entry', owner-only applies.
    participantUids: ["2XseX8BSSmZrRtySye9eosHh86f1", "FGXUFfXrgMbsf6sGM1YP7LzzU0R2"],
  },
  payload: { amount: 22000, invoiceNumber: null, dueDate: null, description: "Collection pending for Mustafa bhai - 22k." },
}
```

## Design decisions (deliberate, not gaps to fix later unless noted)

1. **`storeId` read-grant is a deliberate single-owner placeholder, not a
   stopgap.** No store-membership list exists; the rule reuses
   `stores/{storeId}.contributorId` — the single-owner field — as "linked to
   the store." This is correct as-is for today's real-world shape (single-owner
   retailers) and is not being built out further in this slice. **Do** extend
   it with a real membership check if/when multi-user stores become a real
   concept in this product — until then, this is the intended behavior, not
   technical debt.
2. **`projectId` has no read-grant branch at all in this slice.** The field is
   reserved in `scopeTags` for a future project-scoped query, but per the
   explicit rule spec for this slice, only `ownerUid`, `participantUids`
   (type-gated, see above), `orgId`, and `storeId` are checked. A
   project-origin business object would currently only be readable via one of
   the other tags (e.g. if it also happens to carry `orgId`) until a project
   read-grant is explicitly designed.
3. **`orgId` naming matches the rest of the schema** (see `scopeTags` table
   above) — no separate `organisationId` concept exists anywhere in this
   collection or its rules/tests.

## Out of scope for this slice (explicit)

- No `confirmSuggestedAction` wiring — nothing writes `businessObjects` yet.
- No UI/views reading this collection.
- No deploy.
- No migration of existing `ledgerEntries` docs into this collection.
- No store team/multi-user access system — see Design decision 1.
