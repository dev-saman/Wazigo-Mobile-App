import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatIstDate, istDayStart } from '@/utils/datetime';

/** "Today" and "Yesterday" are relative to the Indian day, not the device's. */
export function dayLabel(ms: number, now = Date.now()): string {
  const day = istDayStart(ms);
  const today = istDayStart(now);
  if (day === today) return 'Today';
  if (day === today - 24 * 60 * 60 * 1000) return 'Yesterday';
  return formatIstDate(ms, now);
}

export function DaySeparator({ ms }: { ms: number }) {
  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <AppText variant="caption" color="textSecondary">
          {dayLabel(ms)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: Spacing.md },
  pill: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
