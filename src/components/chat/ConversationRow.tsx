import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { Conversation, MessageType } from '@/api/types';
import { AppText, Avatar, Badge, type IconName } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { formatIstDate, formatIstTime, formatListTimestamp, parseServerDate } from '@/utils/datetime';
import { formatPhoneForDisplay } from '@/utils/phone';

import { MessageTick } from './MessageTick';

/** Media messages have no text to preview, so they are named instead. */
const MEDIA_PREVIEWS: Partial<Record<MessageType, { icon: IconName; label: string }>> = {
  image: { icon: 'image-outline', label: 'Photo' },
  video: { icon: 'videocam-outline', label: 'Video' },
  audio: { icon: 'mic-outline', label: 'Voice message' },
  document: { icon: 'document-outline', label: 'Document' },
  template: { icon: 'duplicate-outline', label: 'Template message' },
};

const PRIORITY_BADGES = {
  urgent: { label: 'Urgent', tone: 'error' },
  high: { label: 'High', tone: 'warning' },
} as const;

const displayName = (conversation: Conversation) => {
  const contact = conversation.contact;
  const name = contact?.name?.trim();
  if (name) return name;
  const phone = contact?.phone ?? contact?.wa_id;
  return phone ? formatPhoneForDisplay(phone) : 'Unknown contact';
};

export type ConversationRowProps = {
  conversation: Conversation;
  onPress?: (conversation: Conversation) => void;
};

function ConversationRowComponent({ conversation, onPress }: ConversationRowProps) {
  const name = displayName(conversation);
  const last = conversation.last_message;
  const media = last?.type ? MEDIA_PREVIEWS[last.type] : undefined;
  const preview = last?.preview?.trim() || media?.label || (last ? 'Message' : 'No messages yet');
  const unread = conversation.unread_count > 0;
  const priority =
    conversation.priority === 'urgent' || conversation.priority === 'high'
      ? PRIORITY_BADGES[conversation.priority]
      : null;

  const timestampMs = parseServerDate(conversation.last_message_at);
  const stamp = formatListTimestamp(conversation.last_message_at);
  // "3h" is unreadable to a screen reader; give it the real date and time.
  const stampLabel = timestampMs ? `${formatIstDate(timestampMs)} at ${formatIstTime(timestampMs)}` : '';

  // Only worth flagging on a live chat: a resolved one is not waiting on a reply.
  const windowClosed = conversation.status === 'open' && conversation.window_open === false;

  const label = `${name}. ${preview}.${unread ? ` ${conversation.unread_count} unread.` : ''}`;
  const hint = stampLabel ? `Last message ${stampLabel}` : undefined;

  // Until the thread screen exists (Stage 8) a row is not a button, so screen
  // readers do not offer an action that goes nowhere.
  const Container = onPress ? Pressable : View;
  const containerProps = onPress
    ? {
        onPress: () => onPress(conversation),
        accessibilityRole: 'button' as const,
        accessibilityLabel: label,
        accessibilityHint: hint,
        style: ({ pressed }: { pressed: boolean }) => [styles.row, pressed && styles.pressed],
      }
    : { accessible: true, accessibilityLabel: label, accessibilityHint: hint, style: styles.row };

  return (
    <Container {...containerProps}>
      <Avatar name={name} size={48} />

      <View style={styles.body}>
        <View style={styles.line}>
          <AppText variant="title" numberOfLines={1} style={styles.name}>
            {name}
          </AppText>
          {priority ? <Badge label={priority.label} tone={priority.tone} /> : null}
          <AppText variant="caption" color={unread ? 'deepGreen' : 'textMuted'}>
            {stamp}
          </AppText>
        </View>

        <View style={styles.line}>
          {last?.direction === 'outbound' ? <MessageTick status={last.status} /> : null}
          {media ? (
            <Ionicons name={media.icon} size={14} color={Colors.textMuted} accessibilityElementsHidden />
          ) : null}
          <AppText
            variant="bodySmall"
            color={unread ? 'textPrimary' : 'textSecondary'}
            numberOfLines={1}
            style={styles.preview}
          >
            {preview}
          </AppText>
          {windowClosed ? (
            <Ionicons
              name="time-outline"
              size={14}
              color={Colors.textMuted}
              accessibilityLabel="Reply window closed"
            />
          ) : null}
          {unread ? (
            <Badge
              label={conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              accessibilityLabel={`${conversation.unread_count} unread messages`}
            />
          ) : null}
        </View>
      </View>
    </Container>
  );
}

export const ConversationRow = memo(ConversationRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Layout.screenPadding,
    minHeight: Layout.touchComfortable + Spacing.lg,
  },
  pressed: { backgroundColor: Colors.grey50 },
  body: { flex: 1, gap: Spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flex: 1 },
  preview: { flex: 1 },
});
