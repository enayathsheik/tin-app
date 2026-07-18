// Reads the most recent messages in a conversation, oldest-first (readable
// chronological order for the model). Read-only — never writes.
async function getRecentMessages(db, conversationId, limit) {
  const snap = await db
    .collection('messages')
    .where('conversationId', '==', conversationId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        senderUid: data.senderUid,
        senderOrgId: data.senderOrgId || null,
        text: data.text,
        createdAt: data.createdAt ? data.createdAt.toMillis() : null,
      };
    })
    .reverse();
}

module.exports = { getRecentMessages };
