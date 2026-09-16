/**
 * Stage 4 login flow: the OTP challenge the screens rely on, and the launch
 * gate that decides between Login and the app.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The real store caches tokens in memory for the whole module lifetime, which
// would leak between these cases; SecureStore itself is covered by network.test.
jest.mock('@/services/storage/tokenStorage', () => ({
  tokenStorage: {
    load: jest.fn(),
    get: jest.fn(),
    save: jest.fn(),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('@/api/apis', () => ({
  requestOtp: jest.fn(),
  loginWithOtp: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('@/api/network', () => {
  const actual = jest.requireActual('@/api/network');
  return {
    ...actual,
    network: { ...actual.network, refreshSession: jest.fn() },
  };
});

import * as api from '@/api/apis';
import { network } from '@/api/network';
import type { ApiError } from '@/api/types';
import { Config } from '@/constants/config';
import { tokenStorage } from '@/services/storage/tokenStorage';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { otpChallengeStarted } from '../authSlice';
import { requestLoginOtp, restoreSession } from '../authThunks';

const PHONE = '+919876543210';

const rateLimited: ApiError = {
  code: 'RATE_LIMITED',
  status: 429,
  message: 'Too many attempts.',
  retryAfterSeconds: 45,
};

const storedTokens = (accessExpiresAt: number | null) => {
  jest
    .mocked(tokenStorage.load)
    .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', accessExpiresAt });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(tokenStorage.load).mockResolvedValue(null);
  store.dispatch(appReset());
  jest.mocked(api.requestOtp).mockResolvedValue({
    data: { test_account: false, notice: null },
    httpStatus: 200,
  });
});

describe('requestLoginOtp', () => {
  it('records the challenge with the resend cooldown', async () => {
    const before = Date.now();
    await store.dispatch(requestLoginOtp({ phone: PHONE })).unwrap();

    const challenge = store.getState().auth.otpChallenge;
    expect(challenge).toMatchObject({ phone: PHONE, testAccount: false, notice: null });
    expect(challenge!.resendAvailableAt).toBeGreaterThanOrEqual(before + Config.otpResendSeconds * 1000);
    expect(jest.mocked(api.requestOtp).mock.calls[0][0]).toEqual({ phone: PHONE, purpose: 'login' });
  });

  it('keeps the server notice for a review account', async () => {
    jest.mocked(api.requestOtp).mockResolvedValue({
      data: { test_account: true, notice: 'Use the review code.' },
      httpStatus: 200,
    });

    await store.dispatch(requestLoginOtp({ phone: PHONE })).unwrap();

    expect(store.getState().auth.otpChallenge).toMatchObject({
      testAccount: true,
      notice: 'Use the review code.',
    });
  });

  it('moves the cooldown to the server value when rate limited', async () => {
    store.dispatch(
      otpChallengeStarted({
        phone: PHONE,
        requestedAt: Date.now(),
        resendAvailableAt: Date.now(),
        testAccount: false,
        notice: null,
      }),
    );
    jest.mocked(api.requestOtp).mockRejectedValue(rateLimited);

    const result = await store.dispatch(requestLoginOtp({ phone: PHONE, resend: true }));

    expect(result.type).toMatch(/rejected$/);
    const challenge = store.getState().auth.otpChallenge;
    expect(challenge).not.toBeNull();
    expect(challenge!.resendAvailableAt).toBeGreaterThan(Date.now() + 40_000);
  });
});

describe('restoreSession', () => {
  it('routes to Login when no tokens are stored', async () => {
    await store.dispatch(restoreSession()).unwrap();

    expect(store.getState().auth.status).toBe('unauthenticated');
    expect(network.refreshSession).not.toHaveBeenCalled();
  });

  it('continues a stored session without touching the network', async () => {
    storedTokens(Date.now() + 10 * 60 * 1000);

    await store.dispatch(restoreSession()).unwrap();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(network.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes first when the stored access token has expired', async () => {
    storedTokens(Date.now() - 1000);
    jest.mocked(network.refreshSession).mockResolvedValue('new-access');

    await store.dispatch(restoreSession()).unwrap();

    expect(network.refreshSession).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('routes to Login when the refresh token is rejected', async () => {
    storedTokens(Date.now() - 1000);
    jest.mocked(network.refreshSession).mockRejectedValue({
      code: 'SESSION_EXPIRED',
      status: 401,
      message: 'Your session has expired. Please log in again.',
    } satisfies ApiError);

    await store.dispatch(restoreSession()).unwrap();

    expect(store.getState().auth.status).toBe('unauthenticated');
  });

  it('keeps the session when the refresh fails for a transient reason', async () => {
    storedTokens(Date.now() - 1000);
    jest.mocked(network.refreshSession).mockRejectedValue({
      code: 'NETWORK',
      message: 'Unable to reach Wazigo.',
      isNetworkError: true,
    } satisfies ApiError);

    await store.dispatch(restoreSession()).unwrap();

    expect(store.getState().auth.status).toBe('authenticated');
  });
});
