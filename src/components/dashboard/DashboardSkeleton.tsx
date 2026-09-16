import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/common';
import { Skeleton } from '@/components/feedback';
import { Radius, Spacing } from '@/constants/theme';

/** Mirrors the dashboard layout so nothing jumps when the numbers arrive. */
export function DashboardSkeleton() {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your dashboard"
    >
      <Card tone="primaryTint">
        <Skeleton width="45%" height={12} />
        <Skeleton width="65%" height={20} style={styles.gap} />
      </Card>

      <View style={styles.grid}>
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} style={styles.metric}>
            <Skeleton width={36} height={36} radius={Radius.sm} />
            <Skeleton width="40%" height={22} style={styles.gap} />
            <Skeleton width="70%" height={12} style={styles.gapSmall} />
          </Card>
        ))}
      </View>

      <Card>
        <Skeleton width="50%" height={14} />
        <Skeleton width="100%" height={12} style={styles.gap} />
        <Skeleton width="80%" height={12} style={styles.gapSmall} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metric: { flexGrow: 1, flexBasis: '45%', minWidth: 140 },
  gap: { marginTop: Spacing.md },
  gapSmall: { marginTop: Spacing.sm },
});
