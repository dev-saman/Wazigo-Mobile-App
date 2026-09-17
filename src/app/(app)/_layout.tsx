import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';
import { BootstrapGate } from '@/features/bootstrap';
import { usePresenceMonitor } from '@/features/presence';
import { usePushNotifications } from '@/features/push/usePushNotifications';
import { useRealtime } from '@/features/realtime/useRealtime';

/**
 * Everything below the gate: permissions, numbers and the tenant are loaded, so
 * presence (CHAT-16/17), live updates (Reverb) and push registration run for
 * exactly as long as the signed-in area is on screen.
 */
function SignedInArea() {
  usePresenceMonitor();
  useRealtime();
  usePushNotifications();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}

/**
 * Signed-in area. The gate renders nothing until AUTH-05 has answered, so every
 * screen below it already has permissions loaded.
 */
export default function AppLayout() {
  return (
    <BootstrapGate>
      <SignedInArea />
    </BootstrapGate>
  );
}
