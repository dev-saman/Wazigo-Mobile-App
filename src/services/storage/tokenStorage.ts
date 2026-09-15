import * as SecureStore from 'expo-secure-store';

/**
 * Session credentials in the platform keychain / keystore.
 *
 * Tokens are stored under separate keys (some iOS releases reject values above
 * ~2 KB, and a JWT plus refresh token in one JSON blob can exceed that).
 * An in-memory copy avoids a keychain read on every request.
 */

const KEYS = {
  accessToken: 'wazigo.session.access_token',
  refreshToken: 'wazigo.session.refresh_token',
  accessExpiresAt: 'wazigo.session.access_expires_at',
} as const;

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires, if known. */
  accessExpiresAt: number | null;
};

let cache: StoredTokens | null = null;
let loaded = false;

export const tokenStorage = {
  /** Reads tokens from SecureStore once, then serves the memory cache. */
  async load(): Promise<StoredTokens | null> {
    if (loaded) return cache;
    const [accessToken, refreshToken, expiresAt] = await Promise.all([
      SecureStore.getItemAsync(KEYS.accessToken, OPTIONS),
      SecureStore.getItemAsync(KEYS.refreshToken, OPTIONS),
      SecureStore.getItemAsync(KEYS.accessExpiresAt, OPTIONS),
    ]);
    cache =
      accessToken && refreshToken
        ? { accessToken, refreshToken, accessExpiresAt: expiresAt ? Number(expiresAt) || null : null }
        : null;
    loaded = true;
    return cache;
  },

  get(): StoredTokens | null {
    return cache;
  },

  /**
   * Replaces the whole pair. The refresh token is written first: if the app is
   * killed mid-write, the device keeps the newest (valid) refresh token and a
   * stale access token simply triggers another refresh.
   */
  async save(accessToken: string, refreshToken: string, expiresInSeconds?: number | null): Promise<void> {
    const accessExpiresAt =
      typeof expiresInSeconds === 'number' && expiresInSeconds > 0 ? Date.now() + expiresInSeconds * 1000 : null;

    cache = { accessToken, refreshToken, accessExpiresAt };
    loaded = true;

    await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken, OPTIONS);
    await SecureStore.setItemAsync(KEYS.accessToken, accessToken, OPTIONS);
    if (accessExpiresAt) {
      await SecureStore.setItemAsync(KEYS.accessExpiresAt, String(accessExpiresAt), OPTIONS);
    } else {
      await SecureStore.deleteItemAsync(KEYS.accessExpiresAt, OPTIONS);
    }
  },

  async clear(): Promise<void> {
    cache = null;
    loaded = true;
    await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key, OPTIONS)));
  },
};
