import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import * as api from '@/api/apis';
import { selectCurrentUser } from '@/features/auth/authSelectors';
import { selectAgentChannel, selectRealtimeConfig } from '@/features/bootstrap/bootstrapSelectors';
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
 * - Connection details and the channel name both come from AUTH-05
 *   `data.realtime` (2026-09-18). Nothing about the socket is bundled any more.
 * - Listens on the user's notification channel and the LIVE-02 personal agent
 *   channel - never the per-number channels, which carry colleagues' customers.
 *   Events are signals only (see services/socket/channels.ts).
 * - After a reconnect it catches up once; while it cannot connect at all it
 *   falls back to a 15 s poll of whatever is on screen.
 */
export function useRealtime() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const realtime = useAppSelector(selectRealtimeConfig);
  const agentChannel = useAppSelector(selectAgentChannel);
  const offline = useAppSelector(selectIsOffline);

  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [socketState, setSocketState] = useState<SocketState>('disconnected');

  const userId = typeof user?.id === 'number' ? user.id : null;

  /**
   * Entirely server-supplied (AUTH-05 `data.realtime`). Nothing about the socket
   * is bundled: a build carries no app key, no host, no port. When the server
   * sends no `realtime` block there is nothing to connect to and the app lives
   * on the REST poll below - the documented behaviour for `realtime: null`.
   */
  const connection = useMemo(
    () => ({
      appKey: realtime?.key ?? '',
      host: realtime?.host ?? '',
      port: realtime?.port ?? 443,
      scheme: realtime?.scheme ?? 'https',
    }),
    [realtime?.key, realtime?.host, realtime?.port, realtime?.scheme],
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
      appKey: connection.appKey,
      host: connection.host,
      port: connection.port,
      scheme: connection.scheme,
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
  }, [connection, dispatch]);

  // No agent channel means the server has nothing personal to deliver here;
  // connecting anyway would only subscribe to the notification channel.
  const canConnect = foreground && !offline && userId !== null && Boolean(agentChannel);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    if (!canConnect || userId === null) {
      client.disconnect();
      return;
    }
    client.connect({ userId, agentChannel });
  }, [agentChannel, canConnect, userId]);

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
