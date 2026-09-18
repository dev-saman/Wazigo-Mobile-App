import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';

import { BrandLogo, IconButton } from '@/components/common';
import { Spacing } from '@/constants/theme';
import { selectAuthStatus } from '@/features/auth/authSelectors';
import { signOut } from '@/features/auth/authThunks';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  settings: 'Settings',
  signOut: 'Sign out',
  confirmTitle: 'Sign out?',
  confirmBody: 'You will need your phone number and a new code to sign back in.',
  cancel: 'Cancel',
};

/**
 * Wordmark on the left, settings and sign-out on the right (design screen 4).
 *
 * Settings lives here rather than in a third tab: the API reference maps only
 * Home and Chats to mobile tabs.
 */
export function DashboardHeader() {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector(selectAuthStatus);
  // Design screen 4: the wordmark spans about a third of the width.
  const { width } = useWindowDimensions();
  const wordmarkWidth = Math.min(150, Math.max(120, Math.round(width * 0.34)));

  const confirmSignOut = () => {
    Alert.alert(Copy.confirmTitle, Copy.confirmBody, [
      { text: Copy.cancel, style: 'cancel' },
      { text: Copy.signOut, style: 'destructive', onPress: () => void dispatch(signOut()) },
    ]);
  };

  return (
    <View style={styles.header}>
      <BrandLogo variant="logoDark" width={wordmarkWidth} />
      <View style={styles.actions}>
        <IconButton
          icon="settings-outline"
          accessibilityLabel={Copy.settings}
          color="textSecondary"
          onPress={() => router.push('/settings')}
        />
        <IconButton
          icon="log-out-outline"
          accessibilityLabel={Copy.signOut}
          color="textSecondary"
          disabled={authStatus === 'signingOut'}
          onPress={confirmSignOut}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
