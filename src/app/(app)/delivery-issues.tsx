import { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Card, IconButton, Screen } from '@/components/common';
import { ErrorState, SkeletonList, StateView } from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import {
  loadDeliveryIssues,
  selectDeliveryIssues,
  selectDeliveryIssuesError,
  selectDeliveryIssuesStatus,
} from '@/features/report';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  title: 'Why messages failed',
  back: 'Back',
  emptyTitle: 'Nothing failed',
  emptyBody: 'No messages failed to reach customers in this period.',
  failedTitle: 'Could not load the delivery problems',
  retryLabel: 'Retry loading the delivery problems',
  totals: (failed: number, attempts: number) => `${failed} failed of ${attempts} attempts`,
  noRetry: 'Sending it again will not help until this is fixed.',
  fixFirst: 'Fix the cause, then send again.',
  mayRetry: 'Sending it again may work.',
  retryWhere: 'Retrying is done on the message itself, in the chat.',
};

const ADVICE: Record<string, string> = {
  not_advised: Copy.noRetry,
  fix_then_send: Copy.fixFirst,
  may_retry: Copy.mayRetry,
};

/**
 * REP-02. Meta's error codes said plainly, grouped, with no customer names or
 * numbers in them - the group is about the problem, not about who it happened
 * to. Retrying stays a per-message action in the chat (CHAT-09), so nothing
 * here sends anything.
 */
function DeliveryIssuesScreen() {
  const dispatch = useAppDispatch();
  const issues = useAppSelector(selectDeliveryIssues);
  const status = useAppSelector(selectDeliveryIssuesStatus);
  const error = useAppSelector(selectDeliveryIssuesError);

  useEffect(() => {
    void dispatch(loadDeliveryIssues());
  }, [dispatch]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const groups = issues?.groups ?? [];

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" accessibilityLabel={Copy.back} onPress={goBack} />
        <AppText variant="h2" accessibilityRole="header" style={styles.headerTitle}>
          {Copy.title}
        </AppText>
      </View>

      {status === 'loading' ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={4} label="Loading the delivery problems" />
        </View>
      ) : status === 'failed' ? (
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadDeliveryIssues())}
          retryAccessibilityLabel={Copy.retryLabel}
        />
      ) : groups.length === 0 ? (
        <StateView
          icon="checkmark-circle-outline"
          title={Copy.emptyTitle}
          description={Copy.emptyBody}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void dispatch(loadDeliveryIssues())}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {issues?.totals ? (
            <AppText variant="caption" color="textSecondary" style={styles.totals}>
              {Copy.totals(issues.totals.failed, issues.totals.attempts)}
            </AppText>
          ) : null}

          {groups.map((group, index) => (
            <Card key={`${group.code}:${group.workspace.id}:${index}`} style={styles.card}>
              <View style={styles.row}>
                <Ionicons name="warning-outline" size={18} color={Colors.error} />
                <AppText variant="label" style={styles.reason}>
                  {group.reason}
                </AppText>
                <AppText variant="label">{String(group.count)}</AppText>
              </View>

              {group.advice ? (
                <AppText variant="caption" color="textSecondary">
                  {group.advice}
                </AppText>
              ) : null}
              <AppText variant="caption" color="textSecondary">
                {ADVICE[group.resend] ?? ''}
              </AppText>
              {group.workspace.label ? (
                <AppText variant="caption" color="textMuted">
                  {group.workspace.label}
                </AppText>
              ) : null}
            </Card>
          ))}

          <AppText variant="caption" color="textSecondary" style={styles.totals}>
            {Copy.retryWhere}
          </AppText>
        </ScrollView>
      )}
    </Screen>
  );
}

export default function DeliveryIssuesRoute() {
  return <DeliveryIssuesScreen />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { flex: 1 },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.md },
  content: { paddingBottom: Spacing.xl },
  totals: { paddingHorizontal: Layout.screenPadding, paddingVertical: Spacing.sm },
  card: { marginHorizontal: Layout.screenPadding, marginBottom: Spacing.sm, gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  reason: { flex: 1 },
});
