import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { Colors, FontAssets } from '@/constants/theme';
import { selectAuthStatus } from '@/features/auth/authSelectors';
import { restoreSession } from '@/features/auth/authThunks';
import { SplashView } from '@/features/auth/components/SplashView';
import { useConnectivityMonitor } from '@/features/connectivity/useConnectivityMonitor';
import { clearMediaCache } from '@/services/media/mediaCache';
import { registerSessionCleanup } from '@/services/session/sessionCleanup';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { store } from '@/store/store';

// Keep the native splash up until Poppins is ready so no system font flashes.
SplashScreen.preventAutoHideAsync();

function AppShell() {
  useConnectivityMonitor();

  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);

  useEffect(() => {
    if (status === 'unknown') void dispatch(restoreSession());
  }, [dispatch, status]);

  // Downloaded media is private to the session, so logout and expiry clear it.
  useEffect(() => registerSessionCleanup(clearMediaCache), []);

  // The brand splash stands in for the navigator until the stored session has
  // been checked, so no screen from either group can flash first.
  if (status === 'unknown') return <SplashView busy />;

  // Exactly one group is then reachable; Expo Router moves to the first
  // available screen whenever a guard closes behind the user.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Protected guard={status === 'authenticated' || status === 'signingOut'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontError && __DEV__) console.warn('[fonts] Poppins failed to load', fontError.message);
    if (ready) SplashScreen.hide();
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </Provider>
  );
}
