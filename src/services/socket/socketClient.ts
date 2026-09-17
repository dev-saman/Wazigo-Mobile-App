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
 *
 * NEVER THROWS. A live update is an extra: anything that goes wrong in here
 * (a missing class, a bad option, a client error) is logged in development and
 * reported as `unavailable`, and the screens carry on with the REST fallback.
 * An exception from here once took down the whole signed-in area.
 */
import type PusherClient from 'pusher-js/react-native';
import type { Channel } from 'pusher-js/react-native';
import * as PusherModule from 'pusher-js/react-native';

import { channelsFor, signalFromEvent, type LiveSignal, type LiveSubscription } from './channels';
import { resolvePusherConstructor } from './resolvePusher';

type Pusher = PusherClient;

/** See resolvePusher.ts: the React Native bundle exports `{ Pusher }`, not a default. */
const PusherConstructor = resolvePusherConstructor<typeof PusherClient>(PusherModule);

const report = (what: string, error: unknown) => {
  if (__DEV__) console.warn(`[socket] ${what}:`, error instanceof Error ? error.message : error);
};

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
    try {
      Array.from(channels.keys()).forEach(stopListening);
      if (pusher) {
        pusher.connection.unbind('state_change');
        pusher.disconnect();
      }
    } catch (error) {
      report('disconnect failed', error);
    } finally {
      channels.clear();
      pusher = null;
    }
    options.onStateChange('disconnected');
  };

  const connect = (subscription: LiveSubscription) => {
    try {
      open(subscription);
    } catch (error) {
      report('could not connect', error);
      // Leave nothing half-built behind; the poll fallback takes over.
      try {
        pusher?.disconnect();
      } catch {
        // Already broken; nothing more to do.
      }
      channels.clear();
      pusher = null;
      options.onStateChange('unavailable');
    }
  };

  const open = (subscription: LiveSubscription) => {
    if (!options.appKey) {
      options.onStateChange('unavailable');
      return;
    }
    if (!PusherConstructor) {
      report('could not connect', 'pusher-js did not export a client class');
      options.onStateChange('unavailable');
      return;
    }

    if (!pusher) {
      const tls = options.scheme === 'https';
      pusher = new PusherConstructor(options.appKey, {
        cluster: '',
        wsHost: options.host,
        wsPort: options.port,
        wssPort: options.port,
        forceTLS: tls,
        // Exactly the web app's setting: WebSocket only, no HTTP fallbacks.
        enabledTransports: ['ws', 'wss'],
        // `disableStats` is deprecated in pusher-js 8 and logs a warning; this is its replacement.
        enableStats: false,
        channelAuthorization: {
          customHandler: ({ socketId, channelName }, callback) => {
            options
              .authorize({ socket_id: socketId, channel_name: channelName })
              .then((body) => {
                // Laravel returns `{ auth }` raw; tolerate the API envelope too, just in case.
                const data = (body as { auth?: string }).auth
                  ? body
                  : (body as unknown as { data?: { auth?: string; channel_data?: string } }).data;
                if (data?.auth) callback(null, { auth: data.auth, channel_data: data.channel_data });
                else callback(new Error('Channel authorization returned no signature'), null);
              })
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
