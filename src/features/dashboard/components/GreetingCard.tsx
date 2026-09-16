import { StyleSheet, View } from 'react-native';

import { AppText, BrandLogo, Card } from '@/components/common';
import { Spacing } from '@/constants/theme';
import { firstName, greetingForHour } from '@/utils/time';

export type GreetingCardProps = {
  name?: string | null;
  /** Injectable for tests; defaults to the device clock. */
  now?: Date;
};

/** "Good morning, Asha" over today's summary line (design screen 4). */
export function GreetingCard({ name, now = new Date() }: GreetingCardProps) {
  const greeting = greetingForHour(now.getHours());
  const who = firstName(name);

  return (
    <Card tone="primaryTint" style={styles.card}>
      <View style={styles.text}>
        <AppText variant="bodySmall" color="textSecondary">
          {`${greeting},`}
        </AppText>
        <AppText variant="h1" numberOfLines={2}>
          {who ? `${who}!` : 'Welcome back!'}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Here is what is happening today.
        </AppText>
      </View>
      <BrandLogo variant="iconGreen" width={52} style={styles.mark} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  text: { flex: 1 },
  subtitle: { marginTop: Spacing.xs },
  mark: { opacity: 0.9 },
});
