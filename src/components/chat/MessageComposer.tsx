import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { MessageLimits } from '@/api/types';
import { AppText, IconButton } from '@/components/common';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';

/** Warn before the limit rather than at it. */
const COUNTER_FROM = MessageLimits.textMax - 200;

/** About five lines; longer drafts scroll inside the box. */
const MAX_INPUT_HEIGHT = 120;

export type MessageComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
  /** Blocks send while a message is still going out, or while offline. */
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
};

/**
 * The send box. It stays enabled whenever the user may send: the 24-hour reply
 * window and templates arrive in Stage 10, and until then the API is the one
 * that decides what WhatsApp will accept.
 */
export function MessageComposer({
  value,
  onChangeText,
  onSend,
  onAttach,
  disabled = false,
  sending = false,
  placeholder = 'Type a message',
}: MessageComposerProps) {
  const [height, setHeight] = useState(0);
  // Forget the old measurement once the draft is cleared, so the next short
  // message does not start from a long one's height.
  if (value.length === 0 && height !== 0) setHeight(0);
  // An empty box is always one line. The measured height is only reported when
  // the content changes size, and clearing the draft after a long message did
  // not reliably report the shrink - the empty box stayed at full height.
  const inputHeight =
    value.length === 0 ? Layout.minTouch : Math.min(MAX_INPUT_HEIGHT, Math.max(Layout.minTouch, height));
  const length = value.trim().length;
  const tooLong = length > MessageLimits.textMax;
  const canSend = length > 0 && !tooLong && !disabled && !sending;

  return (
    <View style={styles.container}>
      {length >= COUNTER_FROM ? (
        <AppText variant="caption" color={tooLong ? 'error' : 'textMuted'} style={styles.counter}>
          {`${length} / ${MessageLimits.textMax}`}
        </AppText>
      ) : null}

      <View style={styles.row}>
        <IconButton
          icon="attach"
          accessibilityLabel="Add an attachment"
          color="textSecondary"
          onPress={onAttach}
          disabled={disabled || sending}
        />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textPlaceholder}
          multiline
          editable={!disabled}
          accessibilityLabel="Message"
          onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
          style={[styles.input, { height: inputHeight }, tooLong && styles.inputError]}
        />

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={[styles.send, !canSend && styles.sendDisabled]}
        >
          <Ionicons name="send" size={18} color={Colors.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  counter: { textAlign: 'right', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  input: {
    flex: 1,
    ...Typography.message,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    textAlignVertical: 'center',
  },
  inputError: { borderColor: Colors.error },
  send: {
    width: Layout.minTouch,
    height: Layout.minTouch,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: Colors.disabledBackground },
});
