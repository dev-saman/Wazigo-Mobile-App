import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { OfflineNotice } from '@/components/feedback/OfflineNotice';
import { Colors, Layout, type ColorToken } from '@/constants/theme';

export type ScreenProps = {
  children: ReactNode;
  background?: ColorToken;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  statusBar?: 'dark' | 'light';
  /** Hides the global offline strip (only for a screen that is itself offline copy). */
  offlineNotice?: boolean;
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
  offlineNotice = true,
  contentStyle,
}: ScreenProps) {
  const inner = [padded && styles.padded, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: Colors[background] }]}>
      <StatusBar style={statusBar} />
      {/* One strip for the whole app: every screen is inside a Screen, so the
          device being offline is reported once and never per screen. */}
      {offlineNotice ? <OfflineNotice /> : null}
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
