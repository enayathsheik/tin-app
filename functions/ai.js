// ============================================================
// TIN — AI Foundation Layer: Cloud Functions (application layer)
// File: functions/ai.js
// Deploy: firebase deploy --only functions
//
// These functions are the ONLY place a suggestedAction can turn into real
// business data. The ai-foundation package itself (vendored into
// vendor/ai-foundation by `npm run build`, see scripts/vendor-ai-foundation.js)
// never writes to ledgerEntries/milestones/snags — only to suggestedActions,
// via onMessageCreate below.
// ============================================================

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const aiFoundation = require("./vendor/ai-foundation");

const db = getFirestore();

// Bound below on onMessageCreate — the only function here that calls into
// the OpenAI-backed orchestrator (aiFoundation.classifyMessage). Firebase
// Functions v2 injects the resolved value into process.env.OPENAI_API_KEY
// at invocation time, which is what providers/openai/adapter.js already
// reads (see packages/ai-foundation) — no change needed there.
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Maps a suggestedAction's actionType to the collection it's allowed to
// write to on confirm. Types with no collection in scope (tag_project,
// share_reference, log_approval) are intentionally absent — see Part 5 of
// the AI Foundation Layer plan (projects/references/approvals are out of
// scope for Phase 1).
const ACTION_TYPE_COLLECTIONS = {
  log_ledger_entry: "ledgerEntries",
  set_milestone: "milestones",
  flag_snag: "snags",
};

async function isConversationParticipant(conversationId, uid) {
  const convSnap = await db.collection("conversations").doc(conversationId).get();
  if (!convSnap.exists) return false;
  return (convSnap.data().participantUids || []).includes(uid);
}

// ── CLOUD FUNCTION: onMessageCreate ──────────────────────────
exports.onMessageCreate = onDocumentCreated(
  { document: "messages/{messageId}", secrets: [openaiApiKey] },
  async (event) => {
    const messageId = event.params.messageId;
    const message = event.data.data();

    let proposal;
    try {
      proposal = await aiFoundation.classifyMessage(messageId);
    } catch (err) {
      console.error(`[onMessageCreate] classifyMessage failed for ${messageId}:`, err.message);
      return;
    }

    if (!proposal) return; // no suggestion warranted, or below confidence threshold

    await db.collection("suggestedActions").add({
      conversationId: message.conversationId,
      messageId,
      orgId: message.senderOrgId || null,
      actionType: proposal.suggestedActionType,
      payload: proposal.suggestedActionPayload,
      explanation: proposal.explanation,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
);

// ── CLOUD FUNCTION: confirmSuggestedAction ───────────────────
// This is explicitly OUTSIDE the ai-foundation package — the application
// boundary where a user's confirmation turns a proposal into real data.
exports.confirmSuggestedAction = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

  const { actionId, editedPayload } = request.data;
  if (!actionId) throw new HttpsError("invalid-argument", "actionId required");

  const actionRef = db.collection("suggestedActions").doc(actionId);
  const actionSnap = await actionRef.get();
  if (!actionSnap.exists) throw new HttpsError("not-found", "Suggested action not found");

  const action = actionSnap.data();
  if (action.status !== "pending") {
    throw new HttpsError("failed-precondition", `Action is already ${action.status}`);
  }

  const isParticipant = await isConversationParticipant(action.conversationId, request.auth.uid);
  if (!isParticipant) {
    throw new HttpsError("permission-denied", "Not a participant of this conversation");
  }

  const targetCollection = ACTION_TYPE_COLLECTIONS[action.actionType];
  if (!targetCollection) {
    throw new HttpsError(
      "failed-precondition",
      `actionType "${action.actionType}" is not yet supported for confirmation`
    );
  }

  const payload = editedPayload || action.payload;

  await db.collection(targetCollection).add({
    ...payload,
    conversationId: action.conversationId,
    orgId: action.orgId,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    sourceActionId: actionId,
  });

  await actionRef.update({
    status: "confirmed",
    confirmedBy: request.auth.uid,
    confirmedAt: FieldValue.serverTimestamp(),
    ...(editedPayload ? { editedPayload } : {}),
  });

  return { success: true, collection: targetCollection };
});

// ── CLOUD FUNCTION: dismissSuggestedAction ───────────────────
exports.dismissSuggestedAction = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

  const { actionId } = request.data;
  if (!actionId) throw new HttpsError("invalid-argument", "actionId required");

  const actionRef = db.collection("suggestedActions").doc(actionId);
  const actionSnap = await actionRef.get();
  if (!actionSnap.exists) throw new HttpsError("not-found", "Suggested action not found");

  const action = actionSnap.data();
  if (action.status !== "pending") {
    throw new HttpsError("failed-precondition", `Action is already ${action.status}`);
  }

  const isParticipant = await isConversationParticipant(action.conversationId, request.auth.uid);
  if (!isParticipant) {
    throw new HttpsError("permission-denied", "Not a participant of this conversation");
  }

  await actionRef.update({
    status: "dismissed",
    dismissedBy: request.auth.uid,
    dismissedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
