import { StyleSheet, View } from 'react-native';

import type { Message } from '@/api/types';
import { AppText, Sheet, SheetAction } from '@/components/common';
import { Colors, Spacing } from '@/constants/theme';
import { messageTimestamp, retryAbilityFor } from '@/features/messages';
import { formatIstDate, formatIstTime } from '@/utils/datetime';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Sending',
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

const Copy = {
  title: 'Message',
  retry: 'Try sending again',
  duplicate: 'The customer may receive this message twice.',
  fresh: 'This message never reached Wazigo, so it will be sent fresh.',
  automated: 'Sent automatically by the chatbot',
  blocked: 'This message cannot be sent again.',
};

export type MessageActionsSheetProps = {
  message: Message | null;
  visible: boolean;
  onClose: () => void;
  onRetry: (message: Message) => void;
  retrying?: boolean;
};

/**
 * What the design calls "Message Info", limited to what the API actually
 * returns: the Message resource carries **one** status and one timestamp, not a
 * sent/delivered/read timeline, so no per-state times are invented here.
 */
export function MessageActionsSheet({
  message,
  visible,
  onClose,
  onRetry,
  retrying = false,
}: MessageActionsSheetProps) {
  if (!message) return null;

  const ms = messageTimestamp(message);
  const status = (message.status && STATUS_LABELS[message.status]) || 'Unknown';
  const retry = retryAbilityFor(message);

  return (
    <Sheet visible={visible} title={Copy.title} onClose={onClose}>
      <View style={styles.rows}>
        <View style={styles.row}>
          <AppText variant="bodySmall" color="textSecondary">
            Status
          </AppText>
          <AppText variant="title">{status}</AppText>
        </View>

        {ms ? (
          <View style={[styles.row, styles.divided]}>
            <AppText variant="bodySmall" color="textSecondary">
              Time
            </AppText>
            <AppText variant="title">{`${formatIstDate(ms)}, ${formatIstTime(ms)}`}</AppText>
          </View>
        ) : null}

        {message.is_automated ? (
          <View style={[styles.row, styles.divided]}>
            <AppText variant="bodySmall" color="textSecondary">
              Origin
            </AppText>
            <AppText variant="title">{Copy.automated}</AppText>
          </View>
        ) : null}
      </View>

      {message.error_detail ? (
        <AppText variant="bodySmall" color="error" style={styles.detail}>
          {message.error_detail}
        </AppText>
      ) : null}

      {message.status === 'failed' ? (
        retry.available ? (
          <SheetAction
            icon="refresh"
            label={Copy.retry}
            description={retry.mayDuplicate ? Copy.duplicate : Copy.fresh}
            busy={retrying}
            onPress={() => onRetry(message)}
          />
        ) : (
          <AppText variant="bodySmall" color="textSecondary" style={styles.detail}>
            {retry.blockedReason || Copy.blocked}
          </AppText>
        )
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rows: { paddingBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider },
  detail: { paddingVertical: Spacing.sm },
});
