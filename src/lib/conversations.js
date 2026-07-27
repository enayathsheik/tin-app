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
  collection, doc, getDoc, getDocs, setDoc,
  query, where, orderBy, limit, startAfter, onSnapshot,
  serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";

const CONVERSATIONS = "conversations";
const MESSAGES = "messages";
const CONVERSATION_META = "conversationMeta";

const MESSAGE_TYPES = ["text", "image", "file", "reference"];

const directConversationId = (orgId, uidA, uidB) =>
  `${orgId}_${[uidA, uidB].sort().join("_")}`;

// Human-readable label for a conversation, derived from the participantNames
// map denormalized onto the doc at creation time (see getOrCreateDirectConversation
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

// Deterministic id prevents duplicate DMs between the same two people in the
// same org. `names` is an optional { [uid]: displayName } map — conversations
// don't carry a readable label of their own, and users/{uid} is only
// self-readable per firestore.rules, so any human-readable name shown in the
// list/thread header has to be denormalized onto the conversation doc by
// whoever creates it (the only party who reliably has both names in hand).
export async function getOrCreateDirectConversation({ orgId, currentUid, otherUid, scope = "personal", names = {} }) {
  if (!orgId || !currentUid || !otherUid) throw new Error("getOrCreateDirectConversation: orgId, currentUid, otherUid required");

  const id = directConversationId(orgId, currentUid, otherUid);
  const ref = doc(db, CONVERSATIONS, id);
  const existing = await getDoc(ref);
  if (existing.exists()) return { id, ...existing.data() };

  const data = {
    orgId,
    type: "direct",
    scope,
    participantUids: [currentUid, otherUid].sort(),
    participantOrgIds: [orgId],
    participantNames: names,
    teamId: null,
    linkedEntities: [],
    createdBy: currentUid,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id, ...data };
}

export async function createGroupConversation({ orgId, currentUid, participantUids, scope = "personal", teamId = null, names = {} }) {
  if (!orgId || !currentUid || !participantUids?.length) {
    throw new Error("createGroupConversation: orgId, currentUid, participantUids required");
  }

  const uniqueParticipants = Array.from(new Set([currentUid, ...participantUids]));
  const ref = doc(collection(db, CONVERSATIONS));
  const data = {
    orgId,
    type: "group",
    scope,
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

// ── CONVERSATION LIST (paginated, tenant+participant scoped) ────

export function conversationListQuery({ orgId, uid, pageSize = 20, cursor = null }) {
  const constraints = [
    where("orgId", "==", orgId),
    where("participantUids", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  return query(collection(db, CONVERSATIONS), ...constraints);
}

export async function fetchConversationPage(params) {
  const snap = await getDocs(conversationListQuery(params));
  return {
    conversations: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === (params.pageSize || 20),
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
