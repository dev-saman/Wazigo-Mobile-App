/**
 * Live updates: which channels the app joins, and that an event is reduced to a
 * conversation id before it goes anywhere.
 *
 * Since LIVE-02 the app joins the server-named personal agent channel and NOT
 * the per-number channels, which carry other agents' message content. The
 * reduction to an id stays in force regardless.
 */
import {
  AGENT_CHANNEL_EVENTS,
  channelsFor,
  conversationIdFromLink,
  signalFromEvent,
  USER_NOTIFICATION_EVENT,
} from '../channels';

describe('channelsFor', () => {
  it('joins the notification channel and the server-named personal agent channel', () => {
    expect(channelsFor({ userId: 5, agentChannel: 'tenant.3.agent.5' })).toEqual({
      user: 'private-App.Models.User.5',
      agent: 'private-tenant.3.agent.5',
    });
  });

  it('does not double the private- prefix when the server already sent one', () => {
    expect(channelsFor({ userId: 5, agentChannel: 'private-tenant.3.agent.5' }).agent).toBe(
      'private-tenant.3.agent.5',
    );
  });

  it('has no agent channel when the server sent none, rather than composing one', () => {
    expect(channelsFor({ userId: 5, agentChannel: null }).agent).toBeNull();
    expect(channelsFor({ userId: 5, agentChannel: '  ' }).agent).toBeNull();
  });
});

describe('signalFromEvent', () => {
  const received = {
    message: { id: 900, conversation_id: 42, text_body: 'Private customer text', direction: 'inbound' },
    conversation: { id: 42, contact: { profile_name: 'Someone else\'s customer' }, unread_count: 3 },
  };

  it('keeps only the conversation id - never message text or contact data', () => {
    const signal = signalFromEvent('message.received', received);
    expect(signal).toEqual({ conversationId: 42, affectsLists: true });
    expect(JSON.stringify(signal)).not.toContain('Private customer text');
    expect(Object.keys(signal ?? {})).toEqual(['conversationId', 'affectsLists']);
  });

  it('handles every event the personal agent channel carries', () => {
    expect(AGENT_CHANNEL_EVENTS).toEqual([
      'message.received',
      'message.sent',
      'message.status',
      'conversation.updated',
      'conversation.assigned',
    ]);
    expect(signalFromEvent('message.sent', received)?.conversationId).toBe(42);
    expect(signalFromEvent('conversation.updated', { conversation: { id: 8 } })).toEqual({
      conversationId: 8,
      affectsLists: true,
    });
    expect(signalFromEvent('conversation.assigned', { conversation: { id: '9' } })?.conversationId).toBe(9);
  });

  it('treats a delivery tick as a thread change, not a list change', () => {
    expect(signalFromEvent('message.status', { id: 900, conversation_id: 42, status: 'read' })).toEqual({
      conversationId: 42,
      affectsLists: false,
    });
    // Nowhere to apply it without a conversation.
    expect(signalFromEvent('message.status', { id: 900, status: 'read' })).toBeNull();
  });

  it('flags a chat reassigned AWAY from me so the open thread can close', () => {
    const away = signalFromEvent(
      'conversation.assigned',
      { conversation: { id: 42, assigned_user_id: 9 }, previous_assigned_user_id: 5 },
      5,
    );
    expect(away).toEqual({ conversationId: 42, affectsLists: true, assignedAway: true });
  });

  it('does not flag a chat assigned TO me, or one that was never mine', () => {
    // Handed to me: previous was someone else.
    expect(
      signalFromEvent(
        'conversation.assigned',
        { conversation: { id: 42, assigned_user_id: 5 }, previous_assigned_user_id: 9 },
        5,
      ),
    ).toEqual({ conversationId: 42, affectsLists: true });

    // Between two colleagues; the event still reaches me on a catch-up.
    expect(
      signalFromEvent(
        'conversation.assigned',
        { conversation: { id: 42, assigned_user_id: 9 }, previous_assigned_user_id: 8 },
        5,
      ),
    ).toEqual({ conversationId: 42, affectsLists: true });

    // Without my user id there is nothing to compare against.
    expect(
      signalFromEvent('conversation.assigned', {
        conversation: { id: 42, assigned_user_id: 9 },
        previous_assigned_user_id: 5,
      }),
    ).toEqual({ conversationId: 42, affectsLists: true });
  });

  it('ignores events the app does not act on (contacts, templates, presence)', () => {
    expect(signalFromEvent('contact.updated', { contact: { id: 1 } })).toBeNull();
    expect(signalFromEvent('template.status_updated', {})).toBeNull();
    expect(signalFromEvent('presence.updated', { user_id: 5 })).toBeNull();
  });

  it('reads a personal notification as a list change, with a conversation when its link names one', () => {
    expect(signalFromEvent(USER_NOTIFICATION_EVENT, { title: 'Chat assigned to you', link: '/inbox/77' })).toEqual({
      conversationId: 77,
      affectsLists: true,
    });
    expect(signalFromEvent(USER_NOTIFICATION_EVENT, { title: 'Billing' })).toEqual({
      conversationId: null,
      affectsLists: true,
    });
  });
});

describe('conversationIdFromLink', () => {
  it('understands the link shapes a notification can carry', () => {
    expect(conversationIdFromLink('/chats/12')).toBe(12);
    expect(conversationIdFromLink('https://app.wazigo.io/conversations/34?tab=1')).toBe(34);
    expect(conversationIdFromLink('/inbox?conversation=56')).toBe(56);
    expect(conversationIdFromLink('/settings')).toBeNull();
    expect(conversationIdFromLink(undefined)).toBeNull();
  });
});
