import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import * as api from '@/api/apis';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { useAppSelector } from '@/store/hooks';

import { createPresenceMonitor, presenceForAppState, type PresenceMonitor } from './presenceMonitor';

/**
 * CHAT-16 / CHAT-17 for the signed-in area. Mounted below `BootstrapGate`, so
 * presence is only ever reported for a session the server has accepted.
 *
 * Nothing renders it: no design screen shows the agent's own presence, and the
 * API has no presence for the customer either. It exists so the dashboard shows
 * this agent as active while the app is open.
 */
export function usePresenceMonitor() {
  const offline = useAppSelector(selectIsOffline);

  // Read at call time by the monitor, so a change never rebuilds it.
  const offlineRef = useRef(offline);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  // Built inside the effect: nothing about presence belongs to rendering.
  const monitorRef = useRef<PresenceMonitor | null>(null);

  useEffect(() => {
    const monitor = createPresenceMonitor({
      setStatus: (status) => api.updatePresence({ status }),
      heartbeat: () => api.sendPresenceHeartbeat(),
      isOffline: () => offlineRef.current,
    });
    monitorRef.current = monitor;

    monitor.setStatus(presenceForAppState(AppState.currentState ?? 'active'));
    const subscription = AppState.addEventListener('change', (state) => {
      monitor.setStatus(presenceForAppState(state));
    });

    // Unmounting means the signed-in area is gone - a sign-out or an expiry -
    // so the heartbeat stops with it and the server times the session out.
    return () => {
      subscription.remove();
      monitor.stop();
      monitorRef.current = null;
    };
  }, []);

  // Coming back online is the moment a status the server never received is
  // worth re-sending.
  useEffect(() => {
    if (!offline) monitorRef.current?.sync();
  }, [offline]);
}
