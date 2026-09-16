import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Card, type IconName } from '@/components/common';
import { Colors, Spacing, type ColorToken } from '@/constants/theme';

export type MetricCardProps = {
  label: string;
  value: number | string;
  icon: IconName;
  /** Icon colour. Meaning is always carried by the label, never colour. */
  tone?: 'brand' | 'info' | 'warning' | 'neutral';
  /** Extra explanation, given to screen readers; the compact card has no room to show it. */
  hint?: string;
};

const tones: Record<NonNullable<MetricCardProps['tone']>, ColorToken> = {
  brand: 'primary',
  info: 'info',
  warning: 'warning',
  neutral: 'grey600',
};

/**
 * One number from the dashboard overview, in the compact form of design
 * screen 4: coloured icon on the left, the number with its label beneath.
 */
export function MetricCard({ label, value, icon, tone = 'brand', hint }: MetricCardProps) {
  return (
    <Card elevated style={styles.card}>
      <View style={styles.row} accessible accessibilityLabel={`${value} ${label}${hint ? `. ${hint}` : ''}`}>
        <Ionicons name={icon} size={24} color={Colors[tones[tone]]} />
        <View style={styles.text}>
          <AppText variant="metric" numberOfLines={1}>
            {value}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={2}>
            {label}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 140, paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  text: { flex: 1 },
});
