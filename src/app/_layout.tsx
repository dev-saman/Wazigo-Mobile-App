import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors, FontAssets } from '@/constants/theme';

// Keep the native splash up until Poppins is ready so no system font flashes.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontError && __DEV__) console.warn('[fonts] Poppins failed to load', fontError.message);
    if (ready) SplashScreen.hide();
  }, [ready, fontError]);

  if (!ready) return null;

  // Redux, session restore and the auth/app route groups are added in Stages 3–5.
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      />
    </SafeAreaProvider>
  );
}
