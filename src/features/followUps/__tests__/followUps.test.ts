/**
 * CHAT-28 to CHAT-32. The two things that matter are the optimistic lock and
 * the idempotency key: a stale `version` must never be resent, and a retry
 * must never create a second follow-up.
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
  getFollowUps: jest.fn(),
  createFollowUp: jest.fn(),
  acknowledgeFollowUp: jest.fn(),
  snoozeFollowUp: jest.fn(),
  completeFollowUp: jest.fn(),
  cancelFollowUp: jest.fn(),
  updateFollowUp: jest.fn(),
  getFollowUp: jest.fn(),
}));

import * as api from '@/api/apis';
import type { ApiError, FollowUp } from '@/api/types';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { validateFollowUp } from '../followUpCopy';
import { selectFollowUps, selectOpenFollowUpCount } from '../followUpsSelectors';
import {
  createFollowUp,
  loadFollowUpDetail,
  loadFollowUps,
  transitionFollowUp,
} from '../followUpsThunks';

const CONVERSATION_ID = '42';

const followUp = (id: number, overrides: Partial<FollowUp> = {}): FollowUp =>
  ({
    id,
    conversation_id: 42,
    kind: 'callback',
    title: `Follow-up ${id}`,
    status: 'open',
    version: 1,
    allowed_actions: ['acknowledge', 'snooze', 'complete', 'cancel'],
    ...overrides,
  }) as FollowUp;

const list = (items: FollowUp[], canCreate = true) => ({
  data: { follow_ups: items, can_create: canCreate, limit: { open: items.length, max: 5 } },
  meta: undefined,
});

const apiError = (code: ApiError['code'], status: number): ApiError =>
  ({ code, status, message: 'nope' }) as ApiError;

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  jest.mocked(api.getFollowUps).mockResolvedValue(list([followUp(1)]) as never);
});

describe('loadFollowUps', () => {
  it('keeps the server answer about creating, rather than guessing from the rows', async () => {
    jest.mocked(api.getFollowUps).mockResolvedValue(list([followUp(1)], false) as never);
    await store.dispatch(loadFollowUps({ conversationId: CONVERSATION_ID }));

    const entry = selectFollowUps(CONVERSATION_ID)(store.getState());
    expect(entry.canCreate).toBe(false);
    expect(entry.limit).toEqual({ open: 1, max: 5 });
  });

  it('counts open, acknowledged and snoozed as still outstanding', async () => {
    jest.mocked(api.getFollowUps).mockResolvedValue(
      list([
        followUp(1, { status: 'open' }),
        followUp(2, { status: 'snoozed' }),
        followUp(3, { status: 'acknowledged' }),
        followUp(4, { status: 'done' }),
        followUp(5, { status: 'cancelled' }),
      ]) as never,
    );
    await store.dispatch(loadFollowUps({ conversationId: CONVERSATION_ID }));

    expect(selectOpenFollowUpCount(CONVERSATION_ID)(store.getState())).toBe(3);
  });

  it('keeps the rows on screen when a refresh fails', async () => {
    await store.dispatch(loadFollowUps({ conversationId: CONVERSATION_ID }));
    jest.mocked(api.getFollowUps).mockRejectedValue(apiError('TIMEOUT', 0));
    await store.dispatch(loadFollowUps({ conversationId: CONVERSATION_ID }));

    const entry = selectFollowUps(CONVERSATION_ID)(store.getState());
    expect(entry.items).toHaveLength(1);
    expect(entry.status).toBe('ready');
    expect(entry.error).not.toBeNull();
  });
});

describe('createFollowUp', () => {
  it('sends the idempotency key the caller generated, untouched', async () => {
    jest.mocked(api.createFollowUp).mockResolvedValue({ data: followUp(7) } as never);

    await store.dispatch(
      createFollowUp({
        conversationId: CONVERSATION_ID,
        payload: {
          kind: 'callback',
          title: 'Call back about price',
          due_at: '2026-10-21T11:00:00+05:30',
          idempotency_key: 'abc-123',
        },
      }),
    );

    expect(jest.mocked(api.createFollowUp).mock.calls[0][1]).toMatchObject({
      idempotency_key: 'abc-123',
    });
    expect(selectFollowUps(CONVERSATION_ID)(store.getState()).items.map((i) => i.id)).toContain(7);
  });
});

describe('transitionFollowUp', () => {
  beforeEach(async () => {
    jest.mocked(api.getFollowUps).mockResolvedValue(list([followUp(1, { version: 3 })]) as never);
    await store.dispatch(loadFollowUps({ conversationId: CONVERSATION_ID }));
  });

  it('carries the row version so the server can refuse a stale change', async () => {
    jest
      .mocked(api.completeFollowUp)
      .mockResolvedValue({ data: followUp(1, { status: 'done', version: 4 }) } as never);

    await store.dispatch(
      transitionFollowUp({
        conversationId: CONVERSATION_ID,
        followUpId: 1,
        transition: 'complete',
        payload: { version: 3, note: 'Spoke to her, all good' },
      }),
    );

    expect(jest.mocked(api.completeFollowUp).mock.calls[0][1]).toEqual({
      version: 3,
      note: 'Spoke to her, all good',
    });
    // The row is replaced wholesale, new version included.
    expect(selectFollowUps(CONVERSATION_ID)(store.getState()).items[0]).toMatchObject({
      status: 'done',
      version: 4,
    });
  });

  it('a 409 re-reads the list instead of resending the rejected version', async () => {
    jest.mocked(api.cancelFollowUp).mockRejectedValue(apiError('CONFLICT', 409));
    jest
      .mocked(api.getFollowUps)
      .mockResolvedValue(list([followUp(1, { status: 'done', version: 9 })]) as never);

    await store.dispatch(
      transitionFollowUp({
        conversationId: CONVERSATION_ID,
        followUpId: 1,
        transition: 'cancel',
        payload: { version: 3, reason: 'Not needed' },
      }),
    );

    expect(jest.mocked(api.cancelFollowUp)).toHaveBeenCalledTimes(1);
    // Re-read: the first call was the initial load, the second is the recovery.
    expect(jest.mocked(api.getFollowUps)).toHaveBeenCalledTimes(2);
  });

  it('never applies a refused transition locally', async () => {
    jest.mocked(api.completeFollowUp).mockRejectedValue(apiError('VALIDATION', 422));

    await store.dispatch(
      transitionFollowUp({
        conversationId: CONVERSATION_ID,
        followUpId: 1,
        transition: 'complete',
        payload: { version: 3, note: 'done' },
      }),
    );

    expect(selectFollowUps(CONVERSATION_ID)(store.getState()).items[0].status).toBe('open');
  });
});

describe('validateFollowUp', () => {
  const now = Date.parse('2026-10-19T09:00:00Z');

  it('refuses a time that has passed', () => {
    expect(validateFollowUp({ title: 'Call', dueAt: new Date(now - 1000) }, now)).toMatch(/future/i);
  });

  it('refuses a time beyond a year', () => {
    const tooFar = new Date(now + 366 * 24 * 60 * 60 * 1000);
    expect(validateFollowUp({ title: 'Call', dueAt: tooFar }, now)).toMatch(/365 days/);
  });

  it('wants a title and a time', () => {
    expect(validateFollowUp({ title: '   ', dueAt: new Date(now + 1000) }, now)).toMatch(/title/i);
    expect(validateFollowUp({ title: 'Call', dueAt: null }, now)).toMatch(/when/i);
  });

  it('accepts a sensible one', () => {
    expect(validateFollowUp({ title: 'Call back', dueAt: new Date(now + 3600_000) }, now)).toBeNull();
  });
});

describe('CHAT-33: the history of one follow-up', () => {
  it('reads the events the server recorded, in its own words', async () => {
    jest.mocked(api.getFollowUp).mockResolvedValue({
      data: {
        follow_up: followUp(1, { status: 'done', version: 4 }),
        events: [
          { id: 1, action: 'created', to_status: 'open', actor: { type: 'user', name: 'Asha' } },
          { id: 2, action: 'completed', from_status: 'open', to_status: 'done', note: 'Called' },
        ],
      },
    } as never);

    const detail = await store.dispatch(loadFollowUpDetail({ followUpId: 1 })).unwrap();

    expect(detail.events.map((event) => event.action)).toEqual(['created', 'completed']);
    expect(detail.follow_up.status).toBe('done');
  });

  it('a follow-up with no history reads as empty, not as a failure', async () => {
    jest.mocked(api.getFollowUp).mockResolvedValue({
      data: { follow_up: followUp(1), events: null },
    } as never);

    const detail = await store.dispatch(loadFollowUpDetail({ followUpId: 1 })).unwrap();

    expect(detail.events).toEqual([]);
  });
});
