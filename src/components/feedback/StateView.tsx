import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, BrandLogo, Button, type IconName } from '@/components/common';
import { Colors, Layout, Spacing, type ColorToken } from '@/constants/theme';

type Tone = 'brand' | 'neutral' | 'error';

const tones: Record<Tone, { circle: ColorToken; icon: ColorToken }> = {
  brand: { circle: 'primarySoft', icon: 'deepGreen' },
  neutral: { circle: 'grey100', icon: 'grey600' },
  error: { circle: 'errorSoft', icon: 'error' },
};

export type StateViewProps = {
  title: string;
  description?: string;
  /** Ionicon inside the illustration circle. Ignored when `brandMark` is set. */
  icon?: IconName;
  /** Use the official Wazigo mark instead of an icon. */
  brandMark?: boolean;
  tone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
  /** Explicit screen-reader label for the action, e.g. "Retry loading your chats". */
  actionAccessibilityLabel?: string;
  actionLoading?: boolean;
  actionVariant?: 'primary' | 'dark' | 'secondary';
  footer?: ReactNode;
};

/**
 * Centred illustration + message + optional action. Shared by the empty,
 * offline, session-expired and access-denied screens.
 */
export function StateView({
  title,
  description,
  icon = 'information-circle-outline',
  brandMark = false,
  tone = 'brand',
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  actionLoading,
  actionVariant = 'primary',
  footer,
}: StateViewProps) {
  const colors = tones[tone];

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.circle, { backgroundColor: Colors[colors.circle] }]}>
        {brandMark ? (
          <BrandLogo variant="iconGreen" width={56} />
        ) : (
          <Ionicons name={icon} size={48} color={Colors[colors.icon]} accessibilityElementsHidden />
        )}
      </View>

      <AppText variant="h2" align="center" accessibilityRole="header">
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.description}>
          {description}
        </AppText>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          accessibilityLabel={actionAccessibilityLabel}
          loading={actionLoading}
          variant={actionVariant}
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.huge,
    alignSelf: 'center',
    width: '100%',
    maxWidth: Layout.maxContentWidth,
  },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  description: { marginTop: Spacing.sm, maxWidth: 300 },
  action: { marginTop: Spacing.xxl, minWidth: 180 },
});
