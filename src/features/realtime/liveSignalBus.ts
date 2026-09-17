import type { LiveSignal } from '@/services/socket/channels';

/**
 * One way in for live updates, whatever brought them: a socket event, a push
 * notification that arrived while the app was open, a poll. `useRealtime`
 * listens and batches; senders never touch Redux directly.
 */
type Listener = (signal: LiveSignal | 'everything') => void;

const listeners = new Set<Listener>();

export const liveSignalBus = {
  emit(signal: LiveSignal) {
    listeners.forEach((listener) => listener(signal));
  },
  /** Refresh everything on screen (e.g. a push without a conversation id). */
  emitEverything() {
    listeners.forEach((listener) => listener('everything'));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
