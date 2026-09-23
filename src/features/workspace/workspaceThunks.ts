import type { WorkspaceUnavailable } from '@/api/types';
import { clearLocalSession } from '@/services/session/sessionCleanup';
import { appReset } from '@/store/actions';
import { createAppAsyncThunk } from '@/store/hooks';

import { workspaceBlocked } from './workspaceSlice';

/**
 * Super-admin Phase 4. A suspended or deactivated business answers 403 to every
 * call, so the app takes the person off the ordinary screens entirely rather
 * than letting each one fail in its own way: the local session is cleared, the
 * store is reset, and the full-screen message is put up in its place.
 *
 * The reset comes first and the message second, so nothing of the old session
 * survives behind the screen. Repeat 403s - several calls were in flight - are
 * ignored, so the screen is never rebuilt underneath the customer.
 */
export const handleWorkspaceUnavailable = createAppAsyncThunk<void, WorkspaceUnavailable>(
  'workspace/unavailable',
  async (workspace, { dispatch, getState }) => {
    if (getState().workspace.status) return;
    await clearLocalSession();
    dispatch(appReset());
    dispatch(workspaceBlocked(workspace));
  },
);
