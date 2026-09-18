import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CannedMessage, Contact } from '@/api/types';
import { AppText, Badge } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { fillCannedBody } from '@/features/cannedMessages';

export type CannedReplyListItemProps = {
  reply: CannedMessage;
  /** Used to preview `{{contact.name}}` as the person will actually send it. */
  contact?: Contact | null;
  onPress: (reply: CannedMessage) => void;
};

function CannedReplyListItemComponent({ reply, contact, onPress }: CannedReplyListItemProps) {
  const title = reply.title?.trim() || `Reply ${reply.id}`;
  // Preview the filled text, not the raw `{{…}}`: what you see is what lands in
  // the composer.
  const preview = fillCannedBody(reply.body ?? '', contact).trim();
  const shortcut = reply.shortcut?.trim();

  return (
    <Pressable
      onPress={() => onPress(reply)}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Puts this reply in the message box"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.line}>
        <AppText variant="title" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {reply.scope === 'team' ? <Badge label="Team" tone="soft" /> : null}
      </View>

      {preview ? (
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
          {preview}
        </AppText>
      ) : null}

      {shortcut ? (
        <AppText variant="caption" color="textMuted">
          {shortcut.startsWith('/') ? shortcut : `/${shortcut}`}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export const CannedReplyListItem = memo(CannedReplyListItemComponent);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  pressed: { backgroundColor: Colors.grey50 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1 },
});
