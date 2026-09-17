import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { ApiError } from '@/api/types';
import { getDeviceName } from '@/utils/device';

/**
 * Which token the server holds for this app session. In memory only: a cold
 * start registers again, which the server treats as an update of the same token.
 */
let registered: { token: string; userId: number } | null = null;

export type PushPlatform = 'ios' | 'android';

const warn = (what: string, error: ApiError) => {
  if (!__DEV__) return;
  // A 422 lists the fields the server expected - the quickest way to spot a contract change.
  const fields = error.errors ? ` fields: ${Object.keys(error.errors).join(', ')}` : '';
  console.warn(`[push] ${what} failed: ${error.code}${error.status ? ` ${error.status}` : ''}${fields}`);
};

/**
 * POST /me/devices. Skips a token already registered for this user, and never
 * throws: a failure leaves `registered` empty, so the next attempt tries again.
 */
export async function registerPushToken(token: string, userId: number, platform: PushPlatform): Promise<boolean> {
  if (registered?.token === token && registered.userId === userId) return true;
  try {
    await api.registerPushDevice({ token, platform, provider: 'expo', device_name: getDeviceName() });
    registered = { token, userId };
    return true;
  } catch (error) {
    warn('register', normalizeError(error));
    return false;
  }
}

/**
 * DELETE /me/devices, before the session is revoked, so a signed-out phone
 * stops receiving the agent's customer notifications. Best-effort: offline or
 * an already-dead session must not block signing out.
 */
export async function unregisterPushToken(): Promise<void> {
  const current = registered;
  registered = null;
  if (!current) return;
  try {
    await api.unregisterPushDevice({ token: current.token });
  } catch (error) {
    warn('unregister', normalizeError(error));
  }
}

/** Session expiry: the server can no longer be told, so only forget locally. */
export function forgetPushToken(): void {
  registered = null;
}

/** Test helper. */
export function registeredPushToken(): string | null {
  return registered?.token ?? null;
}
