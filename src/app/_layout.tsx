import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { Colors, FontAssets } from '@/constants/theme';
import { useConnectivityMonitor } from '@/features/connectivity/useConnectivityMonitor';
import { store } from '@/store/store';

// Keep the native splash up until Poppins is ready so no system font flashes.
SplashScreen.preventAutoHideAsync();

function AppShell() {
  useConnectivityMonitor();

  // Auth/app route groups and session restore are added in Stages 4–5.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
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
