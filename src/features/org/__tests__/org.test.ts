/**
 * ORG-02 to ORG-14. The risk on this screen is the optimistic lock: a write
 * that resends a version the server has already rejected would quietly
 * overwrite a colleague's change, so a 409 must always reload instead.
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
  getStructure: jest.fn(),
  renameBusiness: jest.fn(),
  archiveBusiness: jest.fn(),
  restoreBusiness: jest.fn(),
  createBusiness: jest.fn(),
  getBusinessMembers: jest.fn(),
  replaceBusinessMembers: jest.fn(),
  createLocation: jest.fn(),
  updateLocation: jest.fn(),
  archiveLocation: jest.fn(),
  restoreLocation: jest.fn(),
  previewNumberMapping: jest.fn(),
  saveNumberMapping: jest.fn(),
  chooseNumberClient: jest.fn(),
}));

import * as api from '@/api/apis';
import type { ApiError, Structure } from '@/api/types';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { orgErrorText, validateLocation } from '../orgCopy';
import {
  loadStructure,
  renameBusiness,
  replaceBusinessMembers,
  saveNumberMapping,
} from '../orgThunks';

const structure = (): Structure => ({
  account: { type: 'agency', classified: true },
  businesses: [{ id: 1, name: 'Riders Rally', version: 2, status: 'active' }],
  locations: [{ id: 10, business_id: 1, name: 'Pune', version: 1 }],
  workspaces: [{ id: 5, business_id: 1, location_ids: [10], mapping_version: 3 }],
});

const apiError = (code: ApiError['code'], status: number, extra: Partial<ApiError> = {}): ApiError =>
  ({ code, status, message: 'nope', ...extra }) as ApiError;

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  jest.mocked(api.getStructure).mockResolvedValue({ data: structure() } as never);
});

describe('loadStructure', () => {
  it('treats a 403 as a decision, not a fault', async () => {
    // ORG-02 denies an Agent by design; the screen falls back to bootstrap.
    jest.mocked(api.getStructure).mockRejectedValue(apiError('FORBIDDEN', 403));
    await store.dispatch(loadStructure());

    expect(store.getState().org.status).toBe('denied');
  });

  it('shows the failure screen only when nothing is loaded yet', async () => {
    await store.dispatch(loadStructure());
    jest.mocked(api.getStructure).mockRejectedValue(apiError('TIMEOUT', 0));
    await store.dispatch(loadStructure());

    expect(store.getState().org.status).toBe('ready');
    expect(store.getState().org.structure?.businesses).toHaveLength(1);
  });
});

describe('the optimistic lock', () => {
  beforeEach(async () => {
    await store.dispatch(loadStructure());
    jest.mocked(api.getStructure).mockClear();
  });

  it('sends the version it was shown', async () => {
    jest
      .mocked(api.renameBusiness)
      .mockResolvedValue({ data: { id: 1, name: 'Riders Rally Pune', version: 3 } } as never);

    await store.dispatch(
      renameBusiness({ businessId: 1, name: 'Riders Rally Pune', expectedVersion: 2 }),
    );

    expect(jest.mocked(api.renameBusiness).mock.calls[0][1]).toEqual({
      name: 'Riders Rally Pune',
      expected_version: 2,
    });
    expect(store.getState().org.structure?.businesses[0]).toMatchObject({ version: 3 });
  });

  it('a 409 reloads instead of resending the rejected version', async () => {
    jest.mocked(api.renameBusiness).mockRejectedValue(apiError('CONFLICT', 409));

    await store.dispatch(renameBusiness({ businessId: 1, name: 'Nope', expectedVersion: 2 }));

    expect(jest.mocked(api.renameBusiness)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(api.getStructure)).toHaveBeenCalledTimes(1);
  });

  it('a mapping save carries the workspace mapping_version', async () => {
    jest.mocked(api.saveNumberMapping).mockResolvedValue({
      data: { id: 5, business_id: 1, location_ids: [], business_wide: true, mapping_version: 4 },
    } as never);

    await store.dispatch(
      saveNumberMapping({ numberId: 5, locationIds: [], expectedVersion: 3 }),
    );

    expect(jest.mocked(api.saveNumberMapping).mock.calls[0][1]).toEqual({
      location_ids: [],
      expected_version: 3,
    });
    // An empty list means the whole brand, and the server says so back.
    expect(store.getState().org.structure?.workspaces[0]).toMatchObject({ business_wide: true });
  });
});

describe('ORG-08, replacing who works on a brand', () => {
  it('sends every id that should stay, because it is a full replacement', async () => {
    jest.mocked(api.replaceBusinessMembers).mockResolvedValue({
      data: { version: 8, members: [], account_wide: [], candidates: [] },
    } as never);

    await store.dispatch(
      replaceBusinessMembers({ businessId: 1, userIds: [34, 35], expectedVersion: 7 }),
    );

    expect(jest.mocked(api.replaceBusinessMembers).mock.calls[0][1]).toEqual({
      user_ids: [34, 35],
      expected_version: 7,
    });
  });

  it('an empty list is sent as an empty list, not skipped', async () => {
    // Removing everyone is a real choice the screen has to be able to make.
    jest.mocked(api.replaceBusinessMembers).mockResolvedValue({
      data: { version: 9, members: [], account_wide: [], candidates: [] },
    } as never);

    await store.dispatch(
      replaceBusinessMembers({ businessId: 1, userIds: [], expectedVersion: 8 }),
    );

    expect(jest.mocked(api.replaceBusinessMembers).mock.calls[0][1]).toMatchObject({
      user_ids: [],
    });
  });
});

describe('orgErrorText', () => {
  it('explains a version clash in the words the workbook asks for', () => {
    expect(orgErrorText(apiError('CONFLICT', 409))).toMatch(/Someone else changed this/);
  });

  it('never reveals that a hidden record exists', () => {
    expect(orgErrorText(apiError('NOT_FOUND', 404))).toBe('That is no longer available.');
  });

  it('prefers the server own wording, which knows this account limits', () => {
    const error = apiError('VALIDATION', 422, {
      errors: { name: ['This account already has 5 clients, the most allowed.'] },
    });
    expect(orgErrorText(error)).toBe('This account already has 5 clients, the most allowed.');
  });
});

describe('validateLocation', () => {
  it('wants a name', () => {
    expect(validateLocation({ name: '  ' })).toMatch(/name/i);
    expect(validateLocation({ name: 'Baner branch' })).toBeNull();
  });

  it('checks a pincode is six digits', () => {
    expect(validateLocation({ name: 'Baner', pincode: '4110' })).toMatch(/6 digits/);
    expect(validateLocation({ name: 'Baner', pincode: '411045' })).toBeNull();
  });

  it('holds the workbook lengths', () => {
    expect(validateLocation({ name: 'x'.repeat(121) })).toMatch(/120/);
    expect(validateLocation({ name: 'Baner', city: 'x'.repeat(81) })).toMatch(/city/i);
  });
});
