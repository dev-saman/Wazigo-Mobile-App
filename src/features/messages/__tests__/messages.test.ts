/**
 * Stage 8: CHAT-02 paging keeps newest-first order without repeats, the thread
 * header comes from `meta.conversation`, and CHAT-06 patches both the open
 * thread and the row behind it.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/services/storage/tokenStorage', () => ({
  tokenStorage: {
    load: jest.fn(async () => null),
    get: jest.fn(() => null),
    save: jest.fn(),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('@/api/apis', () => ({
  getConversationMessages: jest.fn(),
  getConversations: jest.fn(),
  markConversationRead: jest.fn(),
}));

import * as api from '@/api/apis';
import type { ApiError, Conversation, Message } from '@/api/types';
import { loadConversations, markConversationRead } from '@/features/conversations';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { loadOlderMessages, loadThread } from '../messagesThunks';

const CONVERSATION_ID = '42';

const message = (id: number, at: string): Message =>
  ({ id, conversation_id: 42, direction: 'inbound', type: 'text', wa_timestamp: at }) as Message;

const conversation = (unread: number): Conversation =>
  ({ id: 42, status: 'open', unread_count: unread, window_open: true }) as Conversation;

const page = (items: Message[], current: number, last: number, conv?: Conversation) =>
  ({
    data: items,
    meta: { current_page: current, per_page: 30, total: 60, last_page: last, conversation: conv },
    httpStatus: 200,
  }) as never;

const thread = () => store.getState().messages.byConversation[CONVERSATION_ID];

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  jest
    .mocked(api.getConversationMessages)
    .mockResolvedValue(page([message(3, '2026-09-16T10:00:00Z')], 1, 1, conversation(0)));
});

describe('loadThread', () => {
  it('keeps the newest-first page and takes the thread from meta', async () => {
    await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));

    expect(thread().items.map((item) => item.id)).toEqual([3]);
    expect(thread().conversation).toMatchObject({ id: 42 });
    expect(thread().status).toBe('ready');
    expect(jest.mocked(api.getConversationMessages).mock.calls[0][1]).toMatchObject({
      page: 1,
      per_page: 30,
    });
  });

  it('keeps each conversation in its own slot', async () => {
    await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));
    jest
      .mocked(api.getConversationMessages)
      .mockResolvedValue(page([message(9, '2026-09-16T11:00:00Z')], 1, 1));

    await store.dispatch(loadThread({ conversationId: '7' }));

    expect(thread().items.map((item) => item.id)).toEqual([3]);
    expect(store.getState().messages.byConversation['7'].items.map((item) => item.id)).toEqual([9]);
  });

  it('shows the error screen only when the thread is still empty', async () => {
    jest.mocked(api.getConversationMessages).mockRejectedValue({
      code: 'FORBIDDEN',
      status: 403,
      message: 'You cannot view this conversation.',
    } satisfies ApiError);

    await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));

    expect(thread().status).toBe('failed');
    expect(thread().error?.code).toBe('FORBIDDEN');
  });
});

describe('loadOlderMessages', () => {
  it('appends older history after the newer messages, without repeats', async () => {
    jest
      .mocked(api.getConversationMessages)
      .mockResolvedValue(page([message(3, '2026-09-16T10:00:00Z')], 1, 2, conversation(0)));
    await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));

    // Page 2 re-sends message 3 as its first row.
    jest
      .mocked(api.getConversationMessages)
      .mockResolvedValue(page([message(3, '2026-09-16T10:00:00Z'), message(2, '2026-09-15T09:00:00Z')], 2, 2));
    await store.dispatch(loadOlderMessages({ conversationId: CONVERSATION_ID }));

    expect(thread().items.map((item) => item.id)).toEqual([3, 2]);
    expect(thread().page).toBe(2);
  });

  it('does not ask for history that does not exist', async () => {
    await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));
    jest.clearAllMocks();

    await store.dispatch(loadOlderMessages({ conversationId: CONVERSATION_ID }));

    expect(api.getConversationMessages).not.toHaveBeenCalled();
  });

  it('keeps the messages on screen when an older page fails', async () => {
    jest
      .mocked(api.getConversationMessages)
      .mockResolvedValue(page([message(3, '2026-09-16T10:00:00Z')], 1, 2, conversation(0)));
    await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));

    jest.mocked(api.getConversationMessages).mockRejectedValue({
      code: 'NETWORK',
      message: 'Unable to reach Wazigo.',
      isNetworkError: true,
    } satisfies ApiError);
    await store.dispatch(loadOlderMessages({ conversationId: CONVERSATION_ID }));

    expect(thread().status).toBe('ready');
    expect(thread().items).toHaveLength(1);
    expect(thread().error?.code).toBe('NETWORK');
  });
});

describe('markConversationRead', () => {
  it('patches the listed row and the open thread from the response', async () => {
    jest.mocked(api.getConversations).mockResolvedValue({
      data: [conversation(4)],
      meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
      httpStatus: 200,
    } as never);
    await store.dispatch(loadConversations());
    await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));

    jest.mocked(api.markConversationRead).mockResolvedValue({ data: conversation(0), httpStatus: 200 });
    await store.dispatch(markConversationRead({ conversationId: CONVERSATION_ID }));

    expect(store.getState().conversations.items[0].unread_count).toBe(0);
    expect(thread().conversation?.unread_count).toBe(0);
  });

  it('never breaks reading a chat when it fails', async () => {
    jest.mocked(api.markConversationRead).mockRejectedValue({
      code: 'SERVER_ERROR',
      status: 500,
      message: 'Wazigo is having trouble right now.',
    } satisfies ApiError);

    const result = await store.dispatch(markConversationRead({ conversationId: CONVERSATION_ID }));

    expect(result.type).toMatch(/rejected$/);
    expect(store.getState().conversations.status).not.toBe('failed');
  });
});
