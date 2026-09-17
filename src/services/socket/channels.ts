/**
 * What the app listens to on Reverb, and what it keeps from each event.
 *
 * Channel and event names come from the Wazigo web app's own live-update code
 * (app.wazigo.io, read 2026-09-17) - the workbook documented the channel but not
 * the events. Names are the raw Pusher names: the web app's Echo listeners use a
 * leading dot, which means "no namespace", so `.message.received` arrives here as
 * `message.received`.
 *
 * PRIVACY (backend blocker 5): number channels broadcast every conversation on
 * that WhatsApp number, including other agents' customers and their message
 * text. The agreed mitigation until the server sends personal events is that
 * **no event content is ever used**: an event is reduced to a conversation id -
 * a signal that something changed - and the screens reload through the normal,
 * server-scoped REST endpoints. Nothing from a payload is stored, rendered or
 * logged. Do not widen `signalFromEvent` to carry message text or contact data.
 */

export type LiveChannels = {
  /** Personal channel: Laravel database/broadcast notifications for this user. */
  user: string;
  /** One per WhatsApp number the user can access. */
  numbers: string[];
};

export type LiveSubscription = {
  userId: number;
  tenantId: number;
  numberIds: number[];
};

/** Private channel names, including the `private-` prefix Pusher expects. */
export function channelsFor({ userId, tenantId, numberIds }: LiveSubscription): LiveChannels {
  const numbers = Array.from(new Set(numberIds.filter((id) => Number.isInteger(id) && id > 0)))
    .sort((a, b) => a - b)
    .map((numberId) => `private-tenant.${tenantId}.number.${numberId}`);
  return { user: `private-App.Models.User.${userId}`, numbers };
}

/** Events on a number channel. Every one of them names a conversation. */
export const NUMBER_CHANNEL_EVENTS = [
  'message.received',
  'message.sent',
  'message.status',
  'conversation.updated',
  'conversation.assigned',
] as const;

/** Laravel's broadcast notification event on the personal channel. */
export const USER_NOTIFICATION_EVENT = 'Illuminate\\Notifications\\Events\\BroadcastNotificationCreated';

export type LiveSignal = {
  /** The conversation that changed, when the event names one. */
  conversationId: number | null;
  /**
   * A change that can move counts or list order (a new message, an assignment),
   * as opposed to a delivery tick on an existing message.
   */
  affectsLists: boolean;
};

const positiveId = (value: unknown): number | null => {
  const id = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

/** `/chats/12`, `/conversations/12`, `…?conversation=12` - how a notification link can name a chat. */
export function conversationIdFromLink(link: unknown): number | null {
  if (typeof link !== 'string') return null;
  const match = link.match(/(?:chats|conversations|inbox)\/(\d+)/) ?? link.match(/[?&]conversation(?:_id)?=(\d+)/);
  return match ? positiveId(match[1]) : null;
}

/**
 * Reduces an event to the only thing the app uses: which conversation changed.
 * Returns null for events the app does not act on.
 */
export function signalFromEvent(eventName: string, payload: unknown): LiveSignal | null {
  const data = record(payload);

  if (eventName === USER_NOTIFICATION_EVENT) {
    // Notifications carry no fixed conversation field; a link may name one.
    const id = positiveId(data?.conversation_id) ?? conversationIdFromLink(data?.link);
    return { conversationId: id, affectsLists: true };
  }

  if (!(NUMBER_CHANNEL_EVENTS as readonly string[]).includes(eventName)) return null;

  const conversation = record(data?.conversation);
  const message = record(data?.message);
  const id =
    positiveId(conversation?.id) ??
    positiveId(message?.conversation_id) ??
    positiveId(data?.conversation_id);

  // A status event without a conversation id cannot be placed; ignore it.
  if (id === null && eventName === 'message.status') return null;

  return { conversationId: id, affectsLists: eventName !== 'message.status' };
}
