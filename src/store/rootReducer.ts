import { combineReducers, type UnknownAction } from '@reduxjs/toolkit';

import { authReducer } from '@/features/auth/authSlice';
import { bootstrapReducer } from '@/features/bootstrap/bootstrapSlice';
import { connectivityReducer } from '@/features/connectivity/connectivitySlice';
import { conversationsReducer } from '@/features/conversations/conversationsSlice';
import { labelsReducer } from '@/features/conversations/labelsSlice';
import { dashboardReducer } from '@/features/dashboard/dashboardSlice';
import { messagesReducer } from '@/features/messages/messagesSlice';
import { realtimeReducer } from '@/features/realtime/realtimeSlice';
import { templatesReducer } from '@/features/templates/templatesSlice';

import { appReset } from './actions';

// Presence has no slice: nothing in the design shows the agent's own status.
const combined = combineReducers({
  auth: authReducer,
  bootstrap: bootstrapReducer,
  connectivity: connectivityReducer,
  conversations: conversationsReducer,
  dashboard: dashboardReducer,
  labels: labelsReducer,
  messages: messagesReducer,
  realtime: realtimeReducer,
  templates: templatesReducer,
});

export type RootState = ReturnType<typeof combined>;

export const rootReducer = (state: RootState | undefined, action: UnknownAction): RootState => {
  if (appReset.match(action)) {
    // Device connectivity is not session data — keep it across resets.
    return combined({ connectivity: state?.connectivity } as RootState, action);
  }
  return combined(state, action);
};
