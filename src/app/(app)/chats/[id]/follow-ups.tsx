import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  FollowUpLimits,
  type FollowUp,
  type FollowUpDetail,
  type FollowUpKind,
} from '@/api/types';
import { FollowUpRow } from '@/components/chat';
import { AppText, Button, IconButton, Screen, Sheet, SheetAction } from '@/components/common';
import { TextField } from '@/components/forms';
import { ErrorState, SkeletonList, StaleDataBanner, StateView } from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import {
  createFollowUp,
  followUpErrorText,
  loadFollowUpDetail,
  loadFollowUps,
  selectFollowUps,
  transitionFollowUp,
  validateFollowUp,
  type FollowUpTransition,
} from '@/features/followUps';
import { dueChoices } from '@/features/followUps/dueChoices';
import { formatListTimestamp } from '@/utils/datetime';
import { followUpKindLabel } from '@/features/followUps/followUpCopy';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { idempotencyKey } from '@/utils/idempotency';
import { traceWriteIntent } from '@/utils/devTrace';

const KINDS: FollowUpKind[] = ['callback', 'follow_up', 'promise', 'review'];

const Copy = {
  title: 'Follow-ups',
  back: 'Back',
  add: 'Add a follow-up',
  emptyTitle: 'Nothing to follow up',
  emptyBody: 'Add one so this chat does not slip.',
  failedTitle: 'Could not load the follow-ups',
  retryLabel: 'Retry loading the follow-ups',
  stale: 'This list may be out of date.',
  offline: 'You are offline.',
  titleLabel: 'What needs doing',
  titlePlaceholder: 'Call back about price',
  due: 'When',
  kind: 'Kind',
  save: 'Add follow-up',
  reason: 'Why',
  note: 'What happened',
  snoozeUntil: 'Snooze until',
  limitReached: 'This chat already has as many open follow-ups as it may have.',
  history: 'History',
  historyHint: 'Every change, and who made it',
  historyEmpty: 'Nothing has happened to it yet.',
  historyFailed: 'Could not load the history.',
  noPermission: 'You cannot add follow-ups on this chat.',
};

const ACTION_LABELS: Record<FollowUpTransition, string> = {
  acknowledge: 'I have seen it',
  snooze: 'Snooze',
  complete: 'Mark done',
  cancel: 'Cancel it',
};

/** Which transitions need a few words before they can be sent (CHAT-32). */
const NEEDS_TEXT: Record<FollowUpTransition, 'reason' | 'note' | null> = {
  acknowledge: null,
  snooze: 'reason',
  complete: 'note',
  cancel: 'reason',
};

function FollowUpsScreen({ conversationId }: { conversationId: string }) {
  const dispatch = useAppDispatch();
  const offline = useAppSelector(selectIsOffline);
  const { items, canCreate, limit, status, busyId, creating, error } = useAppSelector(
    selectFollowUps(conversationId),
  );

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<FollowUpKind>('callback');
  const [dueKey, setDueKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [acting, setActing] = useState<FollowUp | null>(null);
  const [transition, setTransition] = useState<FollowUpTransition | null>(null);
  // CHAT-33 is a detail sheet nobody has to open, so it is read on demand and
  // kept here rather than in the slice.
  const [history, setHistory] = useState<FollowUpDetail | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [snoozeKey, setSnoozeKey] = useState<string | null>(null);

  const choices = useMemo(() => dueChoices(), []);

  useEffect(() => {
    void dispatch(loadFollowUps({ conversationId }));
  }, [conversationId, dispatch]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/chats/[id]', params: { id: conversationId } });
  }, [conversationId]);

  const closeAdd = useCallback(() => {
    setAdding(false);
    setTitle('');
    setDueKey(null);
    setFormError(null);
  }, []);

  const onSave = useCallback(() => {
    const choice = choices.find((item) => item.key === dueKey) ?? null;
    const problem = validateFollowUp({ title, dueAt: choice?.at ?? null });
    if (problem) {
      setFormError(problem);
      return;
    }
    traceWriteIntent('follow-up create pressed', { conversationId, kind });
    void dispatch(
      createFollowUp({
        conversationId,
        payload: {
          kind,
          title: title.trim(),
          due_at: (choice as { at: Date }).at.toISOString(),
          // CHAT-30: one key per tap, so a retry replays instead of duplicating.
          idempotency_key: idempotencyKey(),
        },
      }),
    )
      .unwrap()
      .then(closeAdd)
      .catch(() => {
        // The slice already holds the error; the sheet stays open so the
        // person can change what they typed rather than retype it.
      });
  }, [choices, closeAdd, conversationId, dispatch, dueKey, kind, title]);

  const closeAction = useCallback(() => {
    setActing(null);
    setTransition(null);
    setText('');
    setSnoozeKey(null);
    setHistory(null);
    setHistoryError(null);
  }, []);

  const openHistory = useCallback(
    (followUp: FollowUp) => {
      setHistoryError(null);
      void dispatch(loadFollowUpDetail({ followUpId: followUp.id }))
        .unwrap()
        .then(setHistory)
        .catch(() => setHistoryError(Copy.historyFailed));
    },
    [dispatch],
  );

  const runTransition = useCallback(
    (followUp: FollowUp, next: FollowUpTransition) => {
      const needs = NEEDS_TEXT[next];
      const snoozeChoice = choices.find((item) => item.key === snoozeKey) ?? null;

      if (needs && text.trim().length < FollowUpLimits.reasonMin) {
        setFormError(`Say a little more (at least ${FollowUpLimits.reasonMin} characters).`);
        return;
      }
      if (next === 'snooze' && !snoozeChoice) {
        setFormError('Choose when to come back to it.');
        return;
      }

      traceWriteIntent(`follow-up ${next} pressed`, { conversationId, followUpId: followUp.id });
      void dispatch(
        transitionFollowUp({
          conversationId,
          followUpId: followUp.id,
          transition: next,
          payload: {
            version: followUp.version,
            ...(next === 'snooze' ? { until: snoozeChoice?.at.toISOString() } : {}),
            ...(needs === 'reason' ? { reason: text.trim() } : {}),
            ...(needs === 'note' ? { note: text.trim() } : {}),
          },
        }),
      )
        .unwrap()
        .then(closeAction)
        .catch(() => {
          // A 409 has already reloaded the list; the sheet closes so the person
          // sees where the follow-up actually stands now.
          closeAction();
        });
    },
    [choices, closeAction, conversationId, dispatch, snoozeKey, text],
  );

  const onRowPress = useCallback((followUp: FollowUp) => {
    setFormError(null);
    setActing(followUp);
  }, []);

  const allowed = (acting?.allowed_actions ?? []).filter(
    (action): action is FollowUpTransition => action in ACTION_LABELS,
  );

  const busy = status === 'loading';
  const failed = status === 'failed';
  const serverError = followUpErrorText(error);
  const atLimit = limit !== null && limit.open >= limit.max;

  return (
    <Screen edges={['top']} padded={false} background="surface">
      <View style={styles.header}>
        <IconButton icon="arrow-back" accessibilityLabel={Copy.back} onPress={goBack} />
        <AppText variant="h2" accessibilityRole="header" style={styles.headerTitle}>
          {Copy.title}
        </AppText>
      </View>

      {failed ? null : (
        <View style={styles.stale}>
          <StaleDataBanner error={error} title={Copy.stale} />
        </View>
      )}

      {busy ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={4} label="Loading the follow-ups" />
        </View>
      ) : failed ? (
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadFollowUps({ conversationId }))}
          retryAccessibilityLabel={Copy.retryLabel}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <FollowUpRow followUp={item} onPress={onRowPress} busy={busyId === item.id} />
          )}
          contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void dispatch(loadFollowUps({ conversationId }))}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <StateView icon="alarm-outline" title={Copy.emptyTitle} description={Copy.emptyBody} />
          }
        />
      )}

      {/* CHAT-28: `can_create` is the server's answer, and the limit is its
          count - neither is inferred from the rows on screen. */}
      {canCreate ? (
        <View style={styles.footer}>
          <Button
            title={Copy.add}
            icon="add"
            fullWidth
            disabled={offline || atLimit}
            onPress={() => {
              setFormError(null);
              setAdding(true);
            }}
          />
          {atLimit ? (
            <AppText variant="caption" color="textSecondary">
              {Copy.limitReached}
            </AppText>
          ) : offline ? (
            <AppText variant="caption" color="textSecondary">
              {Copy.offline}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <Sheet visible={adding} title={Copy.add} onClose={closeAdd}>
        <View style={styles.form}>
          <TextField
            label={Copy.titleLabel}
            placeholder={Copy.titlePlaceholder}
            value={title}
            onChangeText={setTitle}
            maxLength={FollowUpLimits.titleMax}
            error={formError ?? serverError ?? undefined}
          />

          <AppText variant="label">{Copy.kind}</AppText>
          <View style={styles.chips}>
            {KINDS.map((value) => (
              <Button
                key={value}
                title={followUpKindLabel(value)}
                size="sm"
                variant={value === kind ? 'primary' : 'secondary'}
                onPress={() => setKind(value)}
              />
            ))}
          </View>

          <AppText variant="label">{Copy.due}</AppText>
          {choices.map((choice) => (
            <SheetAction
              key={choice.key}
              icon="time-outline"
              label={choice.label}
              selected={choice.key === dueKey}
              onPress={() => setDueKey(choice.key)}
            />
          ))}

          <Button
            title={Copy.save}
            fullWidth
            loading={creating}
            disabled={creating || offline}
            onPress={onSave}
          />
        </View>
      </Sheet>

      <Sheet
        visible={acting !== null}
        title={acting?.title ?? Copy.title}
        onClose={closeAction}
        notice={offline ? Copy.offline : undefined}
      >
        {history !== null ? (
          // CHAT-33. The server's own record of what happened, in its words.
          history.events.length === 0 ? (
            <AppText variant="body" color="textSecondary" style={styles.empty}>
              {Copy.historyEmpty}
            </AppText>
          ) : (
            history.events.map((event) => (
              <View key={event.id} style={styles.event}>
                <AppText variant="label">
                  {event.to_status ? `${event.action} → ${event.to_status}` : event.action}
                </AppText>
                {event.actor?.name ? (
                  <AppText variant="caption" color="textSecondary">
                    {event.actor.name}
                  </AppText>
                ) : null}
                {event.note ? (
                  <AppText variant="caption" color="textSecondary">
                    {event.note}
                  </AppText>
                ) : null}
                {event.created_at ? (
                  <AppText variant="caption" color="textSecondary">
                    {formatListTimestamp(event.created_at)}
                  </AppText>
                ) : null}
              </View>
            ))
          )
        ) : transition === null ? (
          allowed.length === 0 && !acting ? (
            <AppText variant="body" color="textSecondary" style={styles.empty}>
              There is nothing to do on this one.
            </AppText>
          ) : (
            <>
            {historyError ? (
              <AppText variant="caption" color="error" style={styles.empty}>
                {historyError}
              </AppText>
            ) : null}
            {acting ? (
              <SheetAction
                icon="time-outline"
                label={Copy.history}
                description={Copy.historyHint}
                onPress={() => openHistory(acting)}
              />
            ) : null}
            {
            allowed.map((action) => (
              <SheetAction
                key={action}
                icon={
                  action === 'complete'
                    ? 'checkmark-circle-outline'
                    : action === 'snooze'
                      ? 'alarm-outline'
                      : action === 'cancel'
                        ? 'close-circle-outline'
                        : 'eye-outline'
                }
                label={ACTION_LABELS[action]}
                tone={action === 'cancel' ? 'danger' : 'default'}
                disabled={offline}
                onPress={() => {
                  setFormError(null);
                  setText('');
                  setSnoozeKey(null);
                  if (NEEDS_TEXT[action] === null && action === 'acknowledge' && acting) {
                    runTransition(acting, action);
                    return;
                  }
                  setTransition(action);
                }}
              />
            ))}
            </>
          )
        ) : (
          <View style={styles.form}>
            {transition === 'snooze' ? (
              <>
                <AppText variant="label">{Copy.snoozeUntil}</AppText>
                {choices.map((choice) => (
                  <SheetAction
                    key={choice.key}
                    icon="time-outline"
                    label={choice.label}
                    selected={choice.key === snoozeKey}
                    onPress={() => setSnoozeKey(choice.key)}
                  />
                ))}
              </>
            ) : null}

            <TextField
              label={NEEDS_TEXT[transition] === 'note' ? Copy.note : Copy.reason}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={
                NEEDS_TEXT[transition] === 'note'
                  ? FollowUpLimits.noteMax
                  : FollowUpLimits.reasonMax
              }
              error={formError ?? serverError ?? undefined}
            />

            <Button
              title={ACTION_LABELS[transition]}
              fullWidth
              loading={busyId === acting?.id}
              disabled={offline || busyId === acting?.id}
              onPress={() => acting && runTransition(acting, transition)}
            />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

export default function FollowUpsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowUpsScreen conversationId={String(id)} />;
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
  stale: { paddingHorizontal: Layout.screenPadding },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.md },
  listContent: { paddingVertical: Spacing.sm },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  footer: {
    gap: Spacing.xs,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
  },
  form: { gap: Spacing.sm, paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  empty: { paddingHorizontal: Layout.screenPadding, paddingVertical: Spacing.md },
  event: { gap: 2, paddingHorizontal: Layout.screenPadding, paddingVertical: Spacing.sm },
});
