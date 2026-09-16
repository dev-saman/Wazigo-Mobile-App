import { StyleSheet, View } from 'react-native';

import type { Conversation } from '@/api/types';
import { AppText, Avatar, Badge, IconButton } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { contactDisplay } from '@/features/conversations/contactDisplay';

export type ThreadHeaderProps = {
  /** CHAT-02's `meta.conversation` when it has arrived, else the listed row. */
  conversation: Conversation | null;
  onBack: () => void;
  /** Opens the conversation actions sheet (design screen 10). */
  onActions?: () => void;
};

/**
 * Back, avatar, name and number. There is deliberately no call button (no
 * calling API) and no customer presence - the Conversation resource has no
 * such field, and inventing "Online" would be a lie about a real person.
 */
export function ThreadHeader({ conversation, onBack, onActions }: ThreadHeaderProps) {
  // Name, else the formatted number, else "Unknown Contact" - never a generic
  // "Conversation". The number is repeated underneath only when a name is shown.
  const contact = contactDisplay(conversation?.contact);
  const subtitle = contact.name ? contact.phone : null;
  const resolved = conversation?.status === 'resolved';

  return (
    <View style={styles.header}>
      <IconButton icon="chevron-back" accessibilityLabel="Back to chats" onPress={onBack} />
      <Avatar name={contact.name} size={40} />
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1} accessibilityRole="header">
          {contact.title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {resolved ? <Badge label="Resolved" tone="soft" /> : null}
      {onActions ? (
        <IconButton
          icon="ellipsis-vertical"
          accessibilityLabel="Conversation actions"
          color="textSecondary"
          onPress={onActions}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingRight: Layout.screenPadding,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  text: { flex: 1 },
});
