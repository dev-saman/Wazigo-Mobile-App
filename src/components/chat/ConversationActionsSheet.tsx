import { StyleSheet, View } from 'react-native';

import type { Conversation, ConversationPriority, Label } from '@/api/types';
import { AppText, Badge, Sheet, SheetAction } from '@/components/common';
import { Spacing } from '@/constants/theme';

const PRIORITY_LABELS: Record<ConversationPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

const Copy = {
  title: 'Conversation',
  resolve: 'Mark as resolved',
  resolveHint: 'The customer can still reply and reopen it.',
  reopen: 'Reopen conversation',
  reopenHint: 'Does not extend the 24-hour reply window.',
  priority: 'Priority',
  labels: 'Labels',
  takeOver: 'Take over from the chatbot',
  takeOverHint: 'Stops the automated replies in this conversation.',
  labelsNone: 'None',
};

export type ConversationActionsSheetProps = {
  visible: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onResolve: () => void;
  onReopen: () => void;
  onPriority: () => void;
  onLabels: () => void;
  onTakeOver: () => void;
  /** `conversations.tag`; priority and labels are hidden without it. */
  canTag: boolean;
  busy?: boolean;
};

/**
 * Design screen 10, with the actions the API actually has. Star, Mute, Archive,
 * Report and Block have no endpoints and are not shown as dead options.
 */
export function ConversationActionsSheet({
  visible,
  conversation,
  onClose,
  onResolve,
  onReopen,
  onPriority,
  onLabels,
  onTakeOver,
  canTag,
  busy = false,
}: ConversationActionsSheetProps) {
  const resolved = conversation?.status === 'resolved';
  const labels = conversation?.labels ?? [];
  const priority = conversation?.priority ?? 'normal';
  // CHAT-18 only makes sense while a bot is actually handling the chat.
  const botActive = !!conversation?.chatbot?.session_id;

  return (
    <Sheet visible={visible} title={Copy.title} onClose={onClose}>
      {labels.length > 0 ? (
        <View style={styles.labels}>
          {labels.map((label: Label) => (
            <Badge key={label.id} label={label.name} tone="soft" />
          ))}
        </View>
      ) : null}

      {resolved ? (
        <SheetAction
          icon="refresh-circle-outline"
          label={Copy.reopen}
          description={Copy.reopenHint}
          onPress={onReopen}
          busy={busy}
        />
      ) : (
        <SheetAction
          icon="checkmark-circle-outline"
          label={Copy.resolve}
          description={Copy.resolveHint}
          onPress={onResolve}
          busy={busy}
        />
      )}

      {botActive ? (
        <SheetAction
          icon="hand-left-outline"
          label={Copy.takeOver}
          description={Copy.takeOverHint}
          onPress={onTakeOver}
          busy={busy}
        />
      ) : null}

      {canTag ? (
        <>
          <SheetAction
            icon="flag-outline"
            label={Copy.priority}
            description={PRIORITY_LABELS[priority]}
            onPress={onPriority}
          />
          <SheetAction
            icon="pricetags-outline"
            label={Copy.labels}
            description={
              labels.length > 0 ? labels.map((label) => label.name).join(', ') : Copy.labelsNone
            }
            onPress={onLabels}
          />
        </>
      ) : null}

      {conversation?.assigned_user?.name ? (
        <AppText variant="caption" color="textMuted" style={styles.assigned}>
          {`Assigned to ${conversation.assigned_user.name}`}
        </AppText>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.md },
  assigned: { paddingTop: Spacing.md },
});
