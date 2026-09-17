import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import * as api from '@/api/apis';
import { Config } from '@/constants/config';
import { selectCurrentUser } from '@/features/auth/authSelectors';
import { selectNumbers, selectTenantId } from '@/features/bootstrap/bootstrapSelectors';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { createSocketClient, type SocketClient, type SocketState } from '@/services/socket/socketClient';
import { registerSessionCleanup } from '@/services/session/sessionCleanup';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import { createLiveBatcher } from './liveBatch';
import { liveSignalBus } from './liveSignalBus';
import { applyLiveBatch } from './liveUpdateThunks';
import { socketStateChanged } from './realtimeSlice';

/** While the socket is down but the app is open and online, visible screens poll this often. */
export const POLL_WHILE_DISCONNECTED_MS = 15_000;

/**
 * Live updates for the signed-in area (mounted below `BootstrapGate`).
 *
 * - Connects to Reverb while the app is in the foreground and online, and
 *   disconnects in the background - push notifications cover a closed app.
 * - Listens on the user's personal channel and on each WhatsApp number the
 *   bootstrap lists. Events are signals only (see services/socket/channels.ts).
 * - After a reconnect it catches up once; while it cannot connect at all it
 *   falls back to a 15 s poll of whatever is on screen.
 */
export function useRealtime() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const tenantId = useAppSelector(selectTenantId);
  const numbers = useAppSelector(selectNumbers);
  const offline = useAppSelector(selectIsOffline);

  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [socketState, setSocketState] = useState<SocketState>('disconnected');

  const userId = typeof user?.id === 'number' ? user.id : null;
  // A string key, so a bootstrap re-fetch with the same numbers does not resubscribe.
  const numberKey = useMemo(
    () =>
      numbers
        .map((number) => number.id)
        .filter((id) => Number.isInteger(id))
        .sort((a, b) => a - b)
        .join(','),
    [numbers],
  );

  // One batcher per mount (lazy state initializer), one socket client per effect run.
  const [batcher] = useState(() => createLiveBatcher((batch) => void dispatch(applyLiveBatch(batch))));
  const clientRef = useRef<SocketClient | null>(null);

  useEffect(() => {
    const unsubscribe = liveSignalBus.subscribe((signal) => {
      if (signal === 'everything') batcher.pushEverything();
      else batcher.push(signal);
    });
    return () => {
      unsubscribe();
      batcher.cancel();
    };
  }, [batcher]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      // 'inactive' (iOS app switcher, a system sheet) keeps the connection.
      setForeground(state !== 'background');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const client = createSocketClient({
      appKey: Config.reverb.appKey,
      host: Config.reverb.host,
      port: Config.reverb.port,
      scheme: Config.reverb.scheme,
      authorize: async (payload) => (await api.authorizeBroadcastChannel(payload)).data,
      onSignal: (signal) => liveSignalBus.emit(signal),
      onStateChange: (state) => {
        setSocketState(state);
        dispatch(socketStateChanged(state));
      },
    });
    clientRef.current = client;
    // Sign-out clears the session before this area unmounts; drop the socket first.
    const unregister = registerSessionCleanup(() => client.disconnect());
    return () => {
      unregister();
      client.disconnect();
      clientRef.current = null;
    };
  }, [dispatch]);

  const canConnect = foreground && !offline && userId !== null && tenantId !== null;

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    if (!canConnect || userId === null || tenantId === null) {
      client.disconnect();
      return;
    }
    const numberIds = numberKey ? numberKey.split(',').map(Number) : [];
    client.connect({ userId, tenantId, numberIds });
  }, [canConnect, numberKey, tenantId, userId]);

  // Catch up once after the connection comes back; the first connection of the
  // session needs nothing, the screens have only just loaded.
  const everConnected = useRef(false);
  const wasConnected = useRef(false);
  useEffect(() => {
    const connected = socketState === 'connected';
    if (connected && !wasConnected.current) {
      if (everConnected.current) batcher.pushEverything();
      everConnected.current = true;
    }
    wasConnected.current = connected;
  }, [batcher, socketState]);

  // The stopgap: nothing live is arriving, so what is on screen polls.
  useEffect(() => {
    if (!foreground || offline || socketState === 'connected' || socketState === 'connecting') return;
    const timer = setInterval(() => batcher.pushEverything(), POLL_WHILE_DISCONNECTED_MS);
    return () => clearInterval(timer);
  }, [batcher, foreground, offline, socketState]);
}
