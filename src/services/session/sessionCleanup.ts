import { appStorage } from '@/services/storage/appStorage';
import { tokenStorage } from '@/services/storage/tokenStorage';

/**
 * Services that hold private per-session state (socket client, presence
 * heartbeat, media cache…) register a cleanup here instead of being imported
 * by the auth layer.
 */
type CleanupHandler = () => void | Promise<void>;

const handlers = new Set<CleanupHandler>();

export const registerSessionCleanup = (handler: CleanupHandler) => {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
};

/** Clears SecureStore tokens, private AsyncStorage data and registered services. */
export async function clearLocalSession(): Promise<void> {
  const tasks: Promise<unknown>[] = [tokenStorage.clear(), appStorage.clearAll()];
  handlers.forEach((handler) => tasks.push(Promise.resolve().then(handler)));

  const results = await Promise.allSettled(tasks);
  if (__DEV__) {
    results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .forEach((r) => console.warn('[session] cleanup step failed', r.reason));
  }
}
