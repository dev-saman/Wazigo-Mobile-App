import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';
import { BootstrapGate } from '@/features/bootstrap';

/**
 * Signed-in area. Stage 6 replaces this stack with the Home / Chats tabs;
 * the gate stays, so every screen below it already has permissions loaded.
 */
export default function AppLayout() {
  return (
    <BootstrapGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      />
    </BootstrapGate>
  );
}
