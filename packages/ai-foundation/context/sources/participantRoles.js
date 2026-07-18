// Reads participant roles for a conversation. There is no role/team concept
// yet (Phase 1 minimal scope), so every participant uid is reported with a
// placeholder role of 'member' — this exists as its own source module so a
// future phase can add real roles without changing buildContext()'s shape.
async function getParticipantRoles(db, conversationUids) {
  return conversationUids.map((uid) => ({ uid, role: 'member' }));
}

module.exports = { getParticipantRoles };
