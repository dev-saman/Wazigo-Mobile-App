import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * NON-SENSITIVE persisted data only (UI preferences, filters, cache metadata).
 * Never store tokens, passwords, OTPs or message content here.
 */

const PREFIX = 'wazigo:';

export const StorageKeys = {
  chatFilters: 'prefs:chat_filters',
  lastTab: 'prefs:last_tab',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export const appStorage = {
  async get<T>(key: StorageKey): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },

  async set<T>(key: StorageKey, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Preferences are best-effort.
    }
  },

  async remove(key: StorageKey): Promise<void> {
    await AsyncStorage.removeItem(PREFIX + key);
  },

  /** Removes every Wazigo key (called on logout / session expiry). */
  async clearAll(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  },
};
