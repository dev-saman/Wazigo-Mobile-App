import type { PermissionKey, RoleName } from '@/api/types';
import type { RootState } from '@/store/store';

export const selectBootstrapStatus = (state: RootState) => state.bootstrap.status;
export const selectBootstrapError = (state: RootState) => state.bootstrap.error;
export const selectBootstrapReady = (state: RootState) => state.bootstrap.status === 'ready';
export const selectBootstrapLoadedAt = (state: RootState) => state.bootstrap.loadedAt;

export const selectPermissions = (state: RootState) => state.bootstrap.permissions;
export const selectRoles = (state: RootState) => state.bootstrap.roles;
export const selectNumbers = (state: RootState) => state.bootstrap.numbers;

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
