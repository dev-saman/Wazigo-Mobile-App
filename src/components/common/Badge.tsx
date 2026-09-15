import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing, type ColorToken } from '@/constants/theme';

import { AppText } from './AppText';

type Tone = 'primary' | 'neutral' | 'error' | 'warning' | 'info' | 'soft';

const tones: Record<Tone, { bg: ColorToken; fg: ColorToken }> = {
  primary: { bg: 'primary', fg: 'textOnPrimary' },
  soft: { bg: 'primarySoft', fg: 'deepGreen' },
  neutral: { bg: 'grey100', fg: 'textSecondary' },
  error: { bg: 'errorSoft', fg: 'error' },
  warning: { bg: 'warningSoft', fg: 'warning' },
  info: { bg: 'infoSoft', fg: 'info' },
};

export type BadgeProps = {
  label: string | number;
  tone?: Tone;
  accessibilityLabel?: string;
};

/** Counter or short status pill. Always carries text, never colour alone. */
export function Badge({ label, tone = 'primary', accessibilityLabel }: BadgeProps) {
  const { bg, fg } = tones[tone];
  return (
    <View
      style={[styles.base, { backgroundColor: Colors[bg] }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? String(label)}
    >
      <AppText variant="captionMedium" color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.xs + 2,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
