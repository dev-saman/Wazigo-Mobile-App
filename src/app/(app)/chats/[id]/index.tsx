import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { normalizeError } from '@/api/network';
import { Permissions, type ConversationPriority, type Message } from '@/api/types';
import {
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
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import {
  loadLabels,
  markConversationRead,
  reopenConversation,
  resolveConversation,
  selectConversationById,
  selectLabels,
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
import { useLiveRefresh } from '@/features/realtime';
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
  const labels = useAppSelector(selectLabels);
  const labelsStatus = useAppSelector(selectLabelsStatus);

  const [draft, setDraft] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [openSheet, setOpenSheet] = useState<'none' | 'conversation' | 'priority' | 'labels'>('none');
  const [actionBusy, setActionBusy] = useState(false);

  const markedRead = useRef(false);

  useEffect(() => {
    void dispatch(loadThread({ conversationId }));
  }, [conversationId, dispatch]);

  // CHAT-06 once per visit, and only when there is a badge to clear.
  useEffect(() => {
    if (markedRead.current || status !== 'ready') return;
    if (!conversation || conversation.unread_count <= 0) return;
    markedRead.current = true;
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

  // Inverted: reaching the "end" means the user scrolled up into older history.
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
    setDraft('');
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
        setDraft('');
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
        onPriority={() => setOpenSheet('priority')}
        onLabels={() => {
          if (labelsStatus === 'idle' || labelsStatus === 'failed') void dispatch(loadLabels());
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
