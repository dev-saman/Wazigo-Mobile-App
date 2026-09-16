import type { PermissionKey } from '@/api/types';
import { useAppSelector } from '@/store/hooks';

import { selectHasAnyPermission, selectHasPermission } from './bootstrapSelectors';

/** True when `/me/bootstrap` granted this permission to the signed-in user. */
export function usePermission(permission: PermissionKey | string): boolean {
  return useAppSelector(selectHasPermission(permission));
}

export function useAnyPermission(...permissions: (PermissionKey | string)[]): boolean {
  return useAppSelector(selectHasAnyPermission(...permissions));
}
