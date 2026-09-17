/**
 * Live updates: which channels the app joins, and that an event is reduced to a
 * conversation id before it goes anywhere (backend blocker 5 - number channels
 * carry other agents' message content, which must never be used).
 */
import {
  channelsFor,
  conversationIdFromLink,
  NUMBER_CHANNEL_EVENTS,
  signalFromEvent,
  USER_NOTIFICATION_EVENT,
} from '../channels';

describe('channelsFor', () => {
  it('names the personal channel and one private channel per number, as the web app does', () => {
    expect(channelsFor({ userId: 5, tenantId: 3, numberIds: [12, 7] })).toEqual({
      user: 'private-App.Models.User.5',
      numbers: ['private-tenant.3.number.7', 'private-tenant.3.number.12'],
    });
  });

  it('drops duplicate and invalid number ids', () => {
    expect(channelsFor({ userId: 5, tenantId: 3, numberIds: [7, 7, 0, -1, 1.5] }).numbers).toEqual([
      'private-tenant.3.number.7',
    ]);
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

  it('handles every number-channel event the web app listens to', () => {
    expect(NUMBER_CHANNEL_EVENTS).toEqual([
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
