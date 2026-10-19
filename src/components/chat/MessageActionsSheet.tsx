import { StyleSheet, View } from 'react-native';

import type { Message } from '@/api/types';
import { AppText, Sheet, SheetAction } from '@/components/common';
import { StateCopy } from '@/components/feedback';
import { Colors, Spacing } from '@/constants/theme';
import { messageErrorText, messageTimestamp, retryAbilityFor } from '@/features/messages';
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
  gap: 'The AI could not answer this',
  gapHint: 'Adds a to-do in the Knowledge Hub. The customer sees nothing.',
  gapMarked: 'Marked for the Knowledge Hub',
  gapMarkedHint: 'Someone will add an answer on the web.',
  automated: 'Sent automatically by the chatbot',
  blocked: 'This message cannot be sent again.',
};

export type MessageActionsSheetProps = {
  message: Message | null;
  visible: boolean;
  onClose: () => void;
  onRetry: (message: Message) => void;
  retrying?: boolean;
  /**
   * CHAT-34. Omitted unless the person has `knowledge.manage`. Offered only on
   * a customer's own message: the gap is a question the AI could not answer,
   * not something it said.
   */
  onKnowledgeGap?: (message: Message) => void;
  markingGap?: boolean;
  /** Already marked in this session, so the action says so instead of repeating. */
  gapMarked?: boolean;
  /** Retry is a request like any other: offline it is refused, not queued. */
  offline?: boolean;
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
  onKnowledgeGap,
  markingGap = false,
  gapMarked = false,
  offline = false,
}: MessageActionsSheetProps) {
  if (!message) return null;

  const ms = messageTimestamp(message);
  const status = (message.status && STATUS_LABELS[message.status]) || 'Unknown';
  const retry = retryAbilityFor(message);
  const errorText = messageErrorText(message.error_detail);

  const canRetry = message.status === 'failed' && retry.available;

  return (
    <Sheet
      visible={visible}
      title={Copy.title}
      onClose={onClose}
      notice={offline && canRetry ? StateCopy.offlineAction : undefined}
    >
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

      {errorText ? (
        <AppText variant="bodySmall" color="error" style={styles.detail}>
          {errorText}
        </AppText>
      ) : null}

      {message.status === 'failed' ? (
        retry.available ? (
          <SheetAction
            icon="refresh"
            label={Copy.retry}
            description={retry.mayDuplicate ? Copy.duplicate : Copy.fresh}
            busy={retrying}
            disabled={offline}
            onPress={() => onRetry(message)}
          />
        ) : (
          <AppText variant="bodySmall" color="textSecondary" style={styles.detail}>
            {retry.blockedReason || Copy.blocked}
          </AppText>
        )
      ) : null}

      {/* CHAT-34. It only adds a to-do in the web Knowledge Hub - nothing
          reaches the customer, and nothing the AI already said changes. */}
      {onKnowledgeGap && message.direction === 'inbound' ? (
        <SheetAction
          icon="help-buoy-outline"
          label={gapMarked ? Copy.gapMarked : Copy.gap}
          description={gapMarked ? Copy.gapMarkedHint : Copy.gapHint}
          busy={markingGap}
          disabled={offline || gapMarked}
          onPress={() => onKnowledgeGap(message)}
        />
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
