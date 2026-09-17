import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';

/** Icon (25) + label (16) + item padding (10), with room to breathe. */
const TAB_BAR_CONTENT_HEIGHT = 64;

/**
 * Mobile v1 has two tabs: Home and Chats. The design's Templates and More tabs
 * are out of phase-1 scope (templates are reached from inside a conversation).
 *
 * JS tabs, not `unstable-native-tabs`: the brand tab bar needs Poppins labels
 * and Wazigo greens, which the native bars do not expose in SDK 57.
 */
export default function TabsLayout() {
  // The default bar is 49pt + the bottom inset, which clips the Poppins label
  // against the Android navigation bar. Size it ourselves and keep the inset
  // as padding so the tabs always sit above the system buttons.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.deepGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: Spacing.xs,
          paddingBottom: insets.bottom + Spacing.xs,
        },
        tabBarLabelStyle: [Typography.tab, { marginTop: Spacing.xxs }],
        tabBarItemStyle: { justifyContent: 'center' },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
