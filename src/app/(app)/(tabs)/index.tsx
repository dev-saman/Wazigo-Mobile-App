import { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Permissions } from '@/api/types';
import { AppText, Badge, Card, Screen } from '@/components/common';
import { DashboardSkeleton, MetricCard, StatRow } from '@/components/dashboard';
import { Banner, StateView } from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { selectCurrentUser } from '@/features/auth/authSelectors';
import { RequirePermission } from '@/features/bootstrap';
import {
  loadDashboard,
  selectDashboardActivity,
  selectDashboardDelivery,
  selectDashboardError,
  selectDashboardStatus,
  selectDashboardTotals,
  selectPriorityBreakdown,
} from '@/features/dashboard';
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader';
import { GreetingCard } from '@/features/dashboard/components/GreetingCard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  total: 'Total chats',
  open: 'Open chats',
  unread: 'Unread',
  windowOpen: 'Reply window open',
  windowHint: 'Can be replied to without a template',
  priority: 'By priority',
  today: 'Today',
  received: 'Received',
  sent: 'Sent',
  busiest: 'Busiest day',
  delivery: 'Message delivery',
  delivered: 'Delivered',
  deliveredHint: 'Delivered includes messages that were read.',
  read: 'Read',
  failed: 'Failed',
  inFlight: 'In flight',
  offlineTitle: 'You are offline',
  offlineDescription: 'Please check your internet connection and try again.',
  failedTitle: 'We could not load your dashboard',
  retry: 'Retry',
  refreshFailed: 'Showing the last figures we loaded',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

const PRIORITY_TONES = {
  urgent: 'error',
  high: 'warning',
  normal: 'info',
  low: 'neutral',
} as const;

function DashboardScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const status = useAppSelector(selectDashboardStatus);
  const error = useAppSelector(selectDashboardError);
  const totals = useAppSelector(selectDashboardTotals);
  const priorities = useAppSelector(selectPriorityBreakdown);
  const activity = useAppSelector(selectDashboardActivity);
  const delivery = useAppSelector(selectDashboardDelivery);

  useEffect(() => {
    if (status === 'idle') void dispatch(loadDashboard());
  }, [dispatch, status]);

  const refresh = useCallback(() => {
    void dispatch(loadDashboard({ refresh: true }));
  }, [dispatch]);

  if (status === 'failed') {
    const offline = !!error?.isOffline;
    return (
      <Screen edges={['top']}>
        <DashboardHeader />
        <StateView
          icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          tone={offline ? 'neutral' : 'error'}
          title={offline ? Copy.offlineTitle : Copy.failedTitle}
          description={offline ? Copy.offlineDescription : error?.message}
          actionLabel={Copy.retry}
          onAction={() => void dispatch(loadDashboard())}
        />
      </Screen>
    );
  }

  const loading = status === 'idle' || status === 'loading';
  const activityDays = activity?.days?.length ?? 0;

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.headerPadding}>
        <DashboardHeader />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={status === 'refreshing'}
            onRefresh={refresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* A failed pull-to-refresh keeps the numbers and says they are stale. */}
            {error ? (
              <Banner
                tone="warning"
                icon={error.isOffline ? 'cloud-offline-outline' : 'alert-circle-outline'}
                title={Copy.refreshFailed}
                description={error.message}
              />
            ) : null}

            <GreetingCard name={user?.name} />

            <View style={styles.grid}>
              <MetricCard label={Copy.total} value={totals.total} icon="chatbubbles-outline" />
              <MetricCard label={Copy.open} value={totals.open} icon="folder-open-outline" tone="info" />
              <MetricCard
                label={Copy.unread}
                value={totals.unread}
                icon="mail-unread-outline"
                tone="warning"
              />
              <MetricCard
                label={Copy.windowOpen}
                value={totals.window_open}
                icon="time-outline"
                hint={Copy.windowHint}
              />
            </View>

            {priorities.length > 0 ? (
              <View style={styles.section}>
                <AppText variant="sectionTitle" accessibilityRole="header">
                  {Copy.priority}
                </AppText>
                <Card>
                  {priorities.map((row, index) => (
                    <StatRow
                      key={row.priority}
                      divided={index > 0}
                      label={PRIORITY_LABELS[row.priority] ?? row.priority}
                      value={<Badge label={row.count} tone={PRIORITY_TONES[row.priority] ?? 'neutral'} />}
                    />
                  ))}
                </Card>
              </View>
            ) : null}

            {activity ? (
              <View style={styles.section}>
                <AppText variant="sectionTitle" accessibilityRole="header">
                  {Copy.today}
                </AppText>
                <Card>
                  <StatRow label={Copy.received} value={activity.today?.inbound ?? 0} />
                  <StatRow divided label={Copy.sent} value={activity.today?.outbound ?? 0} />
                  {activityDays > 0 ? (
                    <>
                      <StatRow
                        divided
                        label={`${Copy.received} (last ${activityDays} days)`}
                        value={activity.inbound_total ?? 0}
                      />
                      <StatRow
                        divided
                        label={`${Copy.sent} (last ${activityDays} days)`}
                        value={activity.outbound_total ?? 0}
                      />
                    </>
                  ) : null}
                  {activity.busiest ? (
                    <StatRow
                      divided
                      label={Copy.busiest}
                      value={`${activity.busiest.label} (${activity.busiest.total})`}
                    />
                  ) : null}
                </Card>
              </View>
            ) : null}

            {delivery ? (
              <View style={styles.section}>
                <AppText variant="sectionTitle" accessibilityRole="header">
                  {Copy.delivery}
                </AppText>
                <Card>
                  <StatRow label={Copy.delivered} value={delivery.delivered ?? 0} />
                  <StatRow divided label={Copy.read} value={delivery.read ?? 0} />
                  <StatRow divided label={Copy.failed} value={delivery.failed ?? 0} />
                  <StatRow divided label={Copy.inFlight} value={delivery.in_flight ?? 0} />
                  <AppText variant="caption" color="textMuted" style={styles.note}>
                    {`${Copy.deliveredHint} Last ${delivery.window_days ?? 0} days.`}
                  </AppText>
                </Card>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

export default function HomeTab() {
  return (
    <RequirePermission permission={Permissions.dashboardView}>
      <DashboardScreen />
    </RequirePermission>
  );
}

const styles = StyleSheet.create({
  headerPadding: { paddingHorizontal: Layout.screenPadding },
  content: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  section: { gap: Spacing.md },
  note: { marginTop: Spacing.md },
});
