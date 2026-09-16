import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common';
import { Colors, Spacing } from '@/constants/theme';

export type StatRowProps = {
  label: string;
  value: ReactNode;
  /** Draws a hairline above the row; use on every row but the first. */
  divided?: boolean;
};

/** Label on the left, figure on the right. Used inside the summary cards. */
export function StatRow({ label, value, divided = false }: StatRowProps) {
  return (
    <View style={[styles.row, divided && styles.divided]}>
      <AppText variant="bodySmall" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <AppText variant="title">{value}</AppText>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider },
  label: { flex: 1 },
});
