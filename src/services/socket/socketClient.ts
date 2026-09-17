/**
 * The ONLY module allowed to import pusher-js (ESLint-enforced).
 *
 * Reverb speaks the Pusher protocol, so the Pusher client connects to it
 * directly - the same settings the web app gives Laravel Echo: the public app
 * key, the site host on 443 over TLS, WebSocket transports only.
 *
 * Nothing outside this folder sees the client. The app gets `LiveSignal`s
 * (a conversation id, never content - see channels.ts) and a connection state.
 * Channel auth goes through `api.authorizeBroadcastChannel`, so it carries the
 * bearer token and the same refresh-and-retry rules as every other call.
 */
import Pusher, { type Channel } from 'pusher-js/react-native';

import { channelsFor, signalFromEvent, type LiveSignal, type LiveSubscription } from './channels';

export type SocketState = 'disconnected' | 'connecting' | 'connected' | 'unavailable';

export type SocketAuthorizer = (payload: {
  socket_id: string;
  channel_name: string;
}) => Promise<{ auth: string; channel_data?: string }>;

export type SocketClientOptions = {
  appKey: string;
  host: string;
  port: number;
  scheme: string;
  authorize: SocketAuthorizer;
  onSignal: (signal: LiveSignal) => void;
  onStateChange: (state: SocketState) => void;
};

export type SocketClient = {
  /** Connects, or moves the subscriptions to a new set of channels. */
  connect: (subscription: LiveSubscription) => void;
  disconnect: () => void;
};

/** Pusher's connection states, collapsed to what the app needs to know. */
const toSocketState = (state: string): SocketState => {
  if (state === 'connected') return 'connected';
  if (state === 'initialized' || state === 'connecting') return 'connecting';
  if (state === 'unavailable' || state === 'failed') return 'unavailable';
  return 'disconnected';
};

export function createSocketClient(options: SocketClientOptions): SocketClient {
  let pusher: Pusher | null = null;
  const channels = new Map<string, Channel>();

  const listen = (name: string) => {
    if (!pusher || channels.has(name)) return;
    const channel = pusher.subscribe(name);
    channel.bind_global((eventName: string, payload: unknown) => {
      if (eventName.startsWith('pusher:') || eventName.startsWith('pusher_internal:')) return;
      // Reduced to an id here, at the edge: the payload goes no further.
      const signal = signalFromEvent(eventName, payload);
      if (signal) options.onSignal(signal);
    });
    channel.bind('pusher:subscription_error', (error: { status?: number } | undefined) => {
      // 403 means the server refused this channel for this user; that is its call to make.
      if (__DEV__) console.warn(`[socket] subscription refused: ${name} (${error?.status ?? 'unknown'})`);
    });
    channels.set(name, channel);
  };

  const stopListening = (name: string) => {
    const channel = channels.get(name);
    if (!channel) return;
    channel.unbind_all();
    channel.unbind_global();
    pusher?.unsubscribe(name);
    channels.delete(name);
  };

  const disconnect = () => {
    Array.from(channels.keys()).forEach(stopListening);
    if (pusher) {
      pusher.connection.unbind('state_change');
      pusher.disconnect();
      pusher = null;
    }
    options.onStateChange('disconnected');
  };

  const connect = (subscription: LiveSubscription) => {
    if (!options.appKey) {
      options.onStateChange('unavailable');
      return;
    }

    if (!pusher) {
      const tls = options.scheme === 'https';
      pusher = new Pusher(options.appKey, {
        cluster: '',
        wsHost: options.host,
        wsPort: options.port,
        wssPort: options.port,
        forceTLS: tls,
        // Exactly the web app's setting: WebSocket only, no HTTP fallbacks.
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
        channelAuthorization: {
          customHandler: ({ socketId, channelName }, callback) => {
            options
              .authorize({ socket_id: socketId, channel_name: channelName })
              .then((data) => callback(null, data))
              .catch((error: unknown) => {
                const code = (error as { code?: string } | null)?.code ?? 'UNKNOWN';
                callback(new Error(`Channel authorization failed (${code})`), null);
              });
          },
        },
      });
      pusher.connection.bind('state_change', ({ current }: { current: string }) => {
        options.onStateChange(toSocketState(current));
      });
      options.onStateChange('connecting');
    }

    const wanted = channelsFor(subscription);
    const names = new Set([wanted.user, ...wanted.numbers]);
    Array.from(channels.keys())
      .filter((name) => !names.has(name))
      .forEach(stopListening);
    names.forEach(listen);
  };

  return { connect, disconnect };
}
