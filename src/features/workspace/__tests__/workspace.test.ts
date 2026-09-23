/**
 * Super-admin Phase 4. What a 403 saying the business is suspended or
 * deactivated does to the app: the session goes, and one screen is left that
 * can explain it and offer a way to reach Wazigo.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockClearLocalSession = jest.fn(async () => undefined);
jest.mock('@/services/session/sessionCleanup', () => ({
  clearLocalSession: () => mockClearLocalSession(),
  registerSessionCleanup: jest.fn(() => () => undefined),
}));

jest.mock('@/services/storage/tokenStorage', () => ({
  tokenStorage: {
    load: jest.fn(async () => null),
    get: jest.fn(() => null),
    save: jest.fn(),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('@/api/apis', () => ({ getBootstrap: jest.fn() }));

import type { WorkspaceUnavailable } from '@/api/types';
import { signedIn } from '@/features/auth/authSlice';
import { loadBootstrap } from '@/features/bootstrap/bootstrapThunks';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { workspaceCleared } from '../workspaceSlice';
import { handleWorkspaceUnavailable } from '../workspaceThunks';

const chatUrl = 'https://wa.me/919999999999?text=Hi%20Wazigo%20support';

const suspended: WorkspaceUnavailable = {
  code: 'workspace_unavailable',
  workspace_status: 'suspended',
  reason: 'Payment for August has not reached us.',
  support: { email: 'support@wazigo.io', chat_url: chatUrl },
};

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  store.dispatch(signedIn({ id: 7, name: 'Riya' }));
});

describe('handleWorkspaceUnavailable', () => {
  it('signs the user out of the ordinary screens and puts the message up', async () => {
    await store.dispatch(handleWorkspaceUnavailable(suspended));

    const state = store.getState();
    expect(mockClearLocalSession).toHaveBeenCalledTimes(1);
    expect(state.auth.status).toBe('unauthenticated');
    expect(state.auth.user).toBeNull();
    expect(state.workspace).toEqual({
      status: 'suspended',
      reason: 'Payment for August has not reached us.',
      support: { email: 'support@wazigo.io', chat_url: chatUrl },
    });
  });

  it('survives the session reset it performs, so the screen is never blanked', async () => {
    await store.dispatch(handleWorkspaceUnavailable(suspended));

    // The reset happens first and the message second; the message is what the
    // router keys off, so it has to outlive the reset.
    expect(store.getState().workspace.status).toBe('suspended');
  });

  it('ignores the repeat 403s from calls that were already in flight', async () => {
    await store.dispatch(handleWorkspaceUnavailable(suspended));
    await store.dispatch(
      handleWorkspaceUnavailable({ ...suspended, workspace_status: 'deactivated', reason: 'Later.' }),
    );

    expect(mockClearLocalSession).toHaveBeenCalledTimes(1);
    expect(store.getState().workspace).toMatchObject({
      status: 'suspended',
      reason: 'Payment for August has not reached us.',
    });
  });

  it('lets the customer back to sign-in once Wazigo has reactivated them', async () => {
    await store.dispatch(handleWorkspaceUnavailable(suspended));

    store.dispatch(workspaceCleared());

    expect(store.getState().workspace.status).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');
  });
});

describe('the support block on bootstrap', () => {
  const api = jest.requireMock('@/api/apis') as { getBootstrap: jest.Mock };
  const payload = { user: { id: 7, name: 'Riya' }, roles: ['agent'], permissions: [] };

  it('is kept as the server sent it', async () => {
    api.getBootstrap.mockResolvedValue({
      data: { ...payload, support: { email: 'support@wazigo.io', chat_url: chatUrl } },
      httpStatus: 200,
    });

    await store.dispatch(loadBootstrap()).unwrap();

    expect(store.getState().bootstrap.support).toEqual({
      email: 'support@wazigo.io',
      chat_url: chatUrl,
    });
  });

  it('is empty while Phase 4 is still unpublished, rather than half-set', async () => {
    api.getBootstrap.mockResolvedValue({ data: payload, httpStatus: 200 });

    await store.dispatch(loadBootstrap()).unwrap();

    expect(store.getState().bootstrap.support).toEqual({ email: null, chat_url: null });
  });

  it('picks up a number changed in the back office on the next bootstrap', async () => {
    api.getBootstrap.mockResolvedValue({
      data: { ...payload, support: { email: 'support@wazigo.io', chat_url: chatUrl } },
      httpStatus: 200,
    });
    await store.dispatch(loadBootstrap()).unwrap();

    api.getBootstrap.mockResolvedValue({
      data: { ...payload, support: { email: 'support@wazigo.io', chat_url: 'https://wa.me/911111111111?text=Hi' } },
      httpStatus: 200,
    });
    await store.dispatch(loadBootstrap({ silent: true })).unwrap();

    expect(store.getState().bootstrap.support.chat_url).toBe('https://wa.me/911111111111?text=Hi');
  });
});
