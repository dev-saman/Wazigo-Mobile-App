import { StyleSheet, View, type DimensionValue } from 'react-native';

import { Skeleton } from '@/components/feedback';
import { Layout, Radius, Spacing } from '@/constants/theme';

/** Uneven on purpose: real conversations are not a column of equal blocks. */
const BUBBLES: { outbound: boolean; width: DimensionValue; height: number }[] = [
  { outbound: false, width: '64%', height: 52 },
  { outbound: true, width: '48%', height: 36 },
  { outbound: false, width: '72%', height: 68 },
  { outbound: true, width: '58%', height: 44 },
  { outbound: false, width: '40%', height: 36 },
];

/** Bubble-shaped placeholders, so a thread does not jump when the first page lands. */
export function ThreadSkeleton() {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading this conversation"
    >
      {BUBBLES.map((bubble, index) => (
        <View key={index} style={[styles.row, bubble.outbound && styles.outbound]}>
          <Skeleton width={bubble.width} height={bubble.height} radius={Radius.lg} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.md,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.lg,
  },
  row: { alignItems: 'flex-start' },
  outbound: { alignItems: 'flex-end' },
});
