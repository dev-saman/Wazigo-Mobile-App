import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/common';
import { Spacing } from '@/constants/theme';
import { selectAuthStatus, selectCurrentUser } from '@/features/auth/authSelectors';
import { signOut } from '@/features/auth/authThunks';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

/**
 * Placeholder for the signed-in area so the Stage 4 login flow has somewhere to
 * land. Stage 5 adds `/me/bootstrap` and permissions; Stage 6 replaces this
 * screen with the dashboard.
 */
export default function AppHome() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const status = useAppSelector(selectAuthStatus);

  return (
    <Screen>
      <View style={styles.container}>
        <AppText variant="h1" align="center">
          {user?.name ? `Signed in as ${user.name}` : 'Signed in'}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.note}>
          The dashboard and chats arrive in the next stages.
        </AppText>
        <Button
          title="Sign out"
          variant="outline"
          fullWidth={false}
          loading={status === 'signingOut'}
          onPress={() => void dispatch(signOut())}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: Spacing.sm },
  action: { marginTop: Spacing.xxl, minWidth: 180 },
});
