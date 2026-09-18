import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ContactNote } from '@/api/types';
import { AppText } from '@/components/common';
import { Layout, Spacing } from '@/constants/theme';
import { formatListTimestamp } from '@/utils/datetime';

export type ContactNoteRowProps = { note: ContactNote };

/** CHAT-21. One internal note: who wrote it, when, and what it says. */
function ContactNoteRowComponent({ note }: ContactNoteRowProps) {
  const author = note.author?.trim();
  const when = formatListTimestamp(note.created_at);

  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.author}>
          {author || 'Someone on your team'}
        </AppText>
        {when ? (
          <AppText variant="caption" color="textMuted">
            {when}
          </AppText>
        ) : null}
      </View>
      <AppText variant="body">{note.body}</AppText>
    </View>
  );
}

export const ContactNoteRow = memo(ContactNoteRowComponent);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  author: { flex: 1 },
});
