import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthUser } from '@/api/types';
import { appReset } from '@/store/actions';

export type AuthStatus =
  /** Session restore has not finished yet (Splash). */
  | 'unknown'
  | 'authenticated'
  | 'unauthenticated'
  | 'signingOut';

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Set after a failed refresh so the Session Expired screen can be shown. */
  sessionExpired: boolean;
};

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  sessionExpired: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<AuthUser>) {
      state.status = 'authenticated';
      state.user = action.payload;
      state.sessionExpired = false;
    },
    signedOut(state) {
      state.status = 'unauthenticated';
      state.user = null;
    },
    signingOutStarted(state) {
      state.status = 'signingOut';
    },
    userUpdated(state, action: PayloadAction<AuthUser>) {
      state.user = { ...state.user, ...action.payload };
    },
    sessionExpiredShown(state) {
      state.status = 'unauthenticated';
      state.user = null;
      state.sessionExpired = true;
    },
    sessionExpiredAcknowledged(state) {
      state.sessionExpired = false;
    },
  },
  extraReducers: (builder) => {
    // After a reset the session is known to be gone, not "unknown".
    builder.addCase(appReset, () => ({ ...initialState, status: 'unauthenticated' }));
  },
});

export const {
  signedIn,
  signedOut,
  signingOutStarted,
  userUpdated,
  sessionExpiredShown,
  sessionExpiredAcknowledged,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
