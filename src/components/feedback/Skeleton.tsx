import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder block. Compose into screen-specific skeletons. */
export function Skeleton({ width = '100%', height = 14, radius = Radius.sm, style }: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: Colors.skeleton, opacity }, style]}
    />
  );
}

/** One chat-list row placeholder (avatar + two lines + time). */
export function ChatRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={styles.lines}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="80%" height={12} />
      </View>
      <Skeleton width={32} height={10} />
    </View>
  );
}

/** Screen-level wrapper announced once to screen readers. */
export function SkeletonList({ rows = 8 }: { rows?: number }) {
  return (
    <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <ChatRowSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  lines: { flex: 1, gap: Spacing.sm },
});
