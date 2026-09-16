import { combineReducers, type UnknownAction } from '@reduxjs/toolkit';

import { authReducer } from '@/features/auth/authSlice';
import { bootstrapReducer } from '@/features/bootstrap/bootstrapSlice';
import { connectivityReducer } from '@/features/connectivity/connectivitySlice';
import { conversationsReducer } from '@/features/conversations/conversationsSlice';
import { dashboardReducer } from '@/features/dashboard/dashboardSlice';

import { appReset } from './actions';

// Feature slices (messages, templates, presence) are registered here as their
// stages are implemented.
const combined = combineReducers({
  auth: authReducer,
  bootstrap: bootstrapReducer,
  connectivity: connectivityReducer,
  conversations: conversationsReducer,
  dashboard: dashboardReducer,
});

export type RootState = ReturnType<typeof combined>;

export const rootReducer = (state: RootState | undefined, action: UnknownAction): RootState => {
  if (appReset.match(action)) {
    // Device connectivity is not session data — keep it across resets.
    return combined({ connectivity: state?.connectivity } as RootState, action);
  }
  return combined(state, action);
};
