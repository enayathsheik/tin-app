// ============================================================
// TIN — Cross-company conversations: Cloud Functions (application layer)
// File: functions/conversations.js
// Deploy: firebase deploy --only functions:createExternalConversation
//
// createExternalConversation is the ONLY way an external-scope conversation
// (scope: "external", spanning two different orgs) is ever created —
// firestore.rules rejects a client-side create with scope == 'external'
// (see the conversations `allow create` rule), so this Admin-SDK callable
// is the sole path. It inherits the global region/timeout/memory set in
// functions/index.js's setGlobalOptions() the same way functions/ai.js does.
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

// Resolves uid's single active membership → orgId. Runs under the Admin SDK
// (above security rules), so — unlike the client-side src/lib/tenancy.js
// resolveActiveOrg, which picks an owner membership as the tiebreaker — this
// throws on zero or on more than one active membership: for an external
// conversation there is no safe default org to guess, and multi-org
// selection is a later decision (see the callable's own precondition checks
// below, which map these to caller-facing messages).
async function resolveSingleActiveOrgId(uid) {
  const snap = await db
    .collection("memberships")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .get();
  if (snap.size !== 1) return null;
  return snap.docs[0].data().orgId;
}

exports.createExternalConversation = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

  const { counterpartyUid } = request.data;
  if (!counterpartyUid) throw new HttpsError("invalid-argument", "counterpartyUid required");

  const callerUid = request.auth.uid;
  if (counterpartyUid === callerUid) {
    throw new HttpsError("invalid-argument", "Cannot start a conversation with yourself");
  }

  const callerOrgId = await resolveSingleActiveOrgId(callerUid);
  if (!callerOrgId) {
    throw new HttpsError("failed-precondition", "You must be an active member of exactly one organization to start an external conversation");
  }

  const counterpartyOrgId = await resolveSingleActiveOrgId(counterpartyUid);
  if (!counterpartyOrgId) {
    throw new HttpsError("failed-precondition", "This user has no single active organization to message — they may have none, or more than one (not yet supported)");
  }

  if (callerOrgId === counterpartyOrgId) {
    throw new HttpsError("invalid-argument", "Both users are in the same organization — use an internal conversation instead");
  }

  const conversationId = `ext_${[callerUid, counterpartyUid].sort().join("_")}`;
  const conversationRef = db.collection("conversations").doc(conversationId);
  const existing = await conversationRef.get();

  if (!existing.exists) {
    await conversationRef.set({
      type: "direct",
      scope: "external",
      participantUids: [callerUid, counterpartyUid],
      participantOrgIds: [callerOrgId, counterpartyOrgId],
      orgId: callerOrgId,
      createdBy: callerUid,
      createdAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      linkedEntities: [],
    });
  }

  return { conversationId };
});
