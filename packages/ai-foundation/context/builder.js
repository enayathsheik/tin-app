const { getFirestore } = require('firebase-admin/firestore');
const { getRecentMessages } = require('./sources/messages');
const { getOrgInfo } = require('./sources/orgInfo');
const { getParticipantRoles } = require('./sources/participantRoles');

// Character budget for the assembled context sent to the model. If trimming
// is needed, oldest messages are dropped first, most recent kept.
const MAX_CONTEXT_CHARS = 8000;

function parseRequirement(requirement) {
  const [key, arg] = requirement.split(':');
  return { key, arg };
}

// Reads only what's declared in `requirements` for the calling capability.
// Read-only against messages, conversations, organizations, organizationMemberships.
async function buildContext(messageId, requirements) {
  const db = getFirestore();

  const messageSnap = await db.collection('messages').doc(messageId).get();
  if (!messageSnap.exists) throw new Error(`Message ${messageId} not found`);
  const message = { id: messageSnap.id, ...messageSnap.data() };

  const conversationSnap = await db.collection('conversations').doc(message.conversationId).get();
  if (!conversationSnap.exists) throw new Error(`Conversation ${message.conversationId} not found`);
  const conversation = { id: conversationSnap.id, ...conversationSnap.data() };

  const context = {
    conversationId: conversation.id,
    currentMessage: {
      id: message.id,
      senderUid: message.senderUid,
      senderOrgId: message.senderOrgId || null,
      text: message.text,
    },
  };

  for (const requirement of requirements) {
    const { key, arg } = parseRequirement(requirement);

    if (key === 'recentMessages') {
      const limit = Number(arg) || 10;
      context.recentMessages = await getRecentMessages(db, conversation.id, limit);
    } else if (key === 'orgInfo') {
      context.orgInfo = await getOrgInfo(db, conversation.participantOrgIds || []);
    } else if (key === 'participantRoles') {
      context.participantRoles = await getParticipantRoles(db, conversation.participantUids || []);
    }
  }

  return trimToCharBudget(context);
}

// Drops oldest recentMessages entries first until the serialized context
// fits within MAX_CONTEXT_CHARS, keeping the most recent ones.
function trimToCharBudget(context) {
  if (!context.recentMessages) return context;

  while (
    JSON.stringify(context).length > MAX_CONTEXT_CHARS &&
    context.recentMessages.length > 1
  ) {
    context.recentMessages = context.recentMessages.slice(1);
  }
  return context;
}

module.exports = { buildContext, MAX_CONTEXT_CHARS };
