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

/** One list-row placeholder. `avatar` matches the chat list; without it, a plain row. */
export function ChatRowSkeleton({ avatar = true }: { avatar?: boolean }) {
  return (
    <View style={styles.row}>
      {avatar ? <Skeleton width={44} height={44} radius={22} /> : null}
      <View style={styles.lines}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="80%" height={12} />
      </View>
      {avatar ? <Skeleton width={32} height={10} /> : null}
    </View>
  );
}

export type SkeletonListProps = {
  rows?: number;
  /** False for rows without an avatar, e.g. the template list. */
  avatar?: boolean;
  /** What is loading, announced once instead of row by row. */
  label?: string;
};

/** Screen-level wrapper announced once to screen readers. */
export function SkeletonList({ rows = 8, avatar = true, label = 'Loading' }: SkeletonListProps) {
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <ChatRowSkeleton key={i} avatar={avatar} />
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
