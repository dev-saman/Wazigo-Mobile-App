/**
 * The refresh case. A suspended business answers 403 to `/auth/refresh` too, so
 * the app hears about the closure and about a dead session from the same
 * response. It must show the suspended screen, not "Session expired": the
 * session being gone is a consequence of the closure, not a separate story.
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

import type { WorkspaceUnavailable } from '@/api/types';
import { signedIn } from '@/features/auth/authSlice';
import { sessionEvents } from '@/services/session/sessionEvents';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { workspaceCleared } from '../workspaceSlice';

const suspended: WorkspaceUnavailable = {
  code: 'workspace_unavailable',
  workspace_status: 'suspended',
  reason: 'Payment for August has not reached us.',
  support: { email: 'support@wazigo.io', chat_url: 'https://wa.me/919999999999?text=Hi' },
};

/** Lets every thunk started by an event listener run to completion. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  // Only the customer clears the block, so the tests do it the same way.
  store.dispatch(workspaceCleared());
  store.dispatch(appReset());
  store.dispatch(signedIn({ id: 7, name: 'Riya' }));
});

describe('a 403 on refresh', () => {
  it('shows the suspended screen even though the refresh also failed', async () => {
    // The order the network layer produces: the interceptor sees the 403 body
    // first, then performRefresh gives up on the session.
    sessionEvents.emit('workspaceUnavailable', suspended);
    sessionEvents.emit('expired', { reason: 'refresh_failed' });
    await settle();

    const state = store.getState();
    expect(state.workspace.status).toBe('suspended');
    expect(state.workspace.reason).toBe('Payment for August has not reached us.');
    expect(state.auth.sessionExpired).toBe(false);
  });

  it('holds the screen even if the two events arrive the other way round', async () => {
    sessionEvents.emit('expired', { reason: 'refresh_failed' });
    sessionEvents.emit('workspaceUnavailable', suspended);
    await settle();

    expect(store.getState().workspace.status).toBe('suspended');
  });

  it('still shows "session expired" for an ordinary dead session', async () => {
    sessionEvents.emit('expired', { reason: 'refresh_failed' });
    await settle();

    expect(store.getState().workspace.status).toBeNull();
    expect(store.getState().auth.sessionExpired).toBe(true);
  });
});
