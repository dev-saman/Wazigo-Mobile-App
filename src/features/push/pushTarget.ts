import { conversationIdFromLink } from '@/services/socket/channels';

/**
 * Which chat a push notification is about. The backend's payload is read
 * tolerantly: `conversation_id` (preferred), `conversationId`, a nested
 * `conversation.id`, or a `link` / `url` that names the chat.
 */
export function conversationIdFromPushData(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;

  const direct = [data.conversation_id, data.conversationId, (data.conversation as { id?: unknown } | undefined)?.id];
  for (const value of direct) {
    const id = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) return String(id);
  }

  const fromLink = conversationIdFromLink(data.link) ?? conversationIdFromLink(data.url);
  return fromLink === null ? null : String(fromLink);
}
