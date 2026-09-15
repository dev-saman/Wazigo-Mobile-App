import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { AuthUser, OtpRequestResult, SessionPayload } from '@/api/types';
import { clearLocalSession } from '@/services/session/sessionCleanup';
import { tokenStorage } from '@/services/storage/tokenStorage';
import { appReset } from '@/store/actions';
import { createAppAsyncThunk } from '@/store/hooks';
import type { AppDispatch } from '@/store/store';
import { getDeviceName } from '@/utils/device';

import { sessionExpiredShown, signedIn, signingOutStarted } from './authSlice';

/** Persists the token pair, then marks the user signed in. Bootstrap loads in Stage 5. */
const startSession = async (session: SessionPayload, dispatch: AppDispatch) => {
  if (!session?.access_token || !session.refresh_token) {
    throw normalizeError(new Error('Login response did not include a session.'));
  }
  await tokenStorage.save(session.access_token, session.refresh_token, session.expires_in);
  dispatch(signedIn(session.user));
  return session.user;
};

/** AUTH-01 — phone must already be normalized to +91XXXXXXXXXX. */
export const requestLoginOtp = createAppAsyncThunk<OtpRequestResult, { phone: string }>(
  'auth/requestOtp',
  async ({ phone }, { rejectWithValue }) => {
    try {
      const { data } = await api.requestOtp({ phone, purpose: 'login' });
      return data;
    } catch (error) {
      return rejectWithValue(normalizeError(error));
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
