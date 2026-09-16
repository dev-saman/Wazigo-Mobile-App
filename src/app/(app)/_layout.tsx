import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/**
 * Signed-in area. Stage 6 replaces this stack with the Home / Chats tabs.
 */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
