import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { normalizeError } from '@/api/network';
import { Permissions, type ConversationPriority, type Message } from '@/api/types';
import {
  AiStatusBar,
  AttachmentSheet,
  ConversationActionsSheet,
  DaySeparator,
  LabelsSheet,
  MessageActionsSheet,
  MessageBubble,
  MessageComposer,
  PrioritySheet,
  ReplyWindowBanner,
  ThreadHeader,
  ThreadSkeleton,
  type AttachmentChoice,
} from '@/components/chat';
import { Screen } from '@/components/common';
import { ErrorState, ListFooterLoader, StaleDataBanner, StateView } from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { AccessDeniedView, RequirePermission, usePermission } from '@/features/bootstrap';
import { loadFollowUps, selectOpenFollowUpCount } from '@/features/followUps';
import {
  loadConversationAi,
  pauseConversationAi,
  resumeConversationAi,
  selectConversationAiBusy,
  selectConversationAiStatus,
  markKnowledgeGap,
  setConversationLocation,
} from '@/features/conversationAi';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import {
  loadLabels,
  markConversationRead,
  reopenConversation,
  resolveConversation,
  selectConversationById,
  selectLabels,
  selectLabelsNumberId,
  selectLabelsStatus,
  setConversationLabels,
  setConversationPriority,
  stopChatbot,
  useReplyWindow,
} from '@/features/conversations';
import {
  buildThreadRows,
  loadOlderMessages,
  loadThread,
  selectHasOlderMessages,
  selectThread,
  selectThreadConversation,
  selectThreadError,
  selectThreadLoadedAt,
  selectThreadMessages,
  selectThreadPage,
  selectThreadStatus,
  retryMessage,
  sendMedia,
  sendText,
  type ThreadRow,
} from '@/features/messages';
import { draftChanged, draftCleared, selectDraft } from '@/features/composer';
import { useActiveConversation, useLiveRefresh } from '@/features/realtime';
import {
  conversationRevocationHandled,
  selectRevokedConversationId,
} from '@/features/realtime/realtimeSlice';
import { pickDocument, pickFromCamera, pickFromLibrary } from '@/services/media/picker';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { traceWriteIntent } from '@/utils/devTrace';

const Copy = {
  emptyTitle: 'No messages yet',
  emptyDescription: 'Messages in this conversation will appear here.',
  failedTitle: 'We could not load this conversation',
  retryLabel: 'Retry loading this conversation',
  stale: 'Some messages could not be loaded',
  missingTitle: 'Conversation unavailable',
  missingDescription: 'This conversation is no longer available.',
  back: 'Back to chats',
  attachmentFailed: 'Attachment',
  offlineComposer: 'Reconnect to send a message',
  actionFailed: 'That did not work',
};

function ThreadScreen({ conversationId }: { conversationId: string }) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectThreadMessages(conversationId));
  const status = useAppSelector(selectThreadStatus(conversationId));
  const error = useAppSelector(selectThreadError(conversationId));
  const conversation = useAppSelector(selectThreadConversation(conversationId));
  const hasOlder = useAppSelector(selectHasOlderMessages(conversationId));
  const loadedAt = useAppSelector(selectThreadLoadedAt(conversationId));
  const page = useAppSelector(selectThreadPage(conversationId));
  // The listed row fills the header while the first page is still loading.
  const listed = useAppSelector(selectConversationById(conversationId));
  // The window belongs to the conversation, so the fresher of the two wins.
  const replyWindow = useReplyWindow(conversation ?? listed);

  const uploads = useAppSelector(selectThread(conversationId)).uploads;
  const offline = useAppSelector(selectIsOffline);
  const canSend = usePermission(Permissions.conversationsSend);
  // Both are needed: the picker lists templates, the action sends one.
  const canViewTemplates = usePermission(Permissions.templatesView);
  const canSendTemplates = usePermission(Permissions.templatesSend);
  const canUseTemplates = canViewTemplates && canSendTemplates;
  const canTag = usePermission(Permissions.conversationsTag);
  const aiStatus = useAppSelector(selectConversationAiStatus(conversationId));
  const aiBusy = useAppSelector(selectConversationAiBusy(conversationId));
  const openFollowUps = useAppSelector(selectOpenFollowUpCount(conversationId));
  const canSetLocation = usePermission(Permissions.conversationsSetLocation);
  const canMarkGap = usePermission(Permissions.knowledgeManage);
  // CHAT-34: which messages this session has already marked, so the sheet says
  // so rather than offering the same thing twice. The server is idempotent, so
  // losing this on a remount costs nothing.
  const [markedGaps, setMarkedGaps] = useState<number[]>([]);
  const [markingGap, setMarkingGap] = useState(false);
  const labels = useAppSelector(selectLabels);
  const labelsStatus = useAppSelector(selectLabelsStatus);
  const labelsNumberId = useAppSelector(selectLabelsNumberId);

  // In the store, not local state: the quick-replies picker is a separate route
  // and writes into the draft while this screen is unmounted. See composerSlice.
  const draft = useAppSelector(selectDraft(conversationId));
  const setDraft = useCallback(
    (text: string) => dispatch(draftChanged({ conversationId, text })),
    [conversationId, dispatch],
  );
  const [attaching, setAttaching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [openSheet, setOpenSheet] = useState<'none' | 'conversation' | 'priority' | 'labels'>('none');
  const [actionBusy, setActionBusy] = useState(false);

  // The conversation copy CHAT-06 was last sent for.
  const markedReadFor = useRef<typeof conversation>(null);

  // Live updates and push treat this thread as the one on screen.
  useActiveConversation(conversationId);

  useEffect(() => {
    void dispatch(loadThread({ conversationId }));
  }, [conversationId, dispatch]);

  // CHAT-24: the AI bar is extra context, so it is asked for separately and a
  // failure never touches the thread itself.
  useEffect(() => {
    void dispatch(loadConversationAi({ conversationId }));
  }, [conversationId, dispatch]);

  // CHAT-28: the menu shows how many are still open, which means the list has
  // to be read with the thread rather than only on the follow-ups screen.
  useEffect(() => {
    void dispatch(loadFollowUps({ conversationId }));
  }, [conversationId, dispatch]);

  // CHAT-06 only when there is a badge to clear: on opening, and again when a
  // live update brings in a message while the thread is open. Keyed on the
  // server's copy, so a failed call is not repeated until something new arrives.
  useEffect(() => {
    if (status !== 'ready' || !conversation || conversation.unread_count <= 0) return;
    if (markedReadFor.current === conversation) return;
    markedReadFor.current = conversation;
    void dispatch(markConversationRead({ conversationId }));
  }, [conversation, conversationId, dispatch, status]);

  // Until live events arrive, an open thread catches up on foreground and on
  // reconnect. Quiet: unsent messages stay put and the skeleton never returns.
  // Only while the newest page is the whole thread - reloading page 1 under
  // someone who has scrolled back through history would throw it away.
  useLiveRefresh(
    useCallback(() => void dispatch(loadThread({ conversationId, quiet: true })), [conversationId, dispatch]),
    { loadedAt, enabled: status !== 'failed' && page <= 1 },
  );

  const rows = useMemo(() => buildThreadRows(messages), [messages]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/chats');
  }, []);

  /**
   * LIVE-02: the chat was reassigned to someone else while it was open. The
   * person has lost access, so the thread closes rather than sitting on stale
   * messages it can no longer refresh.
   */
  const revokedConversationId = useAppSelector(selectRevokedConversationId);
  useEffect(() => {
    if (revokedConversationId !== conversationId) return;
    dispatch(conversationRevocationHandled());
    goBack();
  }, [conversationId, dispatch, goBack, revokedConversationId]);

  // Inverted: reaching the "end" means the user scrolled up into older history.
  const onPauseAi = useCallback(() => {
    void dispatch(pauseConversationAi({ conversationId }));
  }, [conversationId, dispatch]);

  const onResumeAi = useCallback(() => {
    void dispatch(resumeConversationAi({ conversationId }));
  }, [conversationId, dispatch]);

  /**
   * CHAT-27. `location_version` goes back exactly as CHAT-24 gave it: a 409
   * means a colleague chose first, and the thunk re-reads the status so the
   * person is asked again against what is now true rather than overwriting it.
   */
  /**
   * CHAT-34. A to-do for the web Knowledge Hub, nothing more: no customer sees
   * it and no reply changes, so it goes straight through without a prompt.
   */
  const onKnowledgeGap = useCallback(
    (message: Message) => {
      traceWriteIntent('knowledge gap marked', { conversationId, messageId: message.id });
      setMarkingGap(true);
      void dispatch(markKnowledgeGap({ conversationId, payload: { message_id: message.id } }))
        .unwrap()
        .then(() => {
          setMarkedGaps((marked) =>
            marked.includes(message.id) ? marked : [...marked, message.id],
          );
        })
        .catch((error) => {
          Alert.alert(Copy.actionFailed, normalizeError(error).message);
        })
        .finally(() => setMarkingGap(false));
    },
    [conversationId, dispatch],
  );

  const onSetLocation = useCallback(
    (locationId: number | null) => {
      traceWriteIntent('chat branch chosen', { conversationId, locationId });
      void dispatch(
        setConversationLocation({
          conversationId,
          payload: {
            location_id: locationId,
            location_version: aiStatus?.location?.location_version ?? undefined,
          },
        }),
      )
        .unwrap()
        .catch((error) => {
          Alert.alert(Copy.actionFailed, normalizeError(error).message);
        });
    },
    [aiStatus?.location?.location_version, conversationId, dispatch],
  );

  const onEndReached = useCallback(() => {
    if (hasOlder) void dispatch(loadOlderMessages({ conversationId }));
  }, [conversationId, dispatch, hasOlder]);

  const renderItem = useCallback(
    ({ item }: { item: ThreadRow }) =>
      item.kind === 'message' ? (
        <MessageBubble
          message={item.message}
          conversationId={conversationId}
          progress={uploads[String(item.message.id)]}
          onOpenActions={setActionMessage}
        />
      ) : (
        <DaySeparator ms={item.ms} />
      ),
    [conversationId, uploads],
  );

  const onSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    traceWriteIntent('composer send pressed', { conversationId, length: text.length });
    dispatch(draftCleared(conversationId));
    void dispatch(sendText({ conversationId, text }));
  }, [conversationId, dispatch, draft]);

  /**
   * Whatever is in the composer travels with the attachment as its caption,
   * which is how WhatsApp itself behaves.
   */
  const onAttachment = useCallback(
    async (choice: AttachmentChoice) => {
      setSheetOpen(false);
      setAttaching(true);
      try {
        const result =
          choice === 'camera'
            ? await pickFromCamera()
            : choice === 'document'
              ? await pickDocument()
              : await pickFromLibrary();

        if (!result.ok) {
          if (result.reason !== 'cancelled') Alert.alert(Copy.attachmentFailed, result.message);
          return;
        }

        const caption = draft.trim();
        traceWriteIntent('attachment send', { conversationId, type: result.type, captionLength: caption.length });
        dispatch(draftCleared(conversationId));
        void dispatch(sendMedia({ conversationId, type: result.type, file: result.file, caption }));
      } finally {
        setAttaching(false);
      }
    },
    [conversationId, dispatch, draft],
  );

  /** Every action answers with the Conversation, so nothing is refetched. */
  const runAction = useCallback(
    async (name: string, action: () => Promise<unknown>) => {
      traceWriteIntent(`conversation action: ${name}`, { conversationId });
      setActionBusy(true);
      try {
        await action();
        setOpenSheet('none');
      } catch (error) {
        Alert.alert(Copy.actionFailed, normalizeError(error).message);
      } finally {
        setActionBusy(false);
      }
    },
    [conversationId],
  );

  const onRetry = useCallback(
    (message: Message) => {
      traceWriteIntent('retry pressed', { conversationId, messageId: message.id });
      setActionMessage(null);
      void dispatch(retryMessage({ conversationId, message }));
    },
    [conversationId, dispatch],
  );

  const thread = conversation ?? listed;

  const header = (
    <ThreadHeader
      conversation={thread}
      onBack={goBack}
      onActions={() => setOpenSheet('conversation')}
    />
  );

  if (status === 'failed') {
    // Blocker 2: CHAT-02's policy is wider than this app's personal scope, so a
    // refusal is a real possibility and must read as one.
    if (error?.code === 'FORBIDDEN') {
      return <AccessDeniedView description={error.message} actionLabel={Copy.back} onAction={goBack} />;
    }

    // A conversation that is gone cannot be retried; every other failure can.
    const missing = error?.code === 'NOT_FOUND';
    return (
      <Screen background="chatBackground" edges={['top', 'bottom']} padded={false}>
        {header}
        {missing ? (
          <StateView
            icon="help-circle-outline"
            tone="neutral"
            title={Copy.missingTitle}
            description={Copy.missingDescription}
            actionLabel={Copy.back}
            onAction={goBack}
          />
        ) : (
          <ErrorState
            error={error}
            title={Copy.failedTitle}
            onRetry={() => void dispatch(loadThread({ conversationId }))}
            retryAccessibilityLabel={Copy.retryLabel}
          />
        )}
      </Screen>
    );
  }

  const loading = status === 'idle' || status === 'loading';

  return (
    <Screen background="chatBackground" edges={['top', 'bottom']} padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      {header}

      {/* Messages already on screen stay; only the page that failed is missing. */}
      <View style={styles.stale}>
        <StaleDataBanner error={error} title={Copy.stale} />
      </View>

      {loading ? (
        <ThreadSkeleton />
      ) : rows.length === 0 ? (
        <StateView
          icon="chatbubble-ellipses-outline"
          tone="neutral"
          title={Copy.emptyTitle}
          description={Copy.emptyDescription}
        />
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <ListFooterLoader visible={status === 'loadingOlder'} label="Loading older messages" />
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* WhatsApp refuses free-form messages once the 24-hour window closes, so
          the composer is replaced by the template action rather than left to
          fail. No `conversations.send` permission means no composer at all. */}
      {/* CHAT-24 to CHAT-26: whether the AI is answering this chat. Pause and
          resume change what the customer is told next, so they need the same
          permission as sending and only ever run from a tap. */}
      <AiStatusBar
        status={aiStatus}
        busy={aiBusy}
        onPause={canSend ? onPauseAi : undefined}
        onResume={canSend ? onResumeAi : undefined}
        onSetLocation={canSetLocation ? onSetLocation : undefined}
        disabled={offline}
        disabledReason={offline ? 'You are offline.' : undefined}
      />

      {canSend ? (
        <>
          <ReplyWindowBanner
            window={replyWindow}
            onChooseTemplate={
              canUseTemplates
                ? () =>
                    router.push({
                      pathname: '/chats/[id]/templates',
                      params: { id: conversationId },
                    })
                : undefined
            }
          />
          {replyWindow.state === 'closed' ? null : (
            <MessageComposer
              value={draft}
              onChangeText={setDraft}
              onSend={onSend}
              onAttach={() => setSheetOpen(true)}
              onQuickReply={() =>
                router.push({ pathname: '/chats/[id]/quick-replies', params: { id: conversationId } })
              }
              disabled={offline}
              sending={attaching}
              placeholder={offline ? Copy.offlineComposer : undefined}
            />
          )}
        </>
      ) : null}

      <AttachmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={(choice) => void onAttachment(choice)}
      />

      <MessageActionsSheet
        visible={!!actionMessage}
        message={actionMessage}
        onClose={() => setActionMessage(null)}
        onRetry={onRetry}
        offline={offline}
        onKnowledgeGap={canMarkGap ? onKnowledgeGap : undefined}
        markingGap={markingGap}
        gapMarked={!!actionMessage && markedGaps.includes(actionMessage.id)}
      />

      <ConversationActionsSheet
        visible={openSheet === 'conversation'}
        conversation={thread}
        canTag={canTag}
        busy={actionBusy}
        offline={offline}
        onClose={() => setOpenSheet('none')}
        onResolve={() => void runAction('resolve', () => dispatch(resolveConversation({ conversationId })).unwrap())}
        onReopen={() => void runAction('reopen', () => dispatch(reopenConversation({ conversationId })).unwrap())}
        onTakeOver={() => void runAction('take over', () => dispatch(stopChatbot({ conversationId })).unwrap())}
        onNotes={
          typeof thread?.contact?.id === 'number'
            ? () => {
                setOpenSheet('none');
                router.push({ pathname: '/chats/[id]/notes', params: { id: conversationId } });
              }
            : undefined
        }
        onFollowUps={() => {
          setOpenSheet('none');
          router.push({ pathname: '/chats/[id]/follow-ups', params: { id: conversationId } });
        }}
        openFollowUps={openFollowUps}
        onPriority={() => setOpenSheet('priority')}
        onLabels={() => {
          // CHAT-13 (2026-10-19): each number has its own labels, so a cache
          // held for another number is reloaded, not reused.
          const stale = labelsNumberId !== (thread?.number?.id ?? null);
          if (labelsStatus === 'idle' || labelsStatus === 'failed' || stale) {
            void dispatch(loadLabels({ numberId: thread?.number?.id ?? null }));
          }
          setOpenSheet('labels');
        }}
      />

      <PrioritySheet
        visible={openSheet === 'priority'}
        value={thread?.priority ?? 'normal'}
        busy={actionBusy}
        offline={offline}
        onClose={() => setOpenSheet('conversation')}
        onSelect={(priority: ConversationPriority) =>
          void runAction('priority', () => dispatch(setConversationPriority({ conversationId, priority })).unwrap())
        }
      />

      {openSheet === 'labels' ? (
      <LabelsSheet
        visible
        labels={labels}
        status={labelsStatus}
        selected={(thread?.labels ?? []).map((label) => label.id)}
        busy={actionBusy}
        offline={offline}
        onClose={() => setOpenSheet('conversation')}
        onSave={(labelIds) =>
          void runAction('labels', () => dispatch(setConversationLabels({ conversationId, labelIds })).unwrap())
        }
      />
      ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <Screen>
        <StateView
          icon="help-circle-outline"
          tone="neutral"
          title={Copy.missingTitle}
          description={Copy.missingDescription}
          actionLabel={Copy.back}
          onAction={() => router.replace('/chats')}
        />
      </Screen>
    );
  }

  return (
    <RequirePermission permission={Permissions.conversationsView}>
      <ThreadScreen conversationId={String(id)} />
    </RequirePermission>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: Spacing.md, backgroundColor: Colors.chatBackground },
  stale: { paddingHorizontal: Layout.screenPadding },
});
