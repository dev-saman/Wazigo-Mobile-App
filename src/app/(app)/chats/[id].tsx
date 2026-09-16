import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Permissions } from '@/api/types';
import { DaySeparator, MessageBubble, ThreadHeader } from '@/components/chat';
import { Screen } from '@/components/common';
import { ListFooterLoader, StateView } from '@/components/feedback';
import { Colors, Spacing } from '@/constants/theme';
import { AccessDeniedView, RequirePermission } from '@/features/bootstrap';
import { markConversationRead, selectConversationById } from '@/features/conversations';
import {
  buildThreadRows,
  loadOlderMessages,
  loadThread,
  selectHasOlderMessages,
  selectThreadConversation,
  selectThreadError,
  selectThreadMessages,
  selectThreadStatus,
  type ThreadRow,
} from '@/features/messages';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  emptyTitle: 'No messages yet',
  emptyDescription: 'Messages in this conversation will appear here.',
  offlineTitle: 'You are offline',
  offlineDescription: 'Please check your internet connection and try again.',
  failedTitle: 'We could not load this conversation',
  missingTitle: 'Conversation unavailable',
  missingDescription: 'This conversation is no longer available.',
  retry: 'Retry',
  back: 'Back to chats',
};

function ThreadScreen({ conversationId }: { conversationId: string }) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectThreadMessages(conversationId));
  const status = useAppSelector(selectThreadStatus(conversationId));
  const error = useAppSelector(selectThreadError(conversationId));
  const conversation = useAppSelector(selectThreadConversation(conversationId));
  const hasOlder = useAppSelector(selectHasOlderMessages(conversationId));
  // The listed row fills the header while the first page is still loading.
  const listed = useAppSelector(selectConversationById(conversationId));

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
      item.kind === 'message' ? <MessageBubble message={item.message} /> : <DaySeparator ms={item.ms} />,
    [],
  );

  const header = <ThreadHeader conversation={conversation ?? listed} onBack={goBack} />;

  if (status === 'failed') {
    // Blocker 2: CHAT-02's policy is wider than this app's personal scope, so a
    // refusal is a real possibility and must read as one.
    if (error?.code === 'FORBIDDEN') {
      return <AccessDeniedView description={error.message} actionLabel={Copy.back} onAction={goBack} />;
    }

    const offline = !!error?.isOffline;
    const missing = error?.code === 'NOT_FOUND';
    return (
      <Screen background="chatBackground" edges={['top', 'bottom']} padded={false}>
        {header}
        <StateView
          icon={offline ? 'cloud-offline-outline' : missing ? 'help-circle-outline' : 'alert-circle-outline'}
          tone={offline || missing ? 'neutral' : 'error'}
          title={offline ? Copy.offlineTitle : missing ? Copy.missingTitle : Copy.failedTitle}
          description={
            offline ? Copy.offlineDescription : missing ? Copy.missingDescription : error?.message
          }
          actionLabel={missing ? Copy.back : Copy.retry}
          onAction={missing ? goBack : () => void dispatch(loadThread({ conversationId }))}
        />
      </Screen>
    );
  }

  const loading = status === 'idle' || status === 'loading';

  return (
    <Screen background="chatBackground" edges={['top', 'bottom']} padded={false}>
      {header}

      {loading ? (
        <View style={styles.centre}>
          <ListFooterLoader visible />
        </View>
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
          ListFooterComponent={<ListFooterLoader visible={status === 'loadingOlder'} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      )}
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
  list: { paddingVertical: Spacing.md, backgroundColor: Colors.chatBackground },
  centre: { flex: 1, justifyContent: 'center' },
});
