import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Message } from '@/api/types';
import { AppText } from '@/components/common';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { messageErrorText } from '@/features/messages/messageError';
import { messageTimestamp } from '@/features/messages/threadRows';
import { formatIstTime } from '@/utils/datetime';

import { MediaAttachment } from './MediaAttachment';
import { MessageTick } from './MessageTick';

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document']);

export type MessageBubbleProps = {
  message: Message;
  conversationId: string;
  /** 0-1 while this message's file is uploading. */
  progress?: number;
  /** Long-press anywhere, or tap a failed message, to open its actions. */
  onOpenActions?: (message: Message) => void;
};

function MessageBubbleComponent({
  message,
  conversationId,
  progress,
  onOpenActions,
}: MessageBubbleProps) {
  const outbound = message.direction === 'outbound';
  const media = MEDIA_TYPES.has(message.type);
  const body = message.text_body?.trim() || message.caption?.trim() || '';
  const ms = messageTimestamp(message);
  const time = ms ? formatIstTime(ms) : '';
  const failed = message.status === 'failed';
  const errorText = failed ? messageErrorText(message.error_detail) : null;

  const bubbleStyle = [
    styles.bubble,
    outbound ? styles.bubbleOutbound : styles.bubbleInbound,
    failed && styles.bubbleFailed,
  ];

  return (
    <View style={[styles.row, outbound ? styles.rowOutbound : styles.rowInbound]}>
      <Pressable
        onLongPress={onOpenActions ? () => onOpenActions(message) : undefined}
        // A failed message is the one people want to act on, so a plain tap
        // opens its actions too.
        onPress={onOpenActions && failed ? () => onOpenActions(message) : undefined}
        accessibilityRole={onOpenActions ? 'button' : undefined}
        accessibilityHint={onOpenActions ? 'Opens message details' : undefined}
        style={bubbleStyle}
      >
        {media ? <MediaAttachment message={message} conversationId={conversationId} /> : null}

        {progress !== undefined && progress < 1 ? (
          <View
            style={styles.progressTrack}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Uploading, ${Math.round(progress * 100)} percent`}
          >
            <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
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

        {errorText ? (
          <AppText variant="caption" color="error" style={styles.error}>
            {errorText}
          </AppText>
        ) : null}
      </Pressable>
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
  progressTrack: {
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.grey200,
    overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: Colors.primary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.xs },
  error: { marginTop: Spacing.xxs },
});
