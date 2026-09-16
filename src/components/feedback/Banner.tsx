import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, type IconName } from '@/components/common';
import { Colors, Radius, Spacing, type ColorToken } from '@/constants/theme';

type Tone = 'success' | 'error' | 'warning' | 'info';

const tones: Record<Tone, { bg: ColorToken; fg: ColorToken; icon: IconName }> = {
  success: { bg: 'primarySoft', fg: 'deepGreen', icon: 'time-outline' },
  error: { bg: 'errorSoft', fg: 'error', icon: 'alert-circle-outline' },
  warning: { bg: 'warningSoft', fg: 'warning', icon: 'warning-outline' },
  info: { bg: 'infoSoft', fg: 'info', icon: 'information-circle-outline' },
};

export type BannerProps = {
  title: string;
  description?: string;
  tone?: Tone;
  icon?: IconName;
  action?: ReactNode;
};

/** Inline status strip, e.g. the 24-hour reply-window notice. */
export function Banner({ title, description, tone = 'info', icon, action }: BannerProps) {
  const t = tones[tone];
  return (
    <View
      style={[styles.base, { backgroundColor: Colors[t.bg] }]}
      accessible
      accessibilityRole="summary"
      // A banner appears in reaction to something; screen readers should say so.
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={icon ?? t.icon} size={22} color={Colors[t.fg]} />
      <View style={styles.text}>
        <AppText variant="label" color={t.fg}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="caption" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  text: { flex: 1, gap: Spacing.xxs },
});
