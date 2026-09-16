/**
 * Stage 7: every chip and the search box are CHAT-01 queries, and paging must
 * never duplicate or lose rows.
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

jest.mock('@/api/apis', () => ({ getConversations: jest.fn() }));

import * as api from '@/api/apis';
import type { ApiError, Conversation } from '@/api/types';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { filterChanged, searchChanged } from '../conversationsSlice';
import { loadConversations, loadMoreConversations } from '../conversationsThunks';

const row = (id: number): Conversation =>
  ({ id, status: 'open', unread_count: 0, window_open: true }) as Conversation;

const page = (items: Conversation[], current = 1, last = 1, total = items.length) =>
  ({ data: items, meta: { current_page: current, per_page: 20, total, last_page: last }, httpStatus: 200 }) as never;

const paramsOf = (call = 0) => jest.mocked(api.getConversations).mock.calls[call][0];

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  jest.mocked(api.getConversations).mockResolvedValue(page([row(1), row(2)]));
});

describe('query building', () => {
  it('scopes the default list to the signed-in user', async () => {
    await store.dispatch(loadConversations());

    expect(paramsOf()).toMatchObject({ assigned: 'mine', page: 1, per_page: 20 });
    expect(paramsOf()).not.toHaveProperty('search');
  });

  it('turns each chip into its own server-side filter', async () => {
    const expected: Record<string, Record<string, unknown>> = {
      unread: { assigned: 'mine', unread: 1 },
      open: { assigned: 'mine', status: 'open' },
      urgent: { assigned: 'mine', priority: 'urgent' },
      unassigned: { assigned: 'unassigned' },
    };

    for (const [filter, params] of Object.entries(expected)) {
      jest.clearAllMocks();
      jest.mocked(api.getConversations).mockResolvedValue(page([row(1)]));
      store.dispatch(filterChanged(filter as never));
      await store.dispatch(loadConversations());
      expect(paramsOf()).toMatchObject(params);
    }
  });

  it('sends the search term to the API instead of filtering locally', async () => {
    store.dispatch(searchChanged('priya'));

    await store.dispatch(loadConversations());

    expect(paramsOf()).toMatchObject({ assigned: 'mine', search: 'priya' });
  });

  it('clears the visible rows as soon as the query changes', async () => {
    await store.dispatch(loadConversations());
    expect(store.getState().conversations.items).toHaveLength(2);

    store.dispatch(filterChanged('unread'));

    expect(store.getState().conversations.items).toEqual([]);
    expect(store.getState().conversations.status).toBe('loading');
  });
});

describe('paging', () => {
  it('appends the next page without repeating a row', async () => {
    jest.mocked(api.getConversations).mockResolvedValue(page([row(1), row(2)], 1, 2, 3));
    await store.dispatch(loadConversations());

    // The server re-sends row 2 on page 2 because new chats shifted the order.
    jest.mocked(api.getConversations).mockResolvedValue(page([row(2), row(3)], 2, 2, 3));
    await store.dispatch(loadMoreConversations());

    expect(store.getState().conversations.items.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(store.getState().conversations.page).toBe(2);
  });

  it('does not ask for a page that does not exist', async () => {
    await store.dispatch(loadConversations());
    jest.clearAllMocks();

    await store.dispatch(loadMoreConversations());

    expect(api.getConversations).not.toHaveBeenCalled();
  });

  it('replaces, never appends, when page one is reloaded', async () => {
    jest.mocked(api.getConversations).mockResolvedValue(page([row(1), row(2)], 1, 2, 4));
    await store.dispatch(loadConversations());
    jest.mocked(api.getConversations).mockResolvedValue(page([row(9)], 1, 1, 1));

    await store.dispatch(loadConversations({ refresh: true }));

    expect(store.getState().conversations.items.map((item) => item.id)).toEqual([9]);
  });
});

describe('failures', () => {
  it('shows the error screen only when nothing is listed yet', async () => {
    jest.mocked(api.getConversations).mockRejectedValue({
      code: 'OFFLINE',
      message: 'You are offline.',
      isOffline: true,
    } satisfies ApiError);

    await store.dispatch(loadConversations());

    expect(store.getState().conversations.status).toBe('failed');
  });

  it('keeps the listed rows when a refresh fails', async () => {
    await store.dispatch(loadConversations());
    jest.mocked(api.getConversations).mockRejectedValue({
      code: 'SERVER_ERROR',
      status: 500,
      message: 'Wazigo is having trouble right now.',
    } satisfies ApiError);

    await store.dispatch(loadConversations({ refresh: true }));

    const state = store.getState().conversations;
    expect(state.status).toBe('ready');
    expect(state.items).toHaveLength(2);
    expect(state.error?.code).toBe('SERVER_ERROR');
  });

  it('treats a cancelled request as replaced, not failed', async () => {
    jest.mocked(api.getConversations).mockRejectedValue({
      code: 'CANCELLED',
      message: 'Request cancelled.',
    } satisfies ApiError);

    await store.dispatch(loadConversations());

    const state = store.getState().conversations;
    expect(state.status).not.toBe('failed');
    expect(state.error).toBeNull();
  });
});
