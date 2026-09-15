import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Colors, Layout, type ColorToken } from '@/constants/theme';

export type ScreenProps = {
  children: ReactNode;
  background?: ColorToken;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  statusBar?: 'dark' | 'light';
  contentStyle?: StyleProp<ViewStyle>;
};

/** Safe-area aware page container used by every screen. */
export function Screen({
  children,
  background = 'background',
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  statusBar = 'dark',
  contentStyle,
}: ScreenProps) {
  const inner = [padded && styles.padded, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: Colors[background] }]}>
      <StatusBar style={statusBar} />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.grow, inner]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  padded: { paddingHorizontal: Layout.screenPadding },
});
