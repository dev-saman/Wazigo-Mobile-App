import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { NO_SUPPORT } from '@/api/support';
import type { SupportContact, WorkspaceStatus, WorkspaceUnavailable } from '@/api/types';

export type WorkspaceState = {
  /** Null while the business is in good standing - the normal app is reachable. */
  status: WorkspaceStatus | null;
  /** Wazigo's own words for the customer. May be empty. */
  reason: string | null;
  /** The support block from the 403, not from bootstrap: there is no session left. */
  support: SupportContact;
};

const initialState: WorkspaceState = {
  status: null,
  reason: null,
  support: NO_SUPPORT,
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    workspaceBlocked(state, action: PayloadAction<WorkspaceUnavailable>) {
      state.status = action.payload.workspace_status;
      state.reason = action.payload.reason;
      state.support = action.payload.support;
    },
    /** The customer asked to try again, e.g. after Wazigo reactivated them. */
    workspaceCleared: () => initialState,
  },
  // Deliberately no `appReset` case: clearing the session is part of putting
  // this screen up, so the screen cannot be something the reset takes down.
  // `rootReducer` carries the slice across, and `workspaceCleared` is the only
  // way out - see `handleWorkspaceUnavailable`.
});

export const { workspaceBlocked, workspaceCleared } = workspaceSlice.actions;

export const workspaceReducer = workspaceSlice.reducer;
