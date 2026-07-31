// Conversations — canonical read/write helpers for the messaging surface.
//
// conversations and messages are TOP-LEVEL collections (not subcollections of
// organizations) so the onMessageCreate trigger, bound to messages/{messageId},
// keeps firing regardless of tenant nesting. See functions/ai.js and
// functions/vendor/ai-foundation/context/builder.js — the message content
// field is `text` (not body/content/message) and the fields the AI context
// builder reads are exactly: conversationId, senderUid, senderOrgId, text,
// createdAt. Every write below matches that shape; never rename `text`.
//
// See firestore.rules for the matching tenant-isolation + scope rules
// (canAccessConversation, isActiveMember) these shapes are designed against.
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion,
  query, where, orderBy, limit, startAfter, onSnapshot,
  serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";

const CONVERSATIONS = "conversations";
const SUGGESTED_ACTIONS = "suggestedActions";
const MESSAGES = "messages";
const CONVERSATION_META = "conversationMeta";

// Entity types with a real collection + page in TIN today — matches
// ContextRail's ENTITY_RENDERERS allowlist. Anything else can't be linked
// yet (no collection to verify against).
const LINKABLE_ENTITY_COLLECTIONS = { store: "stores", job: "jobListings" };

const MESSAGE_TYPES = ["text", "image", "file", "reference"];

// Human-readable label for a conversation, derived from the participantNames
// map denormalized onto the doc at creation time (see getOrCreatePersonalConversation
// / createGroupConversation — users/{uid} is self-read-only, so this is the
// only place a name for another participant is ever available).
export function conversationTitle(conv, currentUid) {
  const names = conv.participantNames || {};
  const otherUids = (conv.participantUids || []).filter(uid => uid !== currentUid);
  if (conv.type === "direct") {
    const otherUid = otherUids[0];
    return names[otherUid] || otherUid || "Direct message";
  }
  const otherNames = otherUids.map(uid => names[uid] || uid);
  return otherNames.length ? otherNames.join(", ") : "Group conversation";
}

// ── CONVERSATION CREATE ──────────────────────────────────────

// Deterministic id ("personal_{sorted uid pair}") prevents both a duplicate
// thread AND a second request forking around the accept state — a repeat
// call always lands on the same doc, whatever status it's already in.
// Org-agnostic: no orgId is resolved or required on either side (replaces
// both the old intra-org getOrCreateDirectConversation and the Admin-SDK
// createExternalConversation callable, which existed only to resolve each
// side's single active org — irrelevant now that personal-context auth is
// participantUids-only, see firestore.rules canReadConversation).
//
// First contact between two people is born status:'requested' — one-way,
// only `currentUid` (createdBy) may send until the counterparty accepts via
// acceptPersonalConversation below (firestore.rules enforces this, not just
// this helper). Idempotent: if the pair already has a conversation (any
// status, including a prior 'accepted'), that existing doc is returned as-is
// — a repeat "connect" attempt never resets an already-accepted thread back
// to 'requested'. `names` is an optional { [uid]: displayName } map,
// denormalized here because users/{uid} is self-read-only in firestore.rules.
export async function getOrCreatePersonalConversation({ currentUid, counterpartyUid, names = {} }) {
  if (!currentUid || !counterpartyUid) throw new Error("getOrCreatePersonalConversation: currentUid, counterpartyUid required");
  if (currentUid === counterpartyUid) throw new Error("getOrCreatePersonalConversation: cannot start a conversation with yourself");

  const id = `personal_${[currentUid, counterpartyUid].sort().join("_")}`;
  const ref = doc(db, CONVERSATIONS, id);
  const existing = await getDoc(ref);
  if (existing.exists()) return { id, ...existing.data() };

  const data = {
    context: "personal",
    type: "direct",
    scope: "personal", // denormalized/historical only — not consulted for personal-context auth
    status: "requested",
    orgId: null,
    participantUids: [currentUid, counterpartyUid].sort(),
    participantNames: names,
    linkedEntities: [],
    createdBy: currentUid,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id, ...data };
}

// Recipient-only accept: flips a first-contact personal conversation from
// one-way 'requested' to two-way 'accepted'. firestore.rules'
// canUpdatePersonalConversation enforces that only a participant OTHER than
// createdBy (the initiator) can do this — the initiator can't self-accept.
export async function acceptPersonalConversation({ conversationId }) {
  if (!conversationId) throw new Error("acceptPersonalConversation: conversationId required");
  await updateDoc(doc(db, CONVERSATIONS, conversationId), { status: "accepted" });
}

// Group personal conversations (venture/friend groups, not org teams) have
// no accept-gate in Phase 1 — born directly 'accepted', same as before.
export async function createGroupConversation({ orgId, currentUid, participantUids, scope = "personal", teamId = null, names = {} }) {
  if (!orgId || !currentUid || !participantUids?.length) {
    throw new Error("createGroupConversation: orgId, currentUid, participantUids required");
  }

  const uniqueParticipants = Array.from(new Set([currentUid, ...participantUids]));
  const ref = doc(collection(db, CONVERSATIONS));
  const data = {
    context: "personal",
    orgId,
    type: "group",
    scope,
    status: "accepted",
    participantUids: uniqueParticipants,
    participantOrgIds: [orgId],
    participantNames: names,
    teamId,
    linkedEntities: [],
    createdBy: currentUid,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

// ── CONVERSATION LIST (paginated, participant/tenant scoped) ────
//
// Firestore evaluates list-query security rules statically against the
// query's own `where` filters, not per fetched document — every field the
// read rule branches or depends on must be pinned by a filter, or the
// entire list request is denied even though each individual doc would pass
// a plain get(). firestore.rules' canReadConversation branches on `context`:
//   - context == 'personal': auth.uid in participantUids alone. No orgId
//     dependency at all — org-agnostic by design (see
//     getOrCreatePersonalConversation) — so this is the ONE query that
//     covers what were two separate provable queries (scope 'external' and
//     'personal') before the context collapse. It also needs no `orgId`
//     filter, so it works identically for a zero-org user.
//   - context == 'organization': isActiveMember(orgId) required, plus
//     scope == 'org' | 'team' sub-rules. The "Org group" toggle below is
//     this query, separately provable, unchanged from before.
//
// Personal inbox = one query, no cursor merge needed anymore.

function personalInboxQuery({ uid, pageSize, cursor }) {
  const constraints = [
    where("context", "==", "personal"),
    where("participantUids", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  return query(collection(db, CONVERSATIONS), ...constraints);
}

export function orgConversationListQuery({ orgId, pageSize = 20, cursor = null }) {
  const constraints = [
    where("orgId", "==", orgId),
    where("scope", "==", "org"),
    orderBy("lastMessageAt", "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  return query(collection(db, CONVERSATIONS), ...constraints);
}

export async function fetchInboxPage({ uid, pageSize = 20, cursor = null }) {
  const snap = await getDocs(personalInboxQuery({ uid, pageSize, cursor }));
  return {
    conversations: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function fetchOrgConversationPage({ orgId, pageSize = 20, cursor = null }) {
  const snap = await getDocs(orgConversationListQuery({ orgId, pageSize, cursor }));
  return {
    conversations: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

// ── CONVERSATION META (per-user label/pin/mute; self-owned) ─────

export async function getConversationMeta(uid, conversationId) {
  const snap = await getDoc(doc(db, CONVERSATION_META, uid, "conversations", conversationId));
  return snap.exists() ? snap.data() : null;
}

export async function setConversationMeta(uid, conversationId, data) {
  await setDoc(doc(db, CONVERSATION_META, uid, "conversations", conversationId), data, { merge: true });
}

// ── MESSAGE THREAD (realtime, scoped to one open conversation) ──

// Bounded to the most recent `pageSize` messages — never an unbounded
// listener. Caller must detach `unsubscribe` on unmount / conversation change.
// onChange receives (messages, docs) oldest-first, both index-aligned — docs
// are the raw QueryDocumentSnapshots, needed as the cursor for fetchOlderMessages.
export function subscribeToThread({ conversationId, pageSize = 50, onChange, onError }) {
  const q = query(
    collection(db, MESSAGES),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = [...snap.docs].reverse();
      onChange(docs.map(d => ({ id: d.id, ...d.data() })), docs);
    },
    onError
  );
}

// One-shot upward pagination: messages older than `beforeDoc` (a QueryDocumentSnapshot
// from the oldest currently-loaded message), oldest-first for prepending.
export async function fetchOlderMessages({ conversationId, beforeDoc, pageSize = 30 }) {
  if (!beforeDoc) return { messages: [], docs: [], hasMore: false };
  const q = query(
    collection(db, MESSAGES),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "desc"),
    startAfter(beforeDoc),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  const docs = [...snap.docs].reverse();
  return {
    messages: docs.map(d => ({ id: d.id, ...d.data() })),
    docs,
    hasMore: snap.docs.length === pageSize,
  };
}

// ── MESSAGE SEND (transactional: message + conversation.lastMessageAt) ──

// A failed send is a hard error — never swallow it into a silent no-op,
// the caller must surface it to the user.
export async function sendMessage({ conversationId, orgId, senderUid, senderOrgId, text }) {
  if (!conversationId || !senderUid) throw new Error("sendMessage: conversationId and senderUid required");
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("sendMessage: text required");

  const batch = writeBatch(db);
  const messageRef = doc(collection(db, MESSAGES));
  batch.set(messageRef, {
    conversationId,
    orgId: orgId || null,
    senderUid,
    senderOrgId: senderOrgId || null,
    text: trimmed,
    type: "text",
    attachment: null,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, CONVERSATIONS, conversationId), { lastMessageAt: serverTimestamp() });
  await batch.commit();
  return messageRef.id;
}

// image | file | reference — text carries an optional caption. attachment is
// { url, name, size, mime } for image/file, or a reference payload for
// "reference" (linked-entity share — Phase C wires the entity picker; this
// just needs somewhere valid to land the write).
export async function sendAttachmentMessage({ conversationId, orgId, senderUid, senderOrgId, type, attachment, text = "" }) {
  if (!conversationId || !senderUid) throw new Error("sendAttachmentMessage: conversationId and senderUid required");
  if (!MESSAGE_TYPES.includes(type) || type === "text") throw new Error(`sendAttachmentMessage: invalid type "${type}"`);
  if (!attachment) throw new Error("sendAttachmentMessage: attachment required");

  const batch = writeBatch(db);
  const messageRef = doc(collection(db, MESSAGES));
  batch.set(messageRef, {
    conversationId,
    orgId: orgId || null,
    senderUid,
    senderOrgId: senderOrgId || null,
    text: (text || "").trim(),
    type,
    attachment,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, CONVERSATIONS, conversationId), { lastMessageAt: serverTimestamp() });
  await batch.commit();
  return messageRef.id;
}

// ── SUGGESTED ACTIONS (read-only; client never writes this collection) ──

// suggestedActions is a TOP-LEVEL collection written only by the deployed
// onMessageCreate function (functions/ai.js) — never a message.suggestedActions
// field. firestore.rules has `allow write: if false` on it entirely; the only
// way a doc's status changes is via the deployed confirmSuggestedAction /
// dismissSuggestedAction callables (Admin SDK, bypasses client rules).
//
// One listener per open conversation (not one per message) — bounded to the
// most recent 100 proposals — caller groups by messageId to attach to rows.
export function subscribeToSuggestedActions({ conversationId, onChange, onError }) {
  const q = query(
    collection(db, SUGGESTED_ACTIONS),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  );
}

// ── CONTEXT RAIL (linkedEntities) ────────────────────────────

// Single-doc, bounded, realtime — used by ContextRail so a fresh link (or
// any other conversation doc change) reflects immediately with no manual
// refresh. Caller detaches on unmount / conversationId change like the rest.
export function subscribeToConversation({ conversationId, onChange, onError }) {
  return onSnapshot(
    doc(db, CONVERSATIONS, conversationId),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

// Links an existing store/job to the conversation by appending to
// linkedEntities (additive array update). Verifies the target doc actually
// exists first, so the rail never has to render a linked entity that was
// never real. The conversations update rule already allows any participant
// to update the doc as long as scope is untouched (it is here) — no rules
// change needed.
export async function linkEntity({ conversationId, entityType, entityId, relationship = "" }) {
  const targetCollection = LINKABLE_ENTITY_COLLECTIONS[entityType];
  if (!targetCollection) throw new Error(`linkEntity: entityType "${entityType}" is not linkable yet`);
  const trimmedId = (entityId || "").trim();
  if (!trimmedId) throw new Error("linkEntity: entityId required");

  const targetSnap = await getDoc(doc(db, targetCollection, trimmedId));
  if (!targetSnap.exists()) throw new Error(`No ${entityType} found with id "${trimmedId}"`);

  await updateDoc(doc(db, CONVERSATIONS, conversationId), {
    linkedEntities: arrayUnion({ entityType, entityId: trimmedId, relationship: (relationship || "").trim() }),
  });
}
