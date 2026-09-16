import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { Message, MessageType } from '@/api/types';
import { AppText, type IconName } from '@/components/common';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { messageTimestamp } from '@/features/messages/threadRows';
import { formatIstTime } from '@/utils/datetime';

import { MessageTick } from './MessageTick';

const MEDIA: Partial<Record<MessageType, { icon: IconName; label: string }>> = {
  image: { icon: 'image-outline', label: 'Photo' },
  video: { icon: 'videocam-outline', label: 'Video' },
  audio: { icon: 'mic-outline', label: 'Voice message' },
  document: { icon: 'document-outline', label: 'Document' },
};

export type MessageBubbleProps = {
  message: Message;
};

function MessageBubbleComponent({ message }: MessageBubbleProps) {
  const outbound = message.direction === 'outbound';
  const media = MEDIA[message.type];
  const body = message.text_body?.trim() || message.caption?.trim() || '';
  const ms = messageTimestamp(message);
  const time = ms ? formatIstTime(ms) : '';
  const failed = message.status === 'failed';

  return (
    <View style={[styles.row, outbound ? styles.rowOutbound : styles.rowInbound]}>
      <View
        style={[
          styles.bubble,
          outbound ? styles.bubbleOutbound : styles.bubbleInbound,
          failed && styles.bubbleFailed,
        ]}
      >
        {media ? (
          <View style={styles.media}>
            <Ionicons name={media.icon} size={18} color={Colors.textSecondary} />
            <AppText variant="bodySmall" color="textSecondary">
              {message.media?.filename?.trim() || media.label}
            </AppText>
          </View>
        ) : null}

        {body ? (
          <AppText variant="message">{body}</AppText>
        ) : media ? null : (
          <AppText variant="message" color="textMuted">
            {message.type === 'template' ? 'Template message' : 'Unsupported message'}
          </AppText>
        )}

        <View style={styles.footer}>
          {message.is_automated ? (
            <AppText variant="caption" color="textMuted">
              Automated
            </AppText>
          ) : null}
          <AppText variant="caption" color="textMuted">
            {time}
          </AppText>
          {outbound ? <MessageTick status={message.status} size={13} /> : null}
        </View>

        {failed && message.error_detail ? (
          <AppText variant="caption" color="error" style={styles.error}>
            {message.error_detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, flexDirection: 'row' },
  rowInbound: { justifyContent: 'flex-start' },
  rowOutbound: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  bubbleInbound: {
    backgroundColor: Colors.bubbleInbound,
    borderTopLeftRadius: Radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  bubbleOutbound: { backgroundColor: Colors.bubbleOutbound, borderTopRightRadius: Radius.xs },
  bubbleFailed: { borderWidth: 1, borderColor: Colors.errorBorder },
  media: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.xs },
  error: { marginTop: Spacing.xxs },
});
