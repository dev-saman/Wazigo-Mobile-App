import { StyleSheet, View } from 'react-native';

import { AppText, BrandLogo, Card } from '@/components/common';
import { Spacing } from '@/constants/theme';
import { firstName, greetingForHour } from '@/utils/time';

export type GreetingCardProps = {
  name?: string | null;
  /** Injectable for tests; defaults to the device clock. */
  now?: Date;
};

/**
 * Design screen 4: "Good morning," and the agent's name over today's summary
 * line, with a large pale Wazigo mark watermarked behind the right edge.
 */
export function GreetingCard({ name, now = new Date() }: GreetingCardProps) {
  const greeting = greetingForHour(now.getHours());
  const who = firstName(name);
  const headline = who ? `${who}!` : 'Welcome back!';

  return (
    <Card tone="primaryTint" style={styles.card}>
      {/* Decoration only: cropped by the card edge and hidden from screen readers. */}
      <View style={styles.watermark} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <BrandLogo variant="iconGreen" width={120} />
      </View>

      <View style={styles.text}>
        <AppText variant="label">{`${greeting},`}</AppText>
        {/* The wave is visual; screen readers hear just the greeting. */}
        <AppText variant="display" numberOfLines={2} accessibilityLabel={headline}>
          {`${headline} 👋`}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          {"Here's what's happening today."}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', paddingVertical: Spacing.xl },
  watermark: { position: 'absolute', right: -Spacing.xl, top: -Spacing.sm, opacity: 0.12 },
  // Narrow enough that the subtitle wraps onto two lines, clear of the watermark.
  text: { maxWidth: '68%' },
  subtitle: { marginTop: Spacing.xs, maxWidth: 170 },
});
