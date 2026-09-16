import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BrandLogo, IconButton } from '@/components/common';
import { Spacing } from '@/constants/theme';
import { selectAuthStatus } from '@/features/auth/authSelectors';
import { signOut } from '@/features/auth/authThunks';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  signOut: 'Sign out',
  confirmTitle: 'Sign out?',
  confirmBody: 'You will need your phone number and a new code to sign back in.',
  cancel: 'Cancel',
};

/** Wordmark on the left, sign-out on the right (design screen 4). */
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
      <IconButton
        icon="log-out-outline"
        accessibilityLabel={Copy.signOut}
        color="textSecondary"
        disabled={authStatus === 'signingOut'}
        onPress={confirmSignOut}
      />
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
});
