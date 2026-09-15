/**
 * Decouples the network layer from Redux / navigation. network.ts emits,
 * the app layer (store listeners) reacts.
 */

export type SessionEventMap = {
  /** Refresh failed or the server invalidated the session. */
  expired: { reason: 'refresh_failed' | 'no_refresh_token' };
  /** A refresh succeeded — carries the user returned by AUTH-04. */
  refreshed: { user: unknown };
};

type Listener<K extends keyof SessionEventMap> = (payload: SessionEventMap[K]) => void;

const listeners: { [K in keyof SessionEventMap]: Set<Listener<K>> } = {
  expired: new Set(),
  refreshed: new Set(),
};

export const sessionEvents = {
  on<K extends keyof SessionEventMap>(event: K, listener: Listener<K>): () => void {
    listeners[event].add(listener);
    return () => {
      listeners[event].delete(listener);
    };
  },

  emit<K extends keyof SessionEventMap>(event: K, payload: SessionEventMap[K]): void {
    listeners[event].forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        if (__DEV__) console.warn(`[session] ${event} listener failed`, error);
      }
    });
  },
};
