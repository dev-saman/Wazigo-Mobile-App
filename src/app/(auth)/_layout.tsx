import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** Login is the first screen of the group, OTP is pushed on top of it. */
export const unstable_settings = { anchor: 'login' };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.surface },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
