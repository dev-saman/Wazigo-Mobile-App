/**
 * How the app stays current **without** a live socket.
 *
 * Live updates over Reverb are not connected (see the handover: the app key,
 * the `/broadcasting/auth` location and the event catalogue are all unknown, and
 * backend blocker 5 means the only documented channel would deliver other
 * assignees' message content to this app). Until that is settled, a screen
 * refreshes itself when the app returns to the foreground or the device
 * reconnects - on top of pull-to-refresh, which is always available.
 */

/** A screen older than this is refreshed on foreground or reconnect. */
export const REFRESH_AFTER_MS = 30_000;

/** Permissions change rarely, and re-fetching them costs a full bootstrap. */
export const PERMISSIONS_REFRESH_AFTER_MS = 5 * 60_000;

/**
 * True when there is nothing loaded yet, when what is loaded is older than
 * `maxAgeMs`, or when the clock has moved backwards (a timestamp in the future
 * cannot be trusted to age).
 */
export function isStale(
  loadedAt: number | null | undefined,
  now: number = Date.now(),
  maxAgeMs: number = REFRESH_AFTER_MS,
): boolean {
  if (loadedAt == null) return true;
  if (loadedAt > now) return true;
  return now - loadedAt >= maxAgeMs;
}
