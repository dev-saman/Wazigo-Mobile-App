/**
 * Push: which chat a notification opens, and the device-token lifecycle
 * (register once per token, unregister before the session is revoked).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/services/storage/tokenStorage', () => ({
  tokenStorage: {
    load: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r', accessExpiresAt: null })),
    get: jest.fn(() => null),
    save: jest.fn(),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('@/api/apis', () => ({
  registerPushDevice: jest.fn(),
  unregisterPushDevice: jest.fn(),
  logout: jest.fn(),
}));

import * as api from '@/api/apis';
import { signOut } from '@/features/auth/authThunks';
import { store } from '@/store/store';

import { forgetPushToken, registeredPushToken, registerPushToken, unregisterPushToken } from '../pushRegistration';
import { conversationIdFromPushData } from '../pushTarget';

beforeEach(() => {
  forgetPushToken();
  jest.mocked(api.registerPushDevice).mockReset().mockResolvedValue({ data: null, httpStatus: 201 } as never);
  jest.mocked(api.unregisterPushDevice).mockReset().mockResolvedValue({ data: null, httpStatus: 200 } as never);
  jest.mocked(api.logout).mockReset().mockResolvedValue({ data: null, httpStatus: 200 });
});

describe('conversationIdFromPushData', () => {
  it('reads the conversation the notification is about', () => {
    expect(conversationIdFromPushData({ conversation_id: 42 })).toBe('42');
    expect(conversationIdFromPushData({ conversationId: '43' })).toBe('43');
    expect(conversationIdFromPushData({ conversation: { id: 44 } })).toBe('44');
    expect(conversationIdFromPushData({ link: '/inbox/45' })).toBe('45');
    expect(conversationIdFromPushData({ url: 'https://app.wazigo.io/chats/46' })).toBe('46');
  });

  it('returns null when nothing names a chat', () => {
    expect(conversationIdFromPushData({ title: 'Hello' })).toBeNull();
    expect(conversationIdFromPushData({ conversation_id: 0 })).toBeNull();
    expect(conversationIdFromPushData(null)).toBeNull();
  });
});

describe('device registration', () => {
  it('registers an Expo token with the platform and device name, once per token', async () => {
    await registerPushToken('ExponentPushToken[abc]', 5, 'android');
    await registerPushToken('ExponentPushToken[abc]', 5, 'android');

    expect(api.registerPushDevice).toHaveBeenCalledTimes(1);
    expect(jest.mocked(api.registerPushDevice).mock.calls[0][0]).toMatchObject({
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      provider: 'expo',
      device_name: expect.stringMatching(/^Wazigo /),
    });
  });

  it('a rotated token or another user registers again', async () => {
    await registerPushToken('ExponentPushToken[abc]', 5, 'android');
    await registerPushToken('ExponentPushToken[def]', 5, 'android');
    await registerPushToken('ExponentPushToken[def]', 6, 'android');
    expect(api.registerPushDevice).toHaveBeenCalledTimes(3);
  });

  it('a failed registration is tried again next time, and never throws', async () => {
    jest.mocked(api.registerPushDevice).mockRejectedValueOnce({ code: 'VALIDATION', message: 'bad', status: 422 });
    await expect(registerPushToken('ExponentPushToken[abc]', 5, 'ios')).resolves.toBe(false);
    expect(registeredPushToken()).toBeNull();
    await expect(registerPushToken('ExponentPushToken[abc]', 5, 'ios')).resolves.toBe(true);
  });

  it('unregistering sends the token and forgets it even when the server call fails', async () => {
    await registerPushToken('ExponentPushToken[abc]', 5, 'android');
    jest.mocked(api.unregisterPushDevice).mockRejectedValueOnce({ code: 'NETWORK', message: 'offline' });

    await unregisterPushToken();

    expect(api.unregisterPushDevice).toHaveBeenCalledWith({ token: 'ExponentPushToken[abc]' });
    expect(registeredPushToken()).toBeNull();
    await unregisterPushToken();
    expect(api.unregisterPushDevice).toHaveBeenCalledTimes(1);
  });

  it('sign-out removes the device before the session is revoked', async () => {
    await registerPushToken('ExponentPushToken[abc]', 5, 'android');
    const order: string[] = [];
    jest.mocked(api.unregisterPushDevice).mockImplementation(async () => {
      order.push('unregister');
      return { data: null, httpStatus: 200 } as never;
    });
    jest.mocked(api.logout).mockImplementation(async () => {
      order.push('logout');
      return { data: null, httpStatus: 200 };
    });

    await store.dispatch(signOut());

    expect(order).toEqual(['unregister', 'logout']);
  });
});
