import * as api from '@/api/apis';
import { network, normalizeError } from '@/api/network';
import type { AuthUser, OtpRequestResult, SessionPayload } from '@/api/types';
import { Config } from '@/constants/config';
import { clearLocalSession } from '@/services/session/sessionCleanup';
import { tokenStorage } from '@/services/storage/tokenStorage';
import { appReset } from '@/store/actions';
import { createAppAsyncThunk } from '@/store/hooks';
import type { AppDispatch } from '@/store/store';
import { getDeviceName } from '@/utils/device';

import {
  otpChallengeStarted,
  otpResendScheduled,
  sessionExpiredShown,
  sessionRestored,
  signedIn,
  signedOut,
  signingOutStarted,
} from './authSlice';

/** Persists the token pair, then marks the user signed in. Bootstrap loads in Stage 5. */
const startSession = async (session: SessionPayload, dispatch: AppDispatch) => {
  if (!session?.access_token || !session.refresh_token) {
    throw normalizeError(new Error('Login response did not include a session.'));
  }
  await tokenStorage.save(session.access_token, session.refresh_token, session.expires_in);
  dispatch(signedIn(session.user));
  return session.user;
};

/**
 * AUTH-01 — phone must already be normalized to +91XXXXXXXXXX.
 * Also records the pending challenge (phone + resend cooldown) for the OTP screen.
 * A 429 moves the cooldown forward instead of losing it.
 */
export const requestLoginOtp = createAppAsyncThunk<OtpRequestResult, { phone: string; resend?: boolean }>(
  'auth/requestOtp',
  async ({ phone, resend = false }, { dispatch, getState, rejectWithValue }) => {
    try {
      const { data } = await api.requestOtp({ phone, purpose: 'login' });
      const now = Date.now();
      const resendAvailableAt = now + Config.otpResendSeconds * 1000;

      if (resend && getState().auth.otpChallenge?.phone === phone) {
        dispatch(otpResendScheduled({ resendAvailableAt }));
      } else {
        dispatch(
          otpChallengeStarted({
            phone,
            requestedAt: now,
            resendAvailableAt,
            testAccount: !!data?.test_account,
            notice: data?.notice ?? null,
          }),
        );
      }
      return data;
    } catch (error) {
      const apiError = normalizeError(error);
      // The server is still counting down; keep the screen's timer in step with it.
      if (apiError.retryAfterSeconds != null && getState().auth.otpChallenge?.phone === phone) {
        dispatch(otpResendScheduled({ resendAvailableAt: Date.now() + apiError.retryAfterSeconds * 1000 }));
      }
      return rejectWithValue(apiError);
    }
  },
);

/** AUTH-02 */
export const signInWithOtp = createAppAsyncThunk<AuthUser, { phone: string; code: string }>(
  'auth/signInWithOtp',
  async ({ phone, code }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.loginWithOtp({ phone, code, device_name: getDeviceName() });
      return await startSession(data, dispatch);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

/** AUTH-03 */
export const signInWithPassword = createAppAsyncThunk<AuthUser, { phone: string; password: string }>(
  'auth/signInWithPassword',
  async ({ phone, password }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.loginWithPassword({ phone, password, device_name: getDeviceName() });
      return await startSession(data, dispatch);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

/**
 * Launch gate. Tokens in SecureStore mean the previous session continues; an
 * expired access token is refreshed first so a dead session lands on Login
 * instead of flashing the app. `/me/bootstrap` follows in Stage 5.
 */
export const restoreSession = createAppAsyncThunk<void, void>(
  'auth/restoreSession',
  async (_, { dispatch }) => {
    try {
      const tokens = await tokenStorage.load();
      if (!tokens?.refreshToken) {
        dispatch(signedOut());
        return;
      }

      if (tokens.accessExpiresAt != null && Date.now() >= tokens.accessExpiresAt) {
        try {
          await network.refreshSession();
        } catch (error) {
          // A rejected refresh already cleared the session (network.ts emits
          // `expired`); anything transient keeps it so the app can retry online.
          if (normalizeError(error).code === 'SESSION_EXPIRED') {
            dispatch(signedOut());
            return;
          }
        }
      }

      dispatch(sessionRestored());
    } catch (error) {
      // Never leave the splash up: an unreadable keychain means "signed out".
      if (__DEV__) console.warn('[auth] session restore failed', error);
      dispatch(signedOut());
    }
  },
);

/**
 * AUTH-06 — best-effort server revoke, then always clears the device:
 * SecureStore, private AsyncStorage, registered services (socket…), Redux.
 */
export const signOut = createAppAsyncThunk<void, void>('auth/signOut', async (_, { dispatch }) => {
  dispatch(signingOutStarted());
  const tokens = await tokenStorage.load().catch(() => null);
  if (tokens?.refreshToken) {
    try {
      await api.logout({ refresh_token: tokens.refreshToken });
    } catch {
      // Offline or already-invalid session: local sign-out still proceeds.
    }
  }
  await clearLocalSession();
  dispatch(appReset());
});

/** Triggered by network.ts when refresh fails. Ignored during an explicit sign-out. */
export const handleSessionExpired = createAppAsyncThunk<void, void>(
  'auth/handleSessionExpired',
  async (_, { dispatch, getState }) => {
    const { status, sessionExpired } = getState().auth;
    if (status === 'signingOut' || sessionExpired) return;
    await clearLocalSession();
    dispatch(appReset());
    // Only show "Session Expired" to someone who was actually signed in.
    if (status === 'authenticated') dispatch(sessionExpiredShown());
  },
);
