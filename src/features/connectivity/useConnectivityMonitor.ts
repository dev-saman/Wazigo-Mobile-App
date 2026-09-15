import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { network } from '@/api/network';
import { useAppDispatch } from '@/store/hooks';

import { connectivityChanged } from './connectivitySlice';

/** Mount once at the root. Feeds NetInfo into Redux and the network layer. */
export function useConnectivityMonitor() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? null;
      network.setOnline(isConnected === false ? false : isConnected);
      dispatch(
        connectivityChanged({
          isConnected,
          isInternetReachable: state.isInternetReachable ?? null,
          type: state.type ?? null,
        }),
      );
    });
    return unsubscribe;
  }, [dispatch]);
}
