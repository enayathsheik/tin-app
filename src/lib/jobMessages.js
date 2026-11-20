// Messaging between a candidate and an employer about an application —
// always TIN Conversations (no separate chat). Opens (or creates) the
// pair's personal conversation via the application, links the job, and
// optionally sends a first message. Returns the conversation id.
import { openApplicationConversation, sendMessage } from "./conversations";

export async function messageAboutApplication({ myUid, myName, otherUid, otherName, app, text = "" }) {
  const conv = await openApplicationConversation({
    currentUid: myUid,
    counterpartyUid: otherUid,
    applicationId: app.id,
    jobId: app.jobId,
    names: { [myUid]: myName || "", [otherUid]: otherName || "" },
  });
  const t = (text || "").trim();
  if (t) await sendMessage({ conversationId: conv.id, senderUid: myUid, text: t });
  return conv.id;
}
