import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { Colors, Spacing, Typography } from '@/constants/theme';

/**
 * Mobile v1 has two tabs: Home and Chats. The design's Templates and More tabs
 * are out of phase-1 scope (templates are reached from inside a conversation).
 *
 * JS tabs, not `unstable-native-tabs`: the brand tab bar needs Poppins labels
 * and Wazigo greens, which the native bars do not expose in SDK 57.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.deepGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarLabelStyle: Typography.tab,
        tabBarItemStyle: { paddingTop: Spacing.xs },
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
