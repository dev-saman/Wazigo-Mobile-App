import type { ReactElement, ReactNode } from 'react';
import { router } from 'expo-router';

import type { PermissionKey } from '@/api/types';

import { usePermission } from '../usePermission';
import { AccessDeniedView } from './AccessDeniedView';

export type RequirePermissionProps = {
  permission: PermissionKey | string;
  children: ReactNode;
  /** Replaces the default Access Denied screen (e.g. an inline empty state). */
  fallback?: ReactElement | null;
};

/**
 * Wraps a screen whose data the API would refuse. Permissions come from
 * `/me/bootstrap`; this only decides what to show, never what is allowed.
 */
export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const allowed = usePermission(permission);
  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return fallback;

  const canGoBack = router.canGoBack();
  return (
    <AccessDeniedView
      actionLabel={canGoBack ? 'Go Back' : undefined}
      onAction={canGoBack ? () => router.back() : undefined}
    />
  );
}
