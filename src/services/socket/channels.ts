/**
 * What the app listens to on Reverb, and what it keeps from each event.
 *
 * LIVE-02 (backend shipped 2026-09-17, documented 2026-09-18). The app now
 * subscribes to ONE channel: the per-person `tenant.<tenant-id>.agent.<user-id>`,
 * whose exact name the server composes and hands over in AUTH-05
 * `data.realtime.channels.agent`. It carries the same five events as the old
 * number channels but only for conversations assigned to the signed-in person.
 * The app no longer decodes `tenant_id` from the JWT to build a name by hand.
 *
 * PRIVACY: the number channels this app used until now broadcast every
 * conversation on a WhatsApp number - including other agents' customers and
 * their message text. They still exist for the web app; mobile must not
 * subscribe to them. Even so, the mitigation stays in force: an event is
 * reduced to a conversation id here, at the edge, and the screens reload
 * through the normal server-scoped REST endpoints. Nothing from a payload is
 * stored, rendered or logged. Do not widen `signalFromEvent` to carry message
 * text or contact data.
 */

export type LiveChannels = {
  /** Laravel database/broadcast notifications for this user. */
  user: string;
  /** LIVE-02 personal inbox channel, or null when the server did not supply one. */
  agent: string | null;
};

export type LiveSubscription = {
  userId: number;
  /**
   * LIVE-02 channel name exactly as AUTH-05 supplied it, with or without the
   * `private-` prefix. Null when the server sent no `realtime.channels.agent`.
   */
  agentChannel: string | null;
};

/** Pusher wants the wire name; the server may or may not include the prefix. */
const privateName = (name: string) => (name.startsWith('private-') ? name : `private-${name}`);

/** Private channel names, including the `private-` prefix Pusher expects. */
export function channelsFor({ userId, agentChannel }: LiveSubscription): LiveChannels {
  const agent = typeof agentChannel === 'string' && agentChannel.trim() !== '' ? privateName(agentChannel.trim()) : null;
  return { user: `private-App.Models.User.${userId}`, agent };
}

/** Events on the personal agent channel. Every one of them names a conversation. */
export const AGENT_CHANNEL_EVENTS = [
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
  /**
   * `conversation.assigned` only: this chat just moved AWAY from me, so it must
   * leave My Chats and the open thread must close. The server sends the event to
   * both the new assignee and the previous one, so "assigned" alone is ambiguous.
   */
  assignedAway?: boolean;
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
 *
 * `myUserId` is needed only for `conversation.assigned`: comparing
 * `previous_assigned_user_id` with `conversation.assigned_user_id` is the only
 * way to tell "this is now mine" from "this was mine and no longer is".
 */
export function signalFromEvent(eventName: string, payload: unknown, myUserId?: number | null): LiveSignal | null {
  const data = record(payload);

  if (eventName === USER_NOTIFICATION_EVENT) {
    // Notifications carry no fixed conversation field; a link may name one.
    const id = positiveId(data?.conversation_id) ?? conversationIdFromLink(data?.link);
    return { conversationId: id, affectsLists: true };
  }

  if (!(AGENT_CHANNEL_EVENTS as readonly string[]).includes(eventName)) return null;

  const conversation = record(data?.conversation);
  const message = record(data?.message);
  const id =
    positiveId(conversation?.id) ??
    positiveId(message?.conversation_id) ??
    positiveId(data?.conversation_id);

  // A status event without a conversation id cannot be placed; ignore it.
  if (id === null && eventName === 'message.status') return null;

  // 2026-09-18 addition: previous_assigned_user_id. Mine before, not mine now.
  let assignedAway = false;
  if (eventName === 'conversation.assigned' && typeof myUserId === 'number') {
    const previous = positiveId(data?.previous_assigned_user_id);
    const current = positiveId(conversation?.assigned_user_id);
    assignedAway = previous === myUserId && current !== myUserId;
  }

  // Present only when true, so the signal keeps the smallest possible key set
  // and the privacy guard on its shape stays meaningful.
  return {
    conversationId: id,
    affectsLists: eventName !== 'message.status',
    ...(assignedAway ? { assignedAway: true } : {}),
  };
}
