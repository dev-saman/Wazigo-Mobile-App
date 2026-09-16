import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Button } from '@/components/common';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { formatWindowRemaining, type ReplyWindow } from '@/features/conversations';

const Copy = {
  openTitle: 'Customer can reply',
  openDetail: (remaining: string) => `You have ${remaining} left to reply freely.`,
  closedTitle: '24-hour reply window closed',
  closedDetail: 'You can only send approved templates at this time.',
  chooseTemplate: 'Choose Template',
  noPermission: 'Ask an administrator for permission to send templates.',
};

export type ReplyWindowBannerProps = {
  window: ReplyWindow;
  /** Omitted when the user lacks `templates.send`. */
  onChooseTemplate?: () => void;
};

/**
 * Design screens 6 and 7. The remaining time comes from the server's
 * `window_expires_at`; this only formats it.
 */
export function ReplyWindowBanner({ window, onChooseTemplate }: ReplyWindowBannerProps) {
  if (window.state === 'unknown') return null;

  if (window.state === 'open') {
    return (
      <View style={[styles.banner, styles.open]} accessible accessibilityRole="summary">
        <Ionicons name="time-outline" size={20} color={Colors.deepGreen} />
        <View style={styles.text}>
          <AppText variant="label" color="deepGreen">
            {Copy.openTitle}
          </AppText>
          {window.secondsLeft > 0 ? (
            <AppText variant="caption" color="textSecondary">
              {Copy.openDetail(formatWindowRemaining(window.secondsLeft))}
            </AppText>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.closed]}>
      <View style={styles.row}>
        <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
        <View style={styles.text}>
          <AppText variant="label" color="error">
            {Copy.closedTitle}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {onChooseTemplate ? Copy.closedDetail : `${Copy.closedDetail} ${Copy.noPermission}`}
          </AppText>
        </View>
      </View>

      {onChooseTemplate ? (
        <Button
          title={Copy.chooseTemplate}
          icon="duplicate-outline"
          onPress={onChooseTemplate}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  open: { backgroundColor: Colors.primarySoft, flexDirection: 'row', alignItems: 'center' },
  closed: { backgroundColor: Colors.errorSoft },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  text: { flex: 1, gap: Spacing.xxs },
  action: { marginTop: Spacing.xs },
});
