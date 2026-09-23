import type { AuthUser } from '@/api/types';
import { handleSessionExpired } from '@/features/auth/authThunks';
import { userUpdated } from '@/features/auth/authSlice';
import { handleWorkspaceUnavailable } from '@/features/workspace/workspaceThunks';
import { sessionEvents } from '@/services/session/sessionEvents';

import type { AppStore } from './store';

/** Bridges network-layer session events into Redux. */
export function attachSessionListeners(store: AppStore) {
  sessionEvents.on('expired', () => {
    void store.dispatch(handleSessionExpired());
  });

  sessionEvents.on('refreshed', ({ user }) => {
    if (store.getState().auth.status === 'authenticated' && user && typeof user === 'object') {
      store.dispatch(userUpdated(user as AuthUser));
    }
  });

  // Phase 4: the business itself was suspended or deactivated. Every screen is
  // dead from here on, so the app clears the session and shows the one screen
  // that can explain it.
  sessionEvents.on('workspaceUnavailable', (workspace) => {
    void store.dispatch(handleWorkspaceUnavailable(workspace));
  });
}
