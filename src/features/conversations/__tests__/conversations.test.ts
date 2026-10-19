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

import { bootstrapLoaded } from '@/features/bootstrap/bootstrapSlice';

import { filterChanged, scopeChanged, searchChanged, sortChanged } from '../conversationsSlice';
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

describe('the quiet refresh behind the live fallback', () => {
  it('replaces the rows without ever showing a loading state', async () => {
    await store.dispatch(loadConversations());
    const loadedAt = store.getState().conversations.loadedAt;
    expect(loadedAt).not.toBeNull();

    const statuses: string[] = [];
    const unsubscribe = store.subscribe(() => statuses.push(store.getState().conversations.status));
    jest.mocked(api.getConversations).mockResolvedValue(page([row(3), row(4)]));

    await store.dispatch(loadConversations({ quiet: true }));
    unsubscribe();

    // Nobody pulled this refresh, so no spinner and no skeleton may appear.
    expect(statuses).not.toContain('loading');
    expect(statuses).not.toContain('refreshing');
    expect(store.getState().conversations.items.map((item) => item.id)).toEqual([3, 4]);
  });

  it('keeps the rows and records the error when it fails', async () => {
    await store.dispatch(loadConversations());
    jest.mocked(api.getConversations).mockRejectedValue({ code: 'OFFLINE', message: 'offline' } as ApiError);

    await store.dispatch(loadConversations({ quiet: true }));

    const state = store.getState().conversations;
    expect(state.items).toHaveLength(2);
    expect(state.status).toBe('ready');
    expect(state.error?.code).toBe('OFFLINE');
  });
});

describe('CHAT-01 (2026-10-19): brand, branch and number', () => {
  // Brand 1 has two numbers, one of which also serves the whole brand.
  const bootstrap = {
    permissions: [],
    roles: [],
    numbers: [
      { id: 5, display_phone_number: '+919000000005', business_id: 1, location_ids: [10] },
      { id: 6, display_phone_number: '+919000000006', business_id: 1, location_ids: [], business_wide: true },
      { id: 7, display_phone_number: '+919000000007', business_id: 2, location_ids: [12] },
    ],
    account: { type: 'agency' as const },
    businesses: [
      { id: 1, name: 'Riders Rally' },
      { id: 2, name: 'Sunrise Dental' },
    ],
    locations: [
      { id: 10, business_id: 1, name: 'Pune' },
      { id: 12, business_id: 2, name: 'Surat' },
    ],
    tenantId: 1,
    realtime: null,
    support: { email: null, chat_url: null },
  };

  beforeEach(() => {
    store.dispatch(bootstrapLoaded(bootstrap as never));
  });

  it('sends one number as number_id, never as a list', async () => {
    store.dispatch(scopeChanged({ kind: 'number', id: 5 }));
    await store.dispatch(loadConversations());

    expect(paramsOf()).toMatchObject({ number_id: 5 });
    expect(paramsOf()).not.toHaveProperty('number_ids');
  });

  it('sends a brand as number_ids, never alongside number_id', async () => {
    store.dispatch(scopeChanged({ kind: 'brand', id: 1 }));
    await store.dispatch(loadConversations());

    expect(paramsOf()).toMatchObject({ number_ids: [5, 6] });
    expect(paramsOf()).not.toHaveProperty('number_id');
  });

  it('a branch includes the numbers that serve its whole brand', async () => {
    store.dispatch(scopeChanged({ kind: 'location', id: 10 }));
    await store.dispatch(loadConversations());

    expect(paramsOf()).toMatchObject({ number_ids: [5, 6] });
  });

  it('a scope that covers nothing shows an empty list rather than asking for everything', async () => {
    store.dispatch(bootstrapLoaded({ ...bootstrap, numbers: [] } as never));
    store.dispatch(scopeChanged({ kind: 'location', id: 10 }));
    await store.dispatch(loadConversations());

    // An empty `number_ids` would read as "no filter" on the server.
    expect(jest.mocked(api.getConversations)).not.toHaveBeenCalled();
    expect(store.getState().conversations.items).toEqual([]);
    expect(store.getState().conversations.total).toBe(0);
  });

  it('only sends sort when it is not the server default', async () => {
    await store.dispatch(loadConversations());
    expect(paramsOf()).not.toHaveProperty('sort');

    store.dispatch(sortChanged('oldest_waiting'));
    await store.dispatch(loadConversations());
    expect(paramsOf(1)).toMatchObject({ sort: 'oldest_waiting' });
  });

  it('keeps the scope while paging', async () => {
    jest.mocked(api.getConversations).mockResolvedValue(page([row(1)], 1, 2));
    store.dispatch(scopeChanged({ kind: 'number', id: 5 }));
    await store.dispatch(loadConversations());

    jest.mocked(api.getConversations).mockResolvedValue(page([row(2)], 2, 2));
    await store.dispatch(loadMoreConversations());

    expect(paramsOf(1)).toMatchObject({ number_id: 5, page: 2 });
  });
});
