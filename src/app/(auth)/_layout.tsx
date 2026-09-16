import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';
import { selectSessionExpired } from '@/features/auth/authSelectors';
import { useAppSelector } from '@/store/hooks';

/** Login is the first screen of the group, OTP is pushed on top of it. */
export const unstable_settings = { anchor: 'login' };

export default function AuthLayout() {
  const sessionExpired = useAppSelector(selectSessionExpired);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.surface },
      }}
    >
      {/* An expired session lands here, not on Login with a banner: it is the
          only reachable screen until it is acknowledged, so a refresh that
          fails during a background fetch cannot leave a half-loaded screen up.
          Clearing the flag reopens Login and the router moves to it. */}
      <Stack.Protected guard={sessionExpired}>
        <Stack.Screen name="session-expired" />
      </Stack.Protected>

      <Stack.Protected guard={!sessionExpired}>
        <Stack.Screen name="login" />
        <Stack.Screen name="otp" />
      </Stack.Protected>
    </Stack>
  );
}
