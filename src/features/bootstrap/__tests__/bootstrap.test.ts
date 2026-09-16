/**
 * Stage 5: what `/me/bootstrap` puts into the store, and how each failure is
 * classified - retryable, denied, or a dead session.
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

jest.mock('@/api/apis', () => ({ getBootstrap: jest.fn() }));

import * as api from '@/api/apis';
import { Permissions, type ApiError } from '@/api/types';
import { signedIn } from '@/features/auth/authSlice';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import {
  selectHasAnyPermission,
  selectHasPermission,
  selectHasRole,
  selectPrimaryNumber,
} from '../bootstrapSelectors';
import { loadBootstrap } from '../bootstrapThunks';

const payload = {
  user: { id: 7, name: 'Asha Rao', phone: '+919876543210' },
  roles: ['agent'],
  permissions: [Permissions.conversationsView, Permissions.conversationsSend],
  numbers: [
    { id: 1, display_phone_number: '+91 11111 11111' },
    { id: 2, display_phone_number: '+91 22222 22222', is_primary: true, verified_name: 'Wazigo' },
  ],
  routes: { ignored: true },
  billing: { ignored: true },
};

const failWith = (error: ApiError) => jest.mocked(api.getBootstrap).mockRejectedValue(error);

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  store.dispatch(signedIn({ id: 7, name: 'Asha' }));
  jest.mocked(api.getBootstrap).mockResolvedValue({ data: payload, httpStatus: 200 });
});

describe('loadBootstrap', () => {
  it('keeps only the fields mobile uses and refreshes the user', async () => {
    await store.dispatch(loadBootstrap()).unwrap();

    const state = store.getState();
    expect(state.bootstrap.status).toBe('ready');
    expect(state.bootstrap.permissions).toEqual([
      Permissions.conversationsView,
      Permissions.conversationsSend,
    ]);
    expect(state.bootstrap.roles).toEqual(['agent']);
    expect(state.bootstrap.numbers).toHaveLength(2);
    expect(state.bootstrap).not.toHaveProperty('routes');
    expect(state.auth.user).toMatchObject({ id: 7, name: 'Asha Rao' });
  });

  it('accepts roles sent as objects and tolerates missing lists', async () => {
    jest.mocked(api.getBootstrap).mockResolvedValue({
      data: { user: { id: 7, name: 'Asha' }, roles: [{ name: 'supervisor' }] },
      httpStatus: 200,
    } as never);

    await store.dispatch(loadBootstrap()).unwrap();

    const { bootstrap } = store.getState();
    expect(bootstrap.roles).toEqual(['supervisor']);
    expect(bootstrap.permissions).toEqual([]);
    expect(bootstrap.numbers).toEqual([]);
    expect(bootstrap.status).toBe('ready');
  });

  it('treats 403 as denied rather than something to retry', async () => {
    failWith({ code: 'FORBIDDEN', status: 403, message: 'Your account is not enabled for mobile.' });

    await store.dispatch(loadBootstrap());

    expect(store.getState().bootstrap.status).toBe('denied');
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('keeps the session when the failure is only a bad connection', async () => {
    failWith({ code: 'OFFLINE', message: 'You are offline.', isOffline: true, isNetworkError: true });

    await store.dispatch(loadBootstrap());

    expect(store.getState().bootstrap.status).toBe('failed');
    expect(store.getState().bootstrap.error?.isOffline).toBe(true);
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('retries cleanly after a failure', async () => {
    failWith({ code: 'SERVER_ERROR', status: 500, message: 'Wazigo is having trouble right now.' });
    await store.dispatch(loadBootstrap());
    expect(store.getState().bootstrap.status).toBe('failed');

    jest.mocked(api.getBootstrap).mockResolvedValue({ data: payload, httpStatus: 200 });
    await store.dispatch(loadBootstrap()).unwrap();

    expect(store.getState().bootstrap).toMatchObject({ status: 'ready', error: null });
  });

  it('is wiped by a session reset so the next user never inherits permissions', async () => {
    await store.dispatch(loadBootstrap()).unwrap();

    store.dispatch(appReset());

    expect(store.getState().bootstrap).toMatchObject({ status: 'idle', permissions: [], roles: [] });
  });
});

describe('selectors', () => {
  beforeEach(async () => {
    await store.dispatch(loadBootstrap()).unwrap();
  });

  it('answers permission questions from the server list only', () => {
    const state = store.getState();
    expect(selectHasPermission(Permissions.conversationsView)(state)).toBe(true);
    expect(selectHasPermission(Permissions.dashboardView)(state)).toBe(false);
    expect(selectHasAnyPermission(Permissions.dashboardView, Permissions.conversationsSend)(state)).toBe(
      true,
    );
    expect(selectHasRole('agent')(state)).toBe(true);
    expect(selectHasRole('admin')(state)).toBe(false);
  });

  it('prefers the number flagged primary', () => {
    expect(selectPrimaryNumber(store.getState())?.id).toBe(2);
  });
});
