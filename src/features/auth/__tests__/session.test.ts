/**
 * Redux-side session handling: sign-in persistence, logout cleanup and the
 * network-layer "expired" event resetting private state.
 */
const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDevice',
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecureStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecureStore.delete(key)),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/api/apis', () => ({
  loginWithOtp: jest.fn(),
  logout: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as api from '@/api/apis';
import { registerSessionCleanup } from '@/services/session/sessionCleanup';
import { sessionEvents } from '@/services/session/sessionEvents';
import { store } from '@/store/store';

import { signInWithOtp, signOut } from '../authThunks';

const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'bearer',
  expires_in: 3600,
  user: { id: 5, name: 'Asha Rao' },
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  mockSecureStore.clear();
  await AsyncStorage.clear();
  jest.mocked(api.loginWithOtp).mockResolvedValue({ data: session, httpStatus: 200 });
  jest.mocked(api.logout).mockResolvedValue({ data: null, httpStatus: 200 });
});

it('stores both tokens in SecureStore and marks the user authenticated', async () => {
  await store.dispatch(signInWithOtp({ phone: '+919876543210', code: '12345' })).unwrap();

  expect(store.getState().auth).toMatchObject({ status: 'authenticated', user: { id: 5 } });
  expect(mockSecureStore.get('wazigo.session.access_token')).toBe('access');
  expect(mockSecureStore.get('wazigo.session.refresh_token')).toBe('refresh');
  expect(jest.mocked(api.loginWithOtp).mock.calls[0][0]).toMatchObject({
    phone: '+919876543210',
    code: '12345',
    device_name: expect.stringMatching(/^Wazigo (iOS|Android)/),
  });
});

it('logout revokes the refresh token and clears every private store', async () => {
  const cleanup = jest.fn();
  const unregister = registerSessionCleanup(cleanup);
  await store.dispatch(signInWithOtp({ phone: '+919876543210', code: '12345' })).unwrap();
  await AsyncStorage.setItem('wazigo:prefs:chat_filters', '{"tab":"unread"}');
  await AsyncStorage.setItem('other-app-key', 'keep');

  await store.dispatch(signOut());

  expect(api.logout).toHaveBeenCalledWith({ refresh_token: 'refresh' });
  expect(mockSecureStore.size).toBe(0);
  expect(await AsyncStorage.getItem('wazigo:prefs:chat_filters')).toBeNull();
  expect(await AsyncStorage.getItem('other-app-key')).toBe('keep');
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(store.getState().auth).toEqual({
    status: 'unauthenticated',
    user: null,
    sessionExpired: false,
    otpChallenge: null,
  });
  unregister();
});

it('logout still clears the device when the server call fails', async () => {
  await store.dispatch(signInWithOtp({ phone: '+919876543210', code: '12345' })).unwrap();
  jest.mocked(api.logout).mockRejectedValue({ code: 'NETWORK', message: 'offline' });

  await store.dispatch(signOut());

  expect(mockSecureStore.size).toBe(0);
  expect(store.getState().auth.status).toBe('unauthenticated');
});

it('an expired-session event resets Redux and flags Session Expired', async () => {
  await store.dispatch(signInWithOtp({ phone: '+919876543210', code: '12345' })).unwrap();

  sessionEvents.emit('expired', { reason: 'refresh_failed' });
  await flush();
  await flush();

  expect(store.getState().auth).toEqual({
    status: 'unauthenticated',
    user: null,
    sessionExpired: true,
    otpChallenge: null,
  });
  expect(mockSecureStore.size).toBe(0);
});
