/**
 * Stage 11: every conversation action answers with the Conversation, and both
 * the open thread and the listed row are patched from that answer.
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
  getConversations: jest.fn(),
  getConversationMessages: jest.fn(),
  resolveConversation: jest.fn(),
  reopenConversation: jest.fn(),
  updateConversationPriority: jest.fn(),
  updateConversationLabels: jest.fn(),
  stopChatbot: jest.fn(),
  getLabels: jest.fn(),
}));

import * as api from '@/api/apis';
import type { ApiError, Conversation } from '@/api/types';
import { loadThread } from '@/features/messages';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import {
  reopenConversation,
  resolveConversation,
  setConversationLabels,
  setConversationPriority,
  stopChatbot,
} from '../conversationActions';
import { loadLabels } from '../labelsSlice';
import { loadConversations } from '../conversationsThunks';

const CONVERSATION_ID = '42';

const conversation = (fields: Partial<Conversation> = {}): Conversation =>
  ({
    id: 42,
    status: 'open',
    unread_count: 0,
    window_open: true,
    priority: 'normal',
    labels: [],
    ...fields,
  }) as Conversation;

const listed = () => store.getState().conversations.items[0];
const threadConversation = () =>
  store.getState().messages.byConversation[CONVERSATION_ID]?.conversation;

beforeEach(async () => {
  jest.clearAllMocks();
  store.dispatch(appReset());

  jest.mocked(api.getConversations).mockResolvedValue({
    data: [conversation()],
    meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
    httpStatus: 200,
  } as never);
  jest.mocked(api.getConversationMessages).mockResolvedValue({
    data: [],
    meta: { current_page: 1, per_page: 30, total: 0, last_page: 1, conversation: conversation() },
    httpStatus: 200,
  } as never);

  await store.dispatch(loadConversations());
  await store.dispatch(loadThread({ conversationId: CONVERSATION_ID }));
});

describe('resolve and reopen', () => {
  it('patches the thread and the row from the resolve response', async () => {
    jest
      .mocked(api.resolveConversation)
      .mockResolvedValue({ data: conversation({ status: 'resolved' }), httpStatus: 200 });

    await store.dispatch(resolveConversation({ conversationId: CONVERSATION_ID }));

    expect(listed().status).toBe('resolved');
    expect(threadConversation()?.status).toBe('resolved');
  });

  it('does not reopen a closed reply window', async () => {
    // CHAT-11 reopens the conversation only; the 24-hour window is unchanged.
    jest.mocked(api.reopenConversation).mockResolvedValue({
      data: conversation({ status: 'open', window_open: false }),
      httpStatus: 200,
    });

    await store.dispatch(reopenConversation({ conversationId: CONVERSATION_ID }));

    expect(threadConversation()).toMatchObject({ status: 'open', window_open: false });
  });
});

describe('priority and labels', () => {
  it('stores the priority the server confirms', async () => {
    jest
      .mocked(api.updateConversationPriority)
      .mockResolvedValue({ data: conversation({ priority: 'urgent' }), httpStatus: 200 });

    await store.dispatch(setConversationPriority({ conversationId: CONVERSATION_ID, priority: 'urgent' }));

    expect(api.updateConversationPriority).toHaveBeenCalledWith(CONVERSATION_ID, { priority: 'urgent' });
    expect(listed().priority).toBe('urgent');
  });

  it('sends the complete label list, because CHAT-14 replaces it', async () => {
    jest.mocked(api.updateConversationLabels).mockResolvedValue({
      data: conversation({ labels: [{ id: 2, name: 'VIP' }] }),
      httpStatus: 200,
    });

    await store.dispatch(setConversationLabels({ conversationId: CONVERSATION_ID, labelIds: [2] }));

    expect(api.updateConversationLabels).toHaveBeenCalledWith(CONVERSATION_ID, { label_ids: [2] });
    expect(listed().labels).toEqual([{ id: 2, name: 'VIP' }]);
  });

  it('reports a refused action instead of changing anything', async () => {
    jest.mocked(api.updateConversationPriority).mockRejectedValue({
      code: 'FORBIDDEN',
      status: 403,
      message: 'You cannot tag conversations.',
    } satisfies ApiError);

    const result = await store.dispatch(
      setConversationPriority({ conversationId: CONVERSATION_ID, priority: 'high' }),
    );

    expect(result.type).toMatch(/rejected$/);
    expect(listed().priority).toBe('normal');
  });
});

describe('chatbot take-over', () => {
  it('patches the conversation the server returns', async () => {
    jest
      .mocked(api.stopChatbot)
      .mockResolvedValue({ data: conversation({ chatbot: null }), httpStatus: 200 });

    await store.dispatch(stopChatbot({ conversationId: CONVERSATION_ID }));

    expect(threadConversation()?.chatbot).toBeNull();
  });
});

describe('labels list', () => {
  it('keeps the label list for the session', async () => {
    jest.mocked(api.getLabels).mockResolvedValue({ data: [{ id: 1, name: 'Refund' }], httpStatus: 200 });

    await store.dispatch(loadLabels());

    expect(store.getState().labels).toMatchObject({ status: 'ready', items: [{ id: 1, name: 'Refund' }] });
  });
});
