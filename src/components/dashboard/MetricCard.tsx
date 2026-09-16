import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Card, type IconName } from '@/components/common';
import { Colors, Radius, Spacing, type ColorToken } from '@/constants/theme';

export type MetricCardProps = {
  label: string;
  value: number | string;
  icon: IconName;
  /** Icon chip colours. Meaning is always carried by the label, never colour. */
  tone?: 'brand' | 'info' | 'warning' | 'neutral';
  hint?: string;
};

const tones: Record<NonNullable<MetricCardProps['tone']>, { bg: ColorToken; fg: ColorToken }> = {
  brand: { bg: 'primarySoft', fg: 'deepGreen' },
  info: { bg: 'infoSoft', fg: 'info' },
  warning: { bg: 'warningSoft', fg: 'warning' },
  neutral: { bg: 'grey100', fg: 'grey600' },
};

/** One number from the dashboard overview. */
export function MetricCard({ label, value, icon, tone = 'brand', hint }: MetricCardProps) {
  const palette = tones[tone];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.chip, { backgroundColor: Colors[palette.bg] }]}>
          <Ionicons name={icon} size={18} color={Colors[palette.fg]} />
        </View>
      </View>
      <AppText variant="metric" accessibilityLabel={`${value} ${label}`}>
        {value}
      </AppText>
      <AppText variant="caption" color="textSecondary" numberOfLines={2}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" color="textMuted" numberOfLines={2} style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: Spacing.xs, minWidth: 140 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  hint: { marginTop: Spacing.xxs },
});
