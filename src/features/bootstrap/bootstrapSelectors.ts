import type { PermissionKey, RoleName } from '@/api/types';
import type { RootState } from '@/store/store';

export const selectBootstrapStatus = (state: RootState) => state.bootstrap.status;
export const selectBootstrapError = (state: RootState) => state.bootstrap.error;
export const selectBootstrapReady = (state: RootState) => state.bootstrap.status === 'ready';
export const selectBootstrapLoadedAt = (state: RootState) => state.bootstrap.loadedAt;

export const selectPermissions = (state: RootState) => state.bootstrap.permissions;
export const selectRoles = (state: RootState) => state.bootstrap.roles;
export const selectNumbers = (state: RootState) => state.bootstrap.numbers;
export const selectTenantId = (state: RootState) => state.bootstrap.tenantId;

/**
 * Phase 4. The support email and the server's finished WhatsApp link. The link
 * is opened exactly as it arrives; the app never reads the number out of it.
 */
export const selectSupport = (state: RootState) => state.bootstrap.support;

/** AUTH-05 addition: socket connection details, or null when Reverb is off. */
export const selectRealtimeConfig = (state: RootState) => state.bootstrap.realtime;

/**
 * LIVE-02: the one channel mobile subscribes to. The server composes the name
 * (`tenant.<id>.agent.<user>`), so the app never decodes the JWT for it, and it
 * carries only conversations assigned to the signed-in person.
 */
export const selectAgentChannel = (state: RootState) => state.bootstrap.realtime?.channels?.agent ?? null;

/**
 * Curried so screens can write `useAppSelector(selectHasPermission(key))`.
 * It returns a boolean, so a new selector on every render costs nothing.
 */
export const selectHasPermission =
  (permission: PermissionKey | string) =>
  (state: RootState): boolean =>
    state.bootstrap.permissions.includes(permission);

export const selectHasAnyPermission =
  (...permissions: (PermissionKey | string)[]) =>
  (state: RootState): boolean =>
    permissions.some((permission) => state.bootstrap.permissions.includes(permission));

export const selectHasRole =
  (role: RoleName) =>
  (state: RootState): boolean =>
    state.bootstrap.roles.includes(role);

/** The number to default to when sending; `is_primary` wins, else the first one. */
export const selectPrimaryNumber = (state: RootState) =>
  state.bootstrap.numbers.find((number) => number.is_primary) ?? state.bootstrap.numbers[0] ?? null;
