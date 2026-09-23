import type { WorkspaceUnavailable } from '@/api/types';
import { clearLocalSession } from '@/services/session/sessionCleanup';
import { appReset } from '@/store/actions';
import { createAppAsyncThunk } from '@/store/hooks';

import { workspaceBlocked } from './workspaceSlice';

/**
 * Super-admin Phase 4. A suspended or deactivated business answers 403 to every
 * call, so the app takes the person off the ordinary screens entirely rather
 * than letting each one fail in its own way: the message goes up, the local
 * session is cleared, and the store is reset behind it.
 *
 * The message is recorded FIRST, synchronously, and the slice is one of the two
 * the reset preserves. That ordering is the whole point: `/auth/refresh`
 * answers 403 as well, so the very same response also tells the app its session
 * is dead. Both stories race to the store, and if the session-expired one
 * landed second it would reset this slice and put "Session expired" up instead
 * - which explains nothing and sends the customer round the login loop. Setting
 * the status before the first `await` means `handleSessionExpired` always sees
 * it and stands down.
 *
 * Repeat 403s - several calls were in flight - are ignored, so the screen is
 * never rebuilt underneath the customer.
 */
export const handleWorkspaceUnavailable = createAppAsyncThunk<void, WorkspaceUnavailable>(
  'workspace/unavailable',
  async (workspace, { dispatch, getState }) => {
    if (getState().workspace.status) return;
    dispatch(workspaceBlocked(workspace));
    await clearLocalSession();
    dispatch(appReset());
  },
);
