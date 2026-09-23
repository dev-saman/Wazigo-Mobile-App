import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { BootstrapPayload, RealtimeConfig, RoleName, WhatsAppNumber } from '@/api/types';
import { userUpdated } from '@/features/auth/authSlice';
import { toSupportContact } from '@/api/support';
import { createAppAsyncThunk } from '@/store/hooks';

import { bootstrapFailed, bootstrapLoaded, bootstrapLoading, type BootstrapData } from './bootstrapSlice';

/** Roles arrive as names, but some endpoints send `{ name }` objects. */
const toRoleNames = (roles: BootstrapPayload['roles'] | { name: RoleName }[] | undefined): RoleName[] => {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((role) => (typeof role === 'string' ? role : role?.name))
    .filter((name): name is RoleName => typeof name === 'string' && name.length > 0);
};

const toStringList = (values: unknown): string[] =>
  Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];

const toNumbers = (numbers: unknown): WhatsAppNumber[] =>
  Array.isArray(numbers) ? (numbers.filter((item) => item && typeof item === 'object') as WhatsAppNumber[]) : [];

/** A positive integer id, whether the server sends it as a number or a string. */
const toId = (value: unknown): number | null => {
  const id = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * AUTH-05 addition. Validated rather than trusted: a half-filled block (no key,
 * no host) is worse than none, because the socket would fail on every attempt
 * instead of falling straight through to the REST poll.
 */
const toRealtime = (value: unknown): RealtimeConfig | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const host = typeof raw.host === 'string' ? raw.host.trim() : '';
  if (!key || !host) return null;

  const port = Number(raw.port);
  const scheme = raw.scheme === 'http' ? 'http' : 'https';
  const channels = raw.channels && typeof raw.channels === 'object' ? (raw.channels as Record<string, unknown>) : {};
  const text = (candidate: unknown) =>
    typeof candidate === 'string' && candidate.trim() !== '' ? candidate.trim() : null;

  return {
    key,
    host,
    port: Number.isFinite(port) && port > 0 ? port : scheme === 'https' ? 443 : 80,
    scheme,
    auth_path: text(raw.auth_path) ?? '/api/v1/broadcasting/auth',
    channels: {
      agent: text(channels.agent),
      numbers: Array.isArray(channels.numbers)
        ? channels.numbers.filter((name): name is string => typeof name === 'string' && name.trim() !== '')
        : null,
      tenant: text(channels.tenant),
      user: text(channels.user),
    },
  };
};

/** Only the fields mobile uses; routes, menus, flags and billing are ignored. */
const select = (payload: BootstrapPayload | undefined): BootstrapData => ({
  permissions: toStringList(payload?.permissions),
  roles: toRoleNames(payload?.roles),
  numbers: toNumbers(payload?.numbers),
  tenantId: toId(payload?.settings?.tenant?.id),
  realtime: toRealtime(payload?.realtime),
  // Phase 4 is not published yet: an absent block reads as "nothing is set".
  support: toSupportContact(payload?.support),
});

/**
 * AUTH-05. The signed-in area does not render until this succeeds, so nothing
 * can be shown or sent without the server's own view of what the user may do.
 *
 * `silent` is the periodic re-fetch (app foreground / reconnect) that picks up
 * a permission change made on the server mid-session. It never shows the
 * loading gate, and a transient failure keeps the permissions already in hand -
 * the app must not fall back to a retry screen because one background call
 * timed out. A 403 or a 401 is not transient: access was taken away, and it is
 * handled exactly as it would be on the first load.
 */
export const loadBootstrap = createAppAsyncThunk<BootstrapData, { silent?: boolean } | void>(
  'bootstrap/load',
  async (arg, { dispatch, rejectWithValue }) => {
    const silent = !!(arg && arg.silent);
    if (!silent) dispatch(bootstrapLoading());
    try {
      const { data } = await api.getBootstrap();
      const bootstrap = select(data);
      dispatch(bootstrapLoaded(bootstrap));
      // Login returns a slimmer user; bootstrap's copy is authoritative.
      if (data?.user) dispatch(userUpdated(data.user));
      return bootstrap;
    } catch (error) {
      const apiError = normalizeError(error);
      const revoked = apiError.code === 'FORBIDDEN' || apiError.code === 'UNAUTHORIZED';
      if (!silent || revoked) dispatch(bootstrapFailed(apiError));
      else if (__DEV__) console.warn('[bootstrap] silent refresh failed', apiError.code);
      return rejectWithValue(apiError);
    }
  },
);
