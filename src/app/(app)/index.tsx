import { StyleSheet, View } from 'react-native';

import { Permissions } from '@/api/types';
import { AppText, Button, Card, Screen } from '@/components/common';
import { Colors, Spacing } from '@/constants/theme';
import { selectAuthStatus, selectCurrentUser } from '@/features/auth/authSelectors';
import { signOut } from '@/features/auth/authThunks';
import { selectPermissions, selectPrimaryNumber, selectRoles } from '@/features/bootstrap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

/**
 * Placeholder for the signed-in area. It lists what `/me/bootstrap` returned so
 * Stage 5 can be checked on a device; Stage 6 replaces it with the dashboard.
 */
export default function AppHome() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const status = useAppSelector(selectAuthStatus);
  const roles = useAppSelector(selectRoles);
  const permissions = useAppSelector(selectPermissions);
  const number = useAppSelector(selectPrimaryNumber);

  const rows: { label: string; value: string }[] = [
    { label: 'Roles', value: roles.length ? roles.join(', ') : 'None returned' },
    {
      label: 'WhatsApp number',
      value: number
        ? `${number.display_phone_number}${number.verified_name ? ` (${number.verified_name})` : ''}`
        : 'None returned',
    },
    { label: 'Permissions', value: `${permissions.length} granted` },
    {
      label: 'Can view chats',
      value: permissions.includes(Permissions.conversationsView) ? 'Yes' : 'No',
    },
    {
      label: 'Can view dashboard',
      value: permissions.includes(Permissions.dashboardView) ? 'Yes' : 'No',
    },
  ];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="h1" align="center">
          {user?.name ? `Signed in as ${user.name}` : 'Signed in'}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.note}>
          The dashboard and chats arrive in the next stages.
        </AppText>
      </View>

      <Card>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.rowDivided]}>
            <AppText variant="label" color="textSecondary">
              {row.label}
            </AppText>
            <AppText variant="title" style={styles.value} numberOfLines={2}>
              {row.value}
            </AppText>
          </View>
        ))}
      </Card>

      <Button
        title="Sign out"
        variant="outline"
        loading={status === 'signingOut'}
        onPress={() => void dispatch(signOut())}
        style={styles.action}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: Spacing.xxxl, marginBottom: Spacing.xxl },
  note: { marginTop: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider },
  value: { flex: 1, textAlign: 'right' },
  action: { marginTop: Spacing.xxl },
});
