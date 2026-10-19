import { useCallback, useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Permissions, type ReportMetric } from '@/api/types';
import { AppText, Card, Screen } from '@/components/common';
import { DashboardSkeleton, MetricCard, StatRow } from '@/components/dashboard';
import { ErrorState, StaleDataBanner } from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { selectCurrentUser } from '@/features/auth/authSelectors';
import { RequirePermission, selectNumbers } from '@/features/bootstrap';
import { selectChatScope } from '@/features/conversations';
import { loadRecentConversations } from '@/features/dashboard';
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader';
import { GreetingCard } from '@/features/dashboard/components/GreetingCard';
import { RecentConversations } from '@/features/dashboard/components/RecentConversations';
import { useLiveRefresh } from '@/features/realtime';
import {
  loadAccountOverview,
  metricValue,
  selectOverview,
  selectOverviewDisabled,
  selectOverviewError,
  selectOverviewIsPartial,
  selectOverviewStatus,
} from '@/features/report';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  scopeAll: 'Across your account',
  scopePartial: 'Your numbers',
  open: 'Open chats',
  unread: 'Unread',
  unassigned: 'Unassigned',
  customers: 'Customers',
  period: 'This period',
  incoming: 'Received',
  delivered: 'Delivered',
  failed: 'Failed',
  attention: 'Needs attention',
  issues: 'Why messages failed',
  numbers: 'Your numbers',
  numbersHint: 'Open one for its day and what needs doing',
  failedTitle: 'We could not load your report',
  retryLabel: 'Retry loading your report',
  refreshFailed: 'Showing the last figures we loaded',
  disabled: 'The overview is switched off for this account.',
  notAvailable: 'Not available',
};

/** Snapshot keys REP-01 names, in the order the screen shows them. */
const SNAPSHOT: { key: string; label: string; icon: 'chatbubbles-outline' | 'mail-unread-outline' | 'person-add-outline' | 'people-outline' }[] = [
  { key: 'open_conversations', label: Copy.open, icon: 'chatbubbles-outline' },
  { key: 'unread_conversations', label: Copy.unread, icon: 'mail-unread-outline' },
  { key: 'unassigned_conversations', label: Copy.unassigned, icon: 'person-add-outline' },
  { key: 'customers', label: Copy.customers, icon: 'people-outline' },
];

const PERIOD: { key: string; label: string }[] = [
  { key: 'messages_incoming', label: Copy.incoming },
  { key: 'messages_delivered', label: Copy.delivered },
  { key: 'messages_failed', label: Copy.failed },
];

const find = (list: ReportMetric[] | undefined, key: string) =>
  list?.find((metric) => metric.key === key) ?? null;

function ReportScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const overview = useAppSelector(selectOverview);
  const status = useAppSelector(selectOverviewStatus);
  const error = useAppSelector(selectOverviewError);
  const disabled = useAppSelector(selectOverviewDisabled);
  const partial = useAppSelector(selectOverviewIsPartial);
  const numbers = useAppSelector(selectNumbers);
  const scope = useAppSelector(selectChatScope);

  // REP-01 answers about whatever the person has chosen in Chats, so the two
  // areas never disagree about which numbers they are describing.
  useEffect(() => {
    void dispatch(loadAccountOverview());
    void dispatch(loadRecentConversations());
  }, [dispatch, scope]);

  // Foreground, reconnect and the socket fallback all land on the same quiet
  // refresh the pull-to-refresh uses.
  const onRefresh = useCallback(() => {
    void dispatch(loadAccountOverview({ quiet: true }));
    void dispatch(loadRecentConversations());
  }, [dispatch]);

  // Foreground, reconnect and the socket fallback all land on the same quiet
  // refresh the pull-to-refresh uses.
  useLiveRefresh(onRefresh);

  if (status === 'loading') {
    return (
      <Screen edges={['top']}>
        <DashboardSkeleton />
      </Screen>
    );
  }

  if (status === 'failed' && !disabled) {
    return (
      <Screen edges={['top']}>
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadAccountOverview())}
          retryAccessibilityLabel={Copy.retryLabel}
        />
      </Screen>
    );
  }

  const attention = overview?.attention_items?.length ?? 0;

  return (
    <Screen edges={['top']} padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <DashboardHeader />
        <GreetingCard name={user?.name} />

        <View style={styles.stale}>
          <StaleDataBanner error={error} title={Copy.refreshFailed} />
        </View>

        {/* REP-10: an account can have the overview switched off. That is a
            setting, not a failure, so Today stands on its own instead. */}
        {disabled ? (
          <AppText variant="caption" color="textSecondary" style={styles.section}>
            {Copy.disabled}
          </AppText>
        ) : (
          <>
            {/* REP-01: say "Your numbers" when this person can only see part
                of the account - never imply the figures cover all of it. */}
            <AppText variant="overline" color="textSecondary" style={styles.section}>
              {partial ? Copy.scopePartial : Copy.scopeAll}
            </AppText>

            <View style={styles.metrics}>
              {SNAPSHOT.map(({ key, label, icon }) => (
                <MetricCard
                  key={key}
                  label={label}
                  // A null figure reads "Not available", never 0.
                  value={metricValue(find(overview?.snapshot_metrics, key))}
                  icon={icon}
                />
              ))}
            </View>

            <AppText variant="overline" color="textSecondary" style={styles.section}>
              {Copy.period}
            </AppText>
            <Card>
              {PERIOD.map(({ key, label }, index) => (
                <StatRow
                  key={key}
                  label={label}
                  value={metricValue(find(overview?.period_metrics, key))}
                  divided={index > 0}
                />
              ))}
            </Card>

            {attention > 0 ? (
              <Pressable
                onPress={() => router.push('/delivery-issues')}
                accessibilityRole="button"
                accessibilityLabel={`${Copy.attention}: ${attention}`}
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              >
                <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
                <AppText variant="label" style={styles.linkText}>
                  {`${Copy.attention} (${attention})`}
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => router.push('/delivery-issues')}
              accessibilityRole="button"
              accessibilityLabel={Copy.issues}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Ionicons name="warning-outline" size={18} color={Colors.textSecondary} />
              <AppText variant="label" style={styles.linkText}>
                {Copy.issues}
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </Pressable>
          </>
        )}

        {/* REP-03: one number at a time, for its day and its action desk. */}
        <AppText variant="overline" color="textSecondary" style={styles.section}>
          {Copy.numbers}
        </AppText>
        <AppText variant="caption" color="textSecondary" style={styles.sectionHint}>
          {Copy.numbersHint}
        </AppText>
        {numbers.map((number) => (
          <Pressable
            key={number.id}
            onPress={() => router.push({ pathname: '/numbers/[id]', params: { id: String(number.id) } })}
            accessibilityRole="button"
            accessibilityLabel={`${number.display_label || number.label || number.display_phone_number}. Open its day`}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.linkBody}>
              <AppText variant="label">
                {number.display_label || number.label || number.display_phone_number}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {number.display_phone_number}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </Pressable>
        ))}

        <RecentConversations />
      </ScrollView>
    </Screen>
  );
}

export default function HomeRoute() {
  return (
    <RequirePermission permission={Permissions.dashboardView}>
      <ReportScreen />
    </RequirePermission>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.xl },
  stale: { paddingHorizontal: Layout.screenPadding },
  section: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sectionHint: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.xs },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
  },
  linkBody: { flex: 1, gap: 2 },
  linkText: { flex: 1 },
  pressed: { opacity: 0.7 },
});
