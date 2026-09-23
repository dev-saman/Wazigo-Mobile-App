import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';

import type { UpdatePreferencesPayload } from '@/api/types';
import { AppText, Card, IconButton, Screen } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { selectCurrentUser } from '@/features/auth/authSelectors';
import { selectSupport } from '@/features/bootstrap';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { updateNotificationPreferences } from '@/features/preferences';
import { SupportCard } from '@/features/support';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { traceWriteIntent } from '@/utils/devTrace';

const Copy = {
  title: 'Settings',
  back: 'Back',
  notifications: 'Notifications',
  mute: 'Pause notifications',
  muteHint:
    'Stops new-message notifications on every phone you are signed in on, and silences the bell in the Wazigo dashboard.',
  sound: 'Notification sound',
  soundHint: 'Turn off to receive notifications silently.',
  offline: 'You need an internet connection to change this.',
  failed: 'That change was not saved. Try again.',
  account: 'Account',
};

/**
 * AUTH-11. Deliberately a route rather than a third tab: the API reference is
 * explicit that only Home and Chats become mobile tabs, and that the web menu
 * must not be turned into mobile navigation. Reached from the Home header.
 */
export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const offline = useAppSelector(selectIsOffline);
  // Phase 4: re-read on every bootstrap, so a support number changed in the
  // back office reaches the app without an app update.
  const support = useAppSelector(selectSupport);

  const [saving, setSaving] = useState<keyof UpdatePreferencesPayload | null>(null);
  const [failed, setFailed] = useState(false);

  const muted = user?.mute_notifications === true;
  // Stored as "muted", shown as "sound on": the switch reads the way a person
  // expects, and only the wire format is inverted.
  const soundOn = user?.mute_sound !== true;

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const save = useCallback(
    (field: keyof UpdatePreferencesPayload, value: boolean) => {
      if (offline) return;
      setSaving(field);
      setFailed(false);
      traceWriteIntent('notification preference changed', { field, value });
      void dispatch(updateNotificationPreferences({ [field]: value }))
        .unwrap()
        .catch(() => setFailed(true))
        .finally(() => setSaving(null));
    },
    [dispatch, offline],
  );

  const disabled = offline || saving !== null;

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" accessibilityLabel={Copy.back} onPress={goBack} />
        <AppText variant="h2" accessibilityRole="header" style={styles.headerTitle}>
          {Copy.title}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="overline" color="textSecondary">
          {Copy.notifications}
        </AppText>

        <Card>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText variant="title">{Copy.mute}</AppText>
              <AppText variant="caption" color="textSecondary">
                {Copy.muteHint}
              </AppText>
            </View>
            <Switch
              value={muted}
              onValueChange={(value) => save('mute_notifications', value)}
              disabled={disabled}
              accessibilityLabel={Copy.mute}
              accessibilityHint={Copy.muteHint}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText variant="title">{Copy.sound}</AppText>
              <AppText variant="caption" color="textSecondary">
                {Copy.soundHint}
              </AppText>
            </View>
            <Switch
              value={soundOn}
              // The API stores the mute, so an enabled sound is `mute_sound: false`.
              onValueChange={(value) => save('mute_sound', !value)}
              disabled={disabled || muted}
              accessibilityLabel={Copy.sound}
              accessibilityHint={Copy.soundHint}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>
        </Card>

        {offline ? (
          <AppText variant="caption" color="textMuted">
            {Copy.offline}
          </AppText>
        ) : null}
        {failed ? (
          <AppText variant="caption" color="error">
            {Copy.failed}
          </AppText>
        ) : null}

        {/* Phase 4. Renders nothing at all until Wazigo has set a support
            number or a support email. */}
        <SupportCard support={support} />

        {user?.name ? (
          <>
            <AppText variant="overline" color="textSecondary" style={styles.section}>
              {Copy.account}
            </AppText>
            <Card>
              <AppText variant="title">{user.name}</AppText>
              {user.phone ? (
                <AppText variant="bodySmall" color="textSecondary">
                  {user.phone}
                </AppText>
              ) : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { flex: 1 },
  content: {
    padding: Layout.screenPadding,
    paddingBottom: Spacing.huge,
    gap: Spacing.sm,
  },
  section: { paddingTop: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  rowText: { flex: 1, gap: Spacing.xxs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
});
