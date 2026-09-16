import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { useAppSelector } from '@/store/hooks';

import { isStale, REFRESH_AFTER_MS } from './refreshPolicy';

export type LiveRefreshOptions = {
  /** When the visible data was loaded; `null` means never. */
  loadedAt?: number | null;
  maxAgeMs?: number;
  /** False while the screen has nothing worth refreshing (e.g. it failed). */
  enabled?: boolean;
};

/**
 * The REST fallback for live updates: refresh when the app comes back to the
 * foreground, and again when the device reconnects, but only if what is on
 * screen has aged past `maxAgeMs`.
 *
 * The refresh must be a quiet one - it happens without the user asking, so it
 * must not replace the screen with a spinner or a skeleton.
 */
export function useLiveRefresh(
  refresh: () => void,
  { loadedAt, maxAgeMs = REFRESH_AFTER_MS, enabled = true }: LiveRefreshOptions = {},
) {
  const offline = useAppSelector(selectIsOffline);

  // The listeners are attached once; everything they need is read through this
  // ref, so a new callback or a newer timestamp never re-subscribes them.
  const latest = useRef({ refresh, loadedAt, maxAgeMs, enabled, offline });
  useEffect(() => {
    latest.current = { refresh, loadedAt, maxAgeMs, enabled, offline };
  });

  const refreshIfStale = useCallback(() => {
    const current = latest.current;
    if (!current.enabled || current.offline) return;
    if (!isStale(current.loadedAt, Date.now(), current.maxAgeMs)) return;
    current.refresh();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refreshIfStale();
    });
    return () => subscription.remove();
  }, [refreshIfStale]);

  // Reconnecting is the other moment the screen is certain to be behind.
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) refreshIfStale();
    wasOffline.current = offline;
  }, [offline, refreshIfStale]);
}
