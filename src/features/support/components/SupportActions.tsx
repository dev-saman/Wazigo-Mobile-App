import { Pressable, StyleSheet, View } from 'react-native';

import type { SupportContact } from '@/api/types';
import { AppText, Button } from '@/components/common';
import { Spacing } from '@/constants/theme';

import { useSupportLinks } from '../useSupportLinks';

export const SupportActionsCopy = {
  chat: 'Chat with support on WhatsApp',
  emailPrefix: 'Or email us at',
  failed: 'We could not open WhatsApp on this phone.',
} as const;

/**
 * Super-admin Phase 4, on the suspended / deactivated screen. Same two ways to
 * reach Wazigo as the Settings row, laid out for a full-screen message: the
 * button is only rendered when Wazigo has set a support number, and the email
 * is the only contact detail shown as text.
 */
export function SupportActions({ support }: { support: SupportContact }) {
  const { openChat, openEmail, failed } = useSupportLinks(support);

  return (
    <View style={styles.container}>
      {support.chat_url ? (
        <Button
          title={SupportActionsCopy.chat}
          icon="logo-whatsapp"
          onPress={openChat}
          fullWidth={false}
          style={styles.button}
        />
      ) : null}

      {support.email ? (
        <Pressable
          onPress={openEmail}
          accessibilityRole="link"
          accessibilityLabel={`Email support at ${support.email}`}
          hitSlop={Spacing.sm}
        >
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {SupportActionsCopy.emailPrefix}{' '}
            <AppText variant="bodySmall" color="deepGreen">
              {support.email}
            </AppText>
          </AppText>
        </Pressable>
      ) : null}

      {failed ? (
        <AppText variant="caption" color="error" align="center">
          {SupportActionsCopy.failed}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.xxl },
  button: { minWidth: 240 },
});
