import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthUser } from '@/api/types';
import { appReset } from '@/store/actions';

export type AuthStatus =
  /** Session restore has not finished yet (Splash). */
  | 'unknown'
  | 'authenticated'
  | 'unauthenticated'
  | 'signingOut';

/**
 * A login code that has been requested but not yet used. Lives in the store so
 * the OTP screen keeps the phone number and the resend cooldown across mounts.
 */
export type OtpChallenge = {
  /** E.164, exactly as it was sent to AUTH-01. */
  phone: string;
  requestedAt: number;
  /** Epoch ms before which AUTH-01 will reject another request. */
  resendAvailableAt: number;
  /** AUTH-01 `test_account` — a review account whose code is not delivered. */
  testAccount: boolean;
  /** AUTH-01 `notice`, shown verbatim when present. */
  notice: string | null;
};

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Set after a failed refresh so the Session Expired screen can be shown. */
  sessionExpired: boolean;
  otpChallenge: OtpChallenge | null;
};

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  sessionExpired: false,
  otpChallenge: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<AuthUser>) {
      state.status = 'authenticated';
      state.user = action.payload;
      state.sessionExpired = false;
      state.otpChallenge = null;
    },
    /**
     * Stored tokens were found at launch. The user object stays null until
     * `/me/bootstrap` fills it in (Stage 5).
     */
    sessionRestored(state) {
      state.status = 'authenticated';
      state.sessionExpired = false;
      state.otpChallenge = null;
    },
    signedOut(state) {
      state.status = 'unauthenticated';
      state.user = null;
      state.otpChallenge = null;
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
    otpChallengeStarted(state, action: PayloadAction<OtpChallenge>) {
      state.otpChallenge = action.payload;
    },
    /** A resend (or a 429) moves the cooldown without losing the challenge. */
    otpResendScheduled(state, action: PayloadAction<{ resendAvailableAt: number }>) {
      if (state.otpChallenge) state.otpChallenge.resendAvailableAt = action.payload.resendAvailableAt;
    },
    otpChallengeCleared(state) {
      state.otpChallenge = null;
    },
  },
  extraReducers: (builder) => {
    // After a reset the session is known to be gone, not "unknown".
    builder.addCase(appReset, () => ({ ...initialState, status: 'unauthenticated' }));
  },
});

export const {
  signedIn,
  sessionRestored,
  signedOut,
  signingOutStarted,
  userUpdated,
  sessionExpiredShown,
  sessionExpiredAcknowledged,
  otpChallengeStarted,
  otpResendScheduled,
  otpChallengeCleared,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
