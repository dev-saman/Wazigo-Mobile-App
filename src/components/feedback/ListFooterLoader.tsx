import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

/** Spinner under an infinite list while the next page loads. */
export function ListFooterLoader({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={Colors.primary} accessibilityLabel="Loading more conversations" />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: Spacing.xl, alignItems: 'center' },
});
