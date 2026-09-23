/**
 * A live batch is answered with the ordinary server-scoped REST calls, only for
 * what is on screen, and without throwing away pages or history the user has
 * scrolled to.
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
  getDashboardOverview: jest.fn(),
}));

import * as api from '@/api/apis';
import { NO_SUPPORT } from '@/api/support';
import { Permissions, type Conversation, type Message } from '@/api/types';
import { signedIn } from '@/features/auth/authSlice';
import { bootstrapLoaded } from '@/features/bootstrap/bootstrapSlice';
import { conversationsLoaded } from '@/features/conversations/conversationsSlice';
import { threadLoaded } from '@/features/messages/messagesSlice';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { applyLiveBatch } from '../liveUpdateThunks';
import { activeConversationChanged } from '../realtimeSlice';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const conversation = (id: number): Conversation =>
  ({ id, status: 'open', unread_count: 0, window_open: true }) as Conversation;
const message = (id: number): Message =>
  ({ id, conversation_id: 42, direction: 'inbound', type: 'text' }) as Message;

const signIn = (permissions: string[] = [Permissions.conversationsView, Permissions.dashboardView]) => {
  store.dispatch(signedIn({ id: 5, name: 'Asha' }));
  store.dispatch(
    bootstrapLoaded({
      permissions,
      roles: ['agent'],
      numbers: [],
      tenantId: 3,
      realtime: null,
      support: NO_SUPPORT,
    }),
  );
};

beforeEach(() => {
  store.dispatch(appReset());
  jest.mocked(api.getConversations).mockReset();
  jest.mocked(api.getConversationMessages).mockReset();
  jest.mocked(api.getDashboardOverview).mockReset();
});

it('does nothing for screens that have not loaded, and nothing when signed out', async () => {
  await store.dispatch(applyLiveBatch({ conversationIds: [42], assignedAwayIds: [], lists: true, everything: true }));
  signIn();
  await store.dispatch(applyLiveBatch({ conversationIds: [42], assignedAwayIds: [], lists: true, everything: true }));
  await flush();

  expect(api.getConversations).not.toHaveBeenCalled();
  expect(api.getConversationMessages).not.toHaveBeenCalled();
  expect(api.getDashboardOverview).not.toHaveBeenCalled();
});

it('puts the fresh first page on top of the pages the user already scrolled to', async () => {
  signIn();
  store.dispatch(
    conversationsLoaded({ items: [conversation(1), conversation(2)], page: 1, lastPage: 3, total: 5, mode: 'initial' }),
  );
  store.dispatch(conversationsLoaded({ items: [conversation(3), conversation(4)], page: 2, lastPage: 3, total: 5, mode: 'more' }));
  jest.mocked(api.getConversations).mockResolvedValue({
    data: [conversation(9), conversation(3), conversation(1)],
    meta: { current_page: 1, last_page: 3, per_page: 20, total: 6 },
    httpStatus: 200,
  } as never);

  await store.dispatch(applyLiveBatch({ conversationIds: [9], assignedAwayIds: [], lists: true, everything: false }));
  await flush();

  const { items, page, status } = store.getState().conversations;
  expect(items.map((item) => item.id)).toEqual([9, 3, 1, 2, 4]);
  expect(page).toBe(2);
  // Quiet: no spinner nobody pulled.
  expect(status).toBe('ready');
  expect(jest.mocked(api.getConversations).mock.calls[0][0]).toMatchObject({ assigned: 'mine', page: 1 });
});

it('refreshes only the open thread, keeping older history, and only when the batch names it', async () => {
  signIn();
  store.dispatch(
    threadLoaded({ conversationId: '42', items: [message(20), message(19)], page: 1, lastPage: 2, total: 4, older: false }),
  );
  store.dispatch(
    threadLoaded({ conversationId: '42', items: [message(18), message(17)], page: 2, lastPage: 2, total: 4, older: true }),
  );
  store.dispatch(activeConversationChanged('42'));
  jest.mocked(api.getConversationMessages).mockResolvedValue({
    data: [message(21), message(20)],
    meta: { current_page: 1, last_page: 2, per_page: 30, total: 5 },
    httpStatus: 200,
  } as never);

  await store.dispatch(applyLiveBatch({ conversationIds: [7], assignedAwayIds: [], lists: false, everything: false }));
  await flush();
  expect(api.getConversationMessages).not.toHaveBeenCalled();

  await store.dispatch(applyLiveBatch({ conversationIds: [42], assignedAwayIds: [], lists: false, everything: false }));
  await flush();
  const thread = store.getState().messages.byConversation['42'];
  expect(thread.items.map((item) => item.id)).toEqual([21, 20, 19, 18, 17]);
  expect(thread.page).toBe(2);
});

it('respects permissions: no dashboard call without dashboard.view', async () => {
  signIn([Permissions.conversationsView]);
  store.dispatch(conversationsLoaded({ items: [conversation(1)], page: 1, lastPage: 1, total: 1, mode: 'initial' }));
  jest.mocked(api.getConversations).mockResolvedValue({
    data: [conversation(1)],
    meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
    httpStatus: 200,
  } as never);

  await store.dispatch(applyLiveBatch({ conversationIds: [], assignedAwayIds: [], lists: true, everything: true }));
  await flush();

  expect(api.getConversations).toHaveBeenCalledTimes(1);
  expect(api.getDashboardOverview).not.toHaveBeenCalled();
});
