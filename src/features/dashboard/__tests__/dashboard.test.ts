/**
 * Stage 6: which DASH-01 fields reach the screen, and what a refresh failure
 * is allowed to do to numbers that are already visible.
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

jest.mock('@/api/apis', () => ({ getDashboardOverview: jest.fn(), getConversations: jest.fn() }));

import * as api from '@/api/apis';
import type { ApiError, Conversation, DashboardOverview } from '@/api/types';
import { conversationPatched } from '@/features/conversations/conversationsSlice';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import {
  selectDashboardDelivery,
  selectDashboardTotals,
  selectPriorityBreakdown,
} from '../dashboardSelectors';
import { loadDashboard, loadRecentConversations } from '../dashboardThunks';

const overview = {
  totals: { total: 124, open: 18, unread: 6, window_open: 4, closed: 99 },
  by_priority: [
    { priority: 'normal', count: 12 },
    { priority: 'urgent', count: 3 },
    { priority: 'unknown', count: 7 },
    { priority: 'high', count: 5 },
  ],
  activity: {
    days: [{ date: '2026-09-16', label: 'Tue', weekday: 'Tue', inbound: 3, outbound: 2 }],
    inbound_total: 30,
    outbound_total: 21,
    today: { inbound: 3, outbound: 2 },
    busiest: { label: 'Mon', total: 14 },
  },
  delivery: { window_days: 7, total: 40, delivered: 30, read: 20, failed: 4, in_flight: 6 },
} as unknown as DashboardOverview;

const resolveWith = (data: DashboardOverview) =>
  jest.mocked(api.getDashboardOverview).mockResolvedValue({ data, httpStatus: 200 });

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  resolveWith(overview);
});

describe('loadDashboard', () => {
  it('keeps only the four documented totals', async () => {
    await store.dispatch(loadDashboard()).unwrap();

    expect(selectDashboardTotals(store.getState())).toEqual({
      total: 124,
      open: 18,
      unread: 6,
      window_open: 4,
    });
  });

  it('reports zeros rather than undefined when the payload is thin', async () => {
    resolveWith({ totals: { total: 2 } } as unknown as DashboardOverview);

    await store.dispatch(loadDashboard()).unwrap();

    expect(selectDashboardTotals(store.getState())).toEqual({
      total: 2,
      open: 0,
      unread: 0,
      window_open: 0,
    });
    expect(selectDashboardDelivery(store.getState())).toBeNull();
  });

  it('orders priorities by urgency and drops ones it does not recognise', async () => {
    await store.dispatch(loadDashboard()).unwrap();

    expect(selectPriorityBreakdown(store.getState())).toEqual([
      { priority: 'urgent', count: 3 },
      { priority: 'high', count: 5 },
      { priority: 'normal', count: 12 },
    ]);
  });

  it('fails outright only when there is nothing on screen yet', async () => {
    jest.mocked(api.getDashboardOverview).mockRejectedValue({
      code: 'OFFLINE',
      message: 'You are offline.',
      isOffline: true,
    } satisfies ApiError);

    await store.dispatch(loadDashboard());

    expect(store.getState().dashboard.status).toBe('failed');
    expect(store.getState().dashboard.overview).toBeNull();
  });

  it('keeps the visible figures when a refresh fails', async () => {
    await store.dispatch(loadDashboard()).unwrap();
    jest.mocked(api.getDashboardOverview).mockRejectedValue({
      code: 'SERVER_ERROR',
      status: 500,
      message: 'Wazigo is having trouble right now.',
    } satisfies ApiError);

    await store.dispatch(loadDashboard({ refresh: true }));

    const state = store.getState().dashboard;
    expect(state.status).toBe('ready');
    expect(state.overview).not.toBeNull();
    expect(state.error?.code).toBe('SERVER_ERROR');
    expect(selectDashboardTotals(store.getState()).total).toBe(124);
  });

  it('is wiped by a session reset', async () => {
    await store.dispatch(loadDashboard()).unwrap();

    store.dispatch(appReset());

    expect(store.getState().dashboard).toMatchObject({ status: 'idle', overview: null });
  });
});

describe('recent conversations', () => {
  const row = (id: number, fields: Partial<Conversation> = {}): Conversation =>
    ({ id, status: 'open', unread_count: 0, window_open: true, ...fields }) as Conversation;

  const listWith = (items: Conversation[]) =>
    jest.mocked(api.getConversations).mockResolvedValue({
      data: items,
      meta: { current_page: 1, per_page: 3, total: items.length, last_page: 1 },
      httpStatus: 200,
    } as never);

  it("asks for the agent's own conversations, newest page, three rows", async () => {
    listWith([row(1), row(2), row(3)]);

    await store.dispatch(loadRecentConversations()).unwrap();

    // Personal scope is the server's job (backend blocker 1), never a local filter.
    expect(api.getConversations).toHaveBeenCalledWith({ assigned: 'mine', page: 1, per_page: 3 });
    expect(store.getState().dashboard.recent).toMatchObject({ status: 'ready', error: null });
    expect(store.getState().dashboard.recent.items.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('never shows more than three rows, whatever the server sends', async () => {
    listWith([row(1), row(2), row(3), row(4), row(5)]);

    await store.dispatch(loadRecentConversations()).unwrap();

    expect(store.getState().dashboard.recent.items).toHaveLength(3);
  });

  it('fails visibly the first time, but keeps rows it already has', async () => {
    jest.mocked(api.getConversations).mockRejectedValue({ code: 'SERVER_ERROR', message: 'down' } as ApiError);
    await store.dispatch(loadRecentConversations());
    expect(store.getState().dashboard.recent.status).toBe('failed');

    listWith([row(1), row(2)]);
    await store.dispatch(loadRecentConversations()).unwrap();
    jest.mocked(api.getConversations).mockRejectedValue({ code: 'OFFLINE', message: 'offline' } as ApiError);
    await store.dispatch(loadRecentConversations());

    expect(store.getState().dashboard.recent.status).toBe('ready');
    expect(store.getState().dashboard.recent.items).toHaveLength(2);
    expect(store.getState().dashboard.recent.error?.code).toBe('OFFLINE');
  });

  it("follows a conversation changed elsewhere, without refetching", async () => {
    listWith([row(1, { unread_count: 4 }), row(2)]);
    await store.dispatch(loadRecentConversations()).unwrap();

    // e.g. CHAT-06 mark-read answering with the updated Conversation.
    store.dispatch(conversationPatched(row(1, { unread_count: 0 })));

    expect(store.getState().dashboard.recent.items[0].unread_count).toBe(0);
    expect(api.getConversations).toHaveBeenCalledTimes(1);
  });

  it('is wiped by a session reset', async () => {
    listWith([row(1)]);
    await store.dispatch(loadRecentConversations()).unwrap();

    store.dispatch(appReset());

    expect(store.getState().dashboard.recent).toEqual({ items: [], status: 'idle', error: null });
  });
});
