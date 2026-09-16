import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type ListFooterLoaderProps = {
  visible: boolean;
  /** What is loading, for screen readers — this footer is not only used by lists. */
  label?: string;
};

/** Spinner under an infinite list while the next page loads. */
export function ListFooterLoader({ visible, label = 'Loading more' }: ListFooterLoaderProps) {
  if (!visible) return null;
  return (
    <View style={styles.footer} accessibilityLiveRegion="polite">
      <ActivityIndicator color={Colors.primary} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: Spacing.xl, alignItems: 'center' },
});
