import type { AuthUser } from '@/api/types';
import { handleSessionExpired } from '@/features/auth/authThunks';
import { userUpdated } from '@/features/auth/authSlice';
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
}
