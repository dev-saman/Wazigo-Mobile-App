import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { SupportContact } from '@/api/types';
import { AppText, Card } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';

import { hasSupportContact } from '@/api/support';
import { useSupportLinks } from '../useSupportLinks';

export const SupportCopy = {
  section: 'Support',
  chat: 'Chat with support',
  chatHint: 'Opens WhatsApp with a message already written. Nothing is sent until you press send.',
  email: 'Email support',
  failed: 'We could not open that. You can reach us at the email above instead.',
  failedNoEmail: 'We could not open that on this phone.',
} as const;

/**
 * Super-admin Phase 4, on the Settings screen. The row appears only when Wazigo
 * has set a support number; the email is shown whenever there is one, and is
 * the only contact detail ever shown as text - the support number lives inside
 * the link and nowhere else.
 */
export function SupportCard({ support }: { support: SupportContact }) {
  const { openChat, openEmail, failed } = useSupportLinks(support);

  if (!hasSupportContact(support)) return null;

  return (
    <>
      <AppText variant="overline" color="textSecondary" style={styles.section}>
        {SupportCopy.section}
      </AppText>

      <Card>
        {support.chat_url ? (
          <Pressable
            onPress={openChat}
            accessibilityRole="button"
            accessibilityLabel={SupportCopy.chat}
            accessibilityHint={SupportCopy.chatHint}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="logo-whatsapp" size={22} color={Colors.primary} />
            <View style={styles.rowText}>
              <AppText variant="title">{SupportCopy.chat}</AppText>
              <AppText variant="caption" color="textSecondary">
                {SupportCopy.chatHint}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}

        {support.chat_url && support.email ? <View style={styles.divider} /> : null}

        {support.email ? (
          <Pressable
            onPress={openEmail}
            accessibilityRole="link"
            accessibilityLabel={`${SupportCopy.email}, ${support.email}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="mail-outline" size={22} color={Colors.textSecondary} />
            <View style={styles.rowText}>
              <AppText variant="title">{SupportCopy.email}</AppText>
              <AppText variant="caption" color="textSecondary">
                {support.email}
              </AppText>
            </View>
          </Pressable>
        ) : null}
      </Card>

      {failed ? (
        <AppText variant="caption" color="error">
          {support.email ? SupportCopy.failed : SupportCopy.failedNoEmail}
        </AppText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: Layout.minTouch,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: Spacing.xxs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
});
