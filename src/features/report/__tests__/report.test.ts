/**
 * REP-01 to REP-04. Two rules carry the weight here: a figure the server could
 * not give is "Not available" and never 0, and a section the person may not see
 * comes back null with a reason rather than as an empty one.
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
  getAccountOverview: jest.fn(),
  getDeliveryIssues: jest.fn(),
  getNumberToday: jest.fn(),
  getActionDesk: jest.fn(),
}));

import * as api from '@/api/apis';
import type { AccountOverview, ApiError, ReportMetric } from '@/api/types';
import { bootstrapLoaded } from '@/features/bootstrap/bootstrapSlice';
import { scopeChanged } from '@/features/conversations/conversationsSlice';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { metricValue, sectionUnavailable } from '../reportCopy';
import { selectMetric, selectOverviewIsPartial } from '../reportSelectors';
import { loadAccountOverview, loadActionDesk, loadNumberToday } from '../reportThunks';

const metric = (key: string, value: number | null, denominator?: number): ReportMetric => ({
  key,
  label: key,
  value,
  denominator,
});

const overview = (partial = false): AccountOverview => ({
  as_of: '2026-10-19T10:00:00Z',
  scope: {
    account_id: 1,
    workspace_ids: [5],
    permitted_workspace_ids: [5],
    partial_access: partial,
  },
  period: { key: '30d', from: '2026-09-19', to: '2026-10-19', timezone: 'Asia/Kolkata', days: 30 },
  snapshot_metrics: [metric('open_conversations', 7), metric('customers', null)],
  period_metrics: [metric('messages_failed', 2)],
});

const apiError = (code: ApiError['code'], status: number): ApiError =>
  ({ code, status, message: 'nope' }) as ApiError;

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
});

describe('metricValue', () => {
  it('says "Not available" for a null figure, never 0', () => {
    // 0 means none happened; null means nobody knows. They are not the same
    // answer to someone deciding whether to act.
    expect(metricValue(metric('x', null))).toBe('Not available');
    expect(metricValue(metric('x', 0))).toBe('0');
    expect(metricValue(null)).toBe('Not available');
  });

  it('shows a denominator when the server gave one', () => {
    expect(metricValue(metric('x', 3, 10))).toBe('3 of 10');
  });
});

describe('sectionUnavailable', () => {
  it('separates "not allowed" from "could not be built"', () => {
    expect(sectionUnavailable({ ai_health: 'no_permission' }, 'ai_health')).toMatch(/access/i);
    expect(sectionUnavailable({ ai_health: 'unavailable' }, 'ai_health')).toMatch(/could not/i);
    expect(sectionUnavailable({}, 'ai_health')).toBeNull();
    expect(sectionUnavailable(null, 'ai_health')).toBeNull();
  });
});

describe('REP-01', () => {
  it('asks about the brand the app already has selected', async () => {
    store.dispatch(
      bootstrapLoaded({
        permissions: [],
        roles: [],
        numbers: [{ id: 5, display_phone_number: '+919000000005', business_id: 1 }],
        account: { type: 'agency' },
        businesses: [{ id: 1, name: 'Riders Rally' }],
        locations: [],
        tenantId: 1,
        realtime: null,
        support: { email: null, chat_url: null },
      } as never),
    );
    store.dispatch(scopeChanged({ kind: 'brand', id: 1 }));
    jest.mocked(api.getAccountOverview).mockResolvedValue({ data: overview() } as never);

    await store.dispatch(loadAccountOverview());

    // A brand goes as business_id; the Report API has no idea what a branch is.
    expect(jest.mocked(api.getAccountOverview).mock.calls[0][0]).toMatchObject({ business_id: 1 });
  });

  it('keeps a null metric null rather than inventing a zero', async () => {
    jest.mocked(api.getAccountOverview).mockResolvedValue({ data: overview() } as never);
    await store.dispatch(loadAccountOverview());

    expect(selectMetric('customers')(store.getState())?.value).toBeNull();
    expect(selectMetric('open_conversations')(store.getState())?.value).toBe(7);
  });

  it('remembers when the figures cover only part of the account', async () => {
    jest.mocked(api.getAccountOverview).mockResolvedValue({ data: overview(true) } as never);
    await store.dispatch(loadAccountOverview());

    expect(selectOverviewIsPartial(store.getState())).toBe(true);
  });

  it('REP-10: a 403 means the overview is switched off, not that it failed', async () => {
    jest.mocked(api.getAccountOverview).mockRejectedValue(apiError('FORBIDDEN', 403));
    await store.dispatch(loadAccountOverview());

    expect(store.getState().report.overviewDisabled).toBe(true);
  });

  it('any other failure leaves the last figures on screen', async () => {
    jest.mocked(api.getAccountOverview).mockResolvedValue({ data: overview() } as never);
    await store.dispatch(loadAccountOverview());

    jest.mocked(api.getAccountOverview).mockRejectedValue(apiError('TIMEOUT', 0));
    await store.dispatch(loadAccountOverview({ quiet: true }));

    expect(store.getState().report.overview).not.toBeNull();
    expect(store.getState().report.overviewStatus).toBe('ready');
    expect(store.getState().report.overviewDisabled).toBe(false);
  });
});

describe('REP-03 and REP-04', () => {
  it('takes the first page of the desk from the Today reply', async () => {
    jest.mocked(api.getNumberToday).mockResolvedValue({
      data: {
        as_of: '2026-10-19T10:00:00Z',
        workspace: { account_id: 1, number_id: 5 },
        period: { key: 'today', from: '', to: '', timezone: 'Asia/Kolkata', days: 1 },
        summary_metrics: [],
        action_desk: { items: [{ id: 1, type: 'conversation', conversation_id: 9 }], next_cursor: 'c1' },
      },
    } as never);

    await store.dispatch(loadNumberToday({ numberId: 5 }));

    expect(store.getState().report.desk?.items).toHaveLength(1);
    // No second call: REP-03 already answered it.
    expect(jest.mocked(api.getActionDesk)).not.toHaveBeenCalled();
  });

  it('a cursor appends, a tab replaces', async () => {
    jest.mocked(api.getActionDesk).mockResolvedValue({
      data: { items: [{ id: 1, type: 'conversation', conversation_id: 9 }], next_cursor: 'c1' },
    } as never);
    await store.dispatch(loadActionDesk({ numberId: 5, params: { tab: 'overdue' } }));

    jest.mocked(api.getActionDesk).mockResolvedValue({
      data: { items: [{ id: 2, type: 'follow_up', conversation_id: 9 }], next_cursor: null },
    } as never);
    await store.dispatch(loadActionDesk({ numberId: 5, params: { tab: 'overdue', cursor: 'c1' } }));

    expect(store.getState().report.desk?.items.map((item) => item.id)).toEqual([1, 2]);

    jest.mocked(api.getActionDesk).mockResolvedValue({
      data: { items: [{ id: 3, type: 'conversation', conversation_id: 11 }], next_cursor: null },
    } as never);
    await store.dispatch(loadActionDesk({ numberId: 5, params: { tab: 'due_today' } }));

    expect(store.getState().report.desk?.items.map((item) => item.id)).toEqual([3]);
  });

  it('switching number clears the previous one rather than mixing them', async () => {
    jest.mocked(api.getNumberToday).mockResolvedValue({
      data: {
        as_of: '',
        workspace: { account_id: 1, number_id: 5 },
        period: { key: 'today', from: '', to: '', timezone: 'Asia/Kolkata', days: 1 },
        summary_metrics: [metric('needs_attention', 4)],
        action_desk: { items: [{ id: 1, type: 'conversation', conversation_id: 9 }] },
      },
    } as never);
    await store.dispatch(loadNumberToday({ numberId: 5 }));

    jest.mocked(api.getNumberToday).mockRejectedValue(apiError('TIMEOUT', 0));
    await store.dispatch(loadNumberToday({ numberId: 6 }));

    // The old number's figures must not read as the new one's.
    expect(store.getState().report.today).toBeNull();
    expect(store.getState().report.todayFor).toBe(6);
  });
});
