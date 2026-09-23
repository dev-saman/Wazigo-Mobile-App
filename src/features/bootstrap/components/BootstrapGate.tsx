import { useCallback, useEffect, type ReactNode } from 'react';

import { Button, Screen } from '@/components/common';
import { ErrorState } from '@/components/feedback';
import { selectAuthStatus } from '@/features/auth/authSelectors';
import { signOut } from '@/features/auth/authThunks';
import { SplashView } from '@/features/auth/components/SplashView';
import { PERMISSIONS_REFRESH_AFTER_MS, useLiveRefresh } from '@/features/realtime';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import { selectBootstrapError, selectBootstrapLoadedAt, selectBootstrapStatus } from '../bootstrapSelectors';
import { loadBootstrap } from '../bootstrapThunks';
import { AccessDeniedView } from './AccessDeniedView';

const Copy = {
  failedTitle: 'We could not load your account',
  retryLabel: 'Retry loading your account',
  signOut: 'Sign out',
};

/**
 * Nothing in the signed-in area renders until AUTH-05 has answered, so no
 * screen can ever be shown, or a request sent, without the server's own list of
 * what this user may do. The loading state reuses the launch splash, so login
 * and cold start look like one continuous screen.
 */
export function BootstrapGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectBootstrapStatus);
  const error = useAppSelector(selectBootstrapError);
  const loadedAt = useAppSelector(selectBootstrapLoadedAt);
  const authStatus = useAppSelector(selectAuthStatus);

  useEffect(() => {
    if (status === 'idle') void dispatch(loadBootstrap());
  }, [dispatch, status]);

  /**
   * Permissions used to be fetched once per session, so a change on the server
   * was only seen on the next launch. They are re-fetched on foreground and on
   * reconnect now - silently, so a background failure keeps the permissions the
   * app already has instead of throwing up a retry screen.
   */
  useLiveRefresh(
    useCallback(() => void dispatch(loadBootstrap({ silent: true })), [dispatch]),
    { loadedAt, maxAgeMs: PERMISSIONS_REFRESH_AFTER_MS, enabled: status === 'ready' },
  );

  // A 401 that survived the network layer's refresh means the session is gone.
  useEffect(() => {
    if (status === 'failed' && error?.code === 'UNAUTHORIZED' && authStatus === 'authenticated') {
      void dispatch(signOut());
    }
  }, [authStatus, dispatch, error?.code, status]);

  // Phase 4: a 403 that closes the whole business is already being handled -
  // the session is being cleared and the suspended screen put up. Showing
  // "Access Denied" for the frame or two in between would be wrong and would
  // flash. Wait it out on the splash instead.
  if (error?.workspace) return <SplashView busy />;

  if (status === 'denied') {
    return (
      <AccessDeniedView
        description={error?.message}
        actionLabel={Copy.signOut}
        onAction={() => void dispatch(signOut())}
      />
    );
  }

  if (status === 'failed' && error?.code !== 'UNAUTHORIZED') {
    return (
      <Screen>
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadBootstrap())}
          retryAccessibilityLabel={Copy.retryLabel}
          footer={
            <Button
              title={Copy.signOut}
              variant="ghost"
              fullWidth={false}
              onPress={() => void dispatch(signOut())}
            />
          }
        />
      </Screen>
    );
  }

  if (status !== 'ready') return <SplashView busy />;

  return <>{children}</>;
}
