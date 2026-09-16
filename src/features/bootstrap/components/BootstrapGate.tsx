import { useEffect, type ReactNode } from 'react';

import { Button, Screen } from '@/components/common';
import { StateView } from '@/components/feedback';
import { selectAuthStatus } from '@/features/auth/authSelectors';
import { signOut } from '@/features/auth/authThunks';
import { SplashView } from '@/features/auth/components/SplashView';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import { selectBootstrapError, selectBootstrapStatus } from '../bootstrapSelectors';
import { loadBootstrap } from '../bootstrapThunks';
import { AccessDeniedView } from './AccessDeniedView';

const Copy = {
  offlineTitle: 'You are offline',
  offlineDescription: 'Please check your internet connection and try again.',
  failedTitle: 'We could not load your account',
  retry: 'Retry',
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
  const authStatus = useAppSelector(selectAuthStatus);

  useEffect(() => {
    if (status === 'idle') void dispatch(loadBootstrap());
  }, [dispatch, status]);

  // A 401 that survived the network layer's refresh means the session is gone.
  useEffect(() => {
    if (status === 'failed' && error?.code === 'UNAUTHORIZED' && authStatus === 'authenticated') {
      void dispatch(signOut());
    }
  }, [authStatus, dispatch, error?.code, status]);

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
    const offline = !!error?.isOffline;
    return (
      <Screen>
        <StateView
          icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          tone={offline ? 'neutral' : 'error'}
          title={offline ? Copy.offlineTitle : Copy.failedTitle}
          description={offline ? Copy.offlineDescription : error?.message}
          actionLabel={Copy.retry}
          onAction={() => void dispatch(loadBootstrap())}
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
