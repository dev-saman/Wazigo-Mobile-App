import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { normalizeError } from '@/api/network';
import {
  Permissions,
  type ActionDeskTab,
  type ActionItem,
  type FollowUpAction,
} from '@/api/types';
import { AppText, Card, IconButton, Screen, Sheet, SheetAction } from '@/components/common';
import { StatRow } from '@/components/dashboard';
import { ErrorState, ListFooterLoader, SkeletonList, StateView } from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { usePermission } from '@/features/bootstrap';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { checkChatBeforeOpening } from '@/features/messages';
import { transitionFollowUp, type FollowUpTransition } from '@/features/followUps';
import {
  loadActionDesk,
  loadNumberToday,
  metricValue,
  selectActionDesk,
  selectActionDeskStatus,
  selectToday,
  selectTodayError,
  selectTodayFor,
  selectTodayStatus,
  sectionUnavailable,
} from '@/features/report';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { formatListTimestamp } from '@/utils/datetime';
import { traceWriteIntent } from '@/utils/devTrace';

const Copy = {
  back: 'Back',
  fallbackTitle: 'This number',
  today: 'Today',
  desk: 'What needs doing',
  failedTitle: 'Could not load this number',
  retryLabel: 'Retry loading this number',
  emptyTitle: 'Nothing is waiting',
  emptyBody: 'No chats or follow-ups need attention right now.',
  gone: 'This chat is no longer available',
  goneBody: 'It may have been reassigned, or your access to its number has changed.',
  offline: 'You are offline.',
  openChat: 'Open the chat',
  actions: 'What would you like to do?',
  tokensHint: 'AI tokens, not messages. WhatsApp charges are separate.',
};

/** REP-03's summary keys, in the order the page shows them. */
const SUMMARY = [
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'new_enquiries', label: 'New enquiries' },
  { key: 'ai_assisted', label: 'Answered by AI' },
  { key: 'overdue_follow_ups', label: 'Overdue follow-ups' },
  { key: 'open_conversations', label: 'Open chats' },
];

const TABS: { key: ActionDeskTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'due_today', label: 'Due today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'ai_needs_help', label: 'AI stuck' },
  { key: 'waiting_for_staff', label: 'Waiting on us' },
];

const ACTION_LABELS: Record<FollowUpTransition, string> = {
  acknowledge: 'I have seen it',
  snooze: 'Snooze',
  complete: 'Mark done',
  cancel: 'Cancel it',
};

/**
 * REP-03 and REP-04. One number's day, and the list of things waiting on
 * someone.
 *
 * A section the server could not build comes back null with a reason, so each
 * one is drawn only when it is there and the rest of the page still renders -
 * a missing part of the page is not a broken page.
 */
function NumberTodayScreen({ numberId }: { numberId: number }) {
  const dispatch = useAppDispatch();
  const offline = useAppSelector(selectIsOffline);
  const today = useAppSelector(selectToday);
  const todayFor = useAppSelector(selectTodayFor);
  const status = useAppSelector(selectTodayStatus);
  const error = useAppSelector(selectTodayError);
  const desk = useAppSelector(selectActionDesk);
  const deskStatus = useAppSelector(selectActionDeskStatus);
  const canManageFollowUps = usePermission(Permissions.followUpsManage);

  const [tab, setTab] = useState<ActionDeskTab>('all');
  const [acting, setActing] = useState<ActionItem | null>(null);

  useEffect(() => {
    void dispatch(loadNumberToday({ numberId }));
  }, [dispatch, numberId]);

  // REP-03 already carries the first page of the desk, so only a tab change
  // asks for it again.
  useEffect(() => {
    if (tab === 'all') return;
    void dispatch(loadActionDesk({ numberId, params: { tab } }));
  }, [dispatch, numberId, tab]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const onRefresh = useCallback(() => {
    void dispatch(loadNumberToday({ numberId }));
    if (tab !== 'all') void dispatch(loadActionDesk({ numberId, params: { tab } }));
  }, [dispatch, numberId, tab]);

  /** REP-04: a row opens its chat, through CHAT-23 so a 404 is honest. */
  const openChat = useCallback(
    async (item: ActionItem) => {
      const id = String(item.conversation_id);
      const outcome = await dispatch(checkChatBeforeOpening({ conversationId: id })).unwrap();
      if (outcome === 'gone') {
        Alert.alert(Copy.gone, Copy.goneBody);
        return;
      }
      router.push({ pathname: '/chats/[id]', params: { id } });
    },
    [dispatch],
  );

  const runFollowUpAction = useCallback(
    (item: ActionItem, action: FollowUpTransition) => {
      if (!item.follow_up) return;
      traceWriteIntent(`action desk ${action}`, { followUpId: item.follow_up.id });
      void dispatch(
        transitionFollowUp({
          conversationId: String(item.conversation_id),
          followUpId: item.follow_up.id,
          transition: action,
          // Snooze, complete and cancel all want words the desk cannot ask
          // for in one tap, so only acknowledge runs from here.
          payload: { version: item.follow_up.version },
        }),
      )
        .unwrap()
        .then(() => {
          setActing(null);
          onRefresh();
        })
        .catch((reason) => {
          setActing(null);
          Alert.alert(Copy.desk, normalizeError(reason).message);
        });
    },
    [dispatch, onRefresh],
  );

  const title =
    today?.workspace.label || today?.workspace.display_phone || Copy.fallbackTitle;

  const items = desk?.items ?? [];
  const counts = desk?.counts ?? {};
  const deskError = sectionUnavailable(today?.errors, 'action_desk');

  const summary = useMemo(
    () =>
      SUMMARY.map(({ key, label }) => ({
        key,
        label,
        metric: today?.summary_metrics?.find((item) => item.key === key) ?? null,
      })).filter((row) => row.metric !== null),
    [today],
  );

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-back" accessibilityLabel={Copy.back} onPress={goBack} />
      <View style={styles.headerText}>
        <AppText variant="h2" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {today?.workspace.business_name ? (
          <AppText variant="caption" color="textSecondary">
            {today.workspace.business_name}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  if (status === 'loading' || todayFor !== numberId) {
    return (
      <Screen edges={['top']} padded={false}>
        {header}
        <View style={styles.skeleton}>
          <SkeletonList rows={5} label="Loading this number" />
        </View>
      </Screen>
    );
  }

  if (status === 'failed') {
    return (
      <Screen edges={['top']} padded={false}>
        {header}
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadNumberToday({ numberId }))}
          retryAccessibilityLabel={Copy.retryLabel}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} padded={false}>
      {header}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            {summary.length > 0 ? (
              <>
                <AppText variant="overline" color="textSecondary" style={styles.section}>
                  {Copy.today}
                </AppText>
                <Card style={styles.card}>
                  {summary.map((row, index) => (
                    <StatRow
                      key={row.key}
                      label={row.label}
                      // A null figure is "Not available", never 0.
                      value={metricValue(row.metric)}
                      divided={index > 0}
                    />
                  ))}
                </Card>
              </>
            ) : null}

            <AppText variant="overline" color="textSecondary" style={styles.section}>
              {Copy.desk}
            </AppText>

            <View style={styles.tabs}>
              {TABS.map(({ key, label }) => {
                const active = key === tab;
                const count = counts[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={
                      typeof count === 'number' ? `${label}, ${count}` : label
                    }
                    style={({ pressed }) => [
                      styles.tab,
                      active && styles.tabActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppText
                      variant="captionMedium"
                      color={active ? 'textOnPrimary' : 'textPrimary'}
                    >
                      {typeof count === 'number' ? `${label} (${count})` : label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {deskError ? (
              <AppText variant="caption" color="textSecondary" style={styles.section}>
                {deskError}
              </AppText>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void openChat(item)}
            onLongPress={() => (item.follow_up ? setActing(item) : undefined)}
            accessibilityRole="button"
            accessibilityLabel={`${item.contact?.name ?? 'Chat'}. ${item.reason ?? ''}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons
              name={item.type === 'follow_up' ? 'alarm-outline' : 'chatbubble-ellipses-outline'}
              size={20}
              color={Colors.textSecondary}
            />
            <View style={styles.rowBody}>
              <AppText variant="label" numberOfLines={1}>
                {item.contact?.name || item.follow_up?.title || Copy.openChat}
              </AppText>
              {item.reason ? (
                <AppText variant="caption" color="textSecondary" numberOfLines={2}>
                  {item.reason}
                </AppText>
              ) : null}
              {item.due_at || item.waiting_since ? (
                <AppText variant="caption" color="textMuted">
                  {formatListTimestamp(item.due_at ?? item.waiting_since)}
                </AppText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </Pressable>
        )}
        ListEmptyComponent={
          deskStatus === 'loading' ? (
            <View style={styles.skeleton}>
              <SkeletonList rows={3} label="Loading what needs doing" />
            </View>
          ) : (
            <StateView
              icon="checkmark-circle-outline"
              title={Copy.emptyTitle}
              description={Copy.emptyBody}
            />
          )
        }
        ListFooterComponent={
          <ListFooterLoader visible={deskStatus === 'loading'} label="Loading more" />
        }
        onEndReached={() => {
          // REP-04 pages with a cursor; the server stops sending one at the end.
          if (desk?.next_cursor) {
            void dispatch(loadActionDesk({ numberId, params: { tab, cursor: desk.next_cursor } }));
          }
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.content}
      />

      {/* REP-04 quick actions use the follow-up endpoints (CHAT-32). Only the
          one that needs no words is offered here; the rest live on the chat's
          own follow-ups screen, where they can be explained. */}
      <Sheet
        visible={acting !== null}
        title={Copy.actions}
        onClose={() => setActing(null)}
        notice={offline ? Copy.offline : undefined}
      >
        <SheetAction
          icon="chatbubble-ellipses-outline"
          label={Copy.openChat}
          onPress={() => {
            const item = acting;
            setActing(null);
            if (item) void openChat(item);
          }}
        />
        {canManageFollowUps &&
        acting?.follow_up &&
        (acting.allowed_actions ?? []).includes('acknowledge' as FollowUpAction) ? (
          <SheetAction
            icon="eye-outline"
            label={ACTION_LABELS.acknowledge}
            disabled={offline}
            onPress={() => acting && runFollowUpAction(acting, 'acknowledge')}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

export default function NumberTodayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numberId = Number(id);
  if (!Number.isInteger(numberId) || numberId <= 0) return null;
  return <NumberTodayScreen numberId={numberId} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.md },
  content: { paddingBottom: Spacing.xl },
  section: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  card: { marginHorizontal: Layout.screenPadding },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.sm,
  },
  tab: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
  },
  tabActive: { backgroundColor: Colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
  },
  rowBody: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
