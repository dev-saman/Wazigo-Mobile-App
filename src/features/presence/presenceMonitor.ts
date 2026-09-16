import type { PresenceStatus } from '@/api/types';

/** CHAT-17: the server expects a heartbeat about once a minute while active. */
export const HEARTBEAT_MS = 60_000;

/** Foregrounded means online; anything else is away. Offline is only sent on stop. */
export const presenceForAppState = (state: string): PresenceStatus =>
  state === 'active' ? 'online' : 'away';

export type PresenceDeps = {
  /** CHAT-16 */
  setStatus: (status: PresenceStatus) => Promise<unknown>;
  /** CHAT-17 */
  heartbeat: () => Promise<unknown>;
  /** Presence is never sent while the device has no network. */
  isOffline: () => boolean;
};

export type PresenceMonitor = {
  /** Foreground/background changes come in here. */
  setStatus: (status: PresenceStatus) => void;
  /** Re-sends the desired status, e.g. once the device is back online. */
  sync: () => void;
  stop: () => void;
};

/**
 * Presence is best-effort by design: **every failure is swallowed**. A missed
 * status or heartbeat must never interrupt reading or sending a message, and
 * the next foreground, reconnect or heartbeat tries again anyway.
 *
 * The transport is injected so the policy - what is sent, when, and how often -
 * can be tested without the network or React.
 */
export function createPresenceMonitor(deps: PresenceDeps): PresenceMonitor {
  /** What the app wants the server to believe. `null` before the first call. */
  let desired: PresenceStatus | null = null;
  /** The last status the server actually accepted. */
  let confirmed: PresenceStatus | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  /** One status call at a time: a foreground and a reconnect can arrive together. */
  let sending = false;

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const send = () => {
    if (desired === null || desired === confirmed || sending || deps.isOffline()) return;
    const status = desired;
    sending = true;
    void deps
      .setStatus(status)
      .then(() => {
        confirmed = status;
      })
      .catch(() => {
        // Unconfirmed: the next sync or heartbeat sends it again.
        confirmed = null;
      })
      .finally(() => {
        sending = false;
        // The app moved while that call was in flight - going to the background
        // during it, say. Send the new status rather than waiting for a
        // heartbeat that "away" has just stopped. A *failed* call is not
        // retried here: that would spin.
        if (desired !== status) send();
      });
  };

  const beat = () => {
    if (deps.isOffline()) return;
    // A heartbeat for a status the server never accepted would be meaningless.
    if (confirmed !== 'online') {
      send();
      return;
    }
    void deps.heartbeat().catch(() => undefined);
  };

  return {
    setStatus(status) {
      desired = status;
      send();
      if (status === 'online') {
        if (!timer) timer = setInterval(beat, HEARTBEAT_MS);
      } else {
        stopTimer();
      }
    },
    sync() {
      send();
    },
    stop() {
      stopTimer();
      desired = null;
      confirmed = null;
    },
  };
}
