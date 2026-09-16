import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Permissions, type Conversation } from '@/api/types';
import { AppText, Screen } from '@/components/common';
import { ChatFilterChips, ChatSearchField, ConversationRow } from '@/components/chat';
import {
  ErrorState,
  ListFooterLoader,
  SkeletonList,
  StaleDataBanner,
  StateView,
} from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { RequirePermission } from '@/features/bootstrap';
import {
  filterChanged,
  loadConversations,
  loadMoreConversations,
  searchChanged,
  selectChatFilter,
  selectChatQueryIsNarrowed,
  selectChatSearch,
  selectConversations,
  selectConversationsError,
  selectConversationsStatus,
  selectHasMoreConversations,
  type ChatFilter,
} from '@/features/conversations';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

/** Long enough to stop typing, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 350;

const Copy = {
  title: 'Chats',
  emptyTitle: 'No Conversations Yet',
  emptyDescription: 'When customers message you, their conversations will appear here.',
  noMatchTitle: 'No matching conversations',
  noMatchDescription: 'Try a different search term or filter.',
  clear: 'Clear search and filters',
  failedTitle: 'We could not load your conversations',
  retryLabel: 'Retry loading your conversations',
  stale: 'Showing the chats we already loaded',
};

function ChatsScreen() {
  const dispatch = useAppDispatch();
  const conversations = useAppSelector(selectConversations);
  const status = useAppSelector(selectConversationsStatus);
  const error = useAppSelector(selectConversationsError);
  const filter = useAppSelector(selectChatFilter);
  const search = useAppSelector(selectChatSearch);
  const hasMore = useAppSelector(selectHasMoreConversations);
  const narrowed = useAppSelector(selectChatQueryIsNarrowed);

  const [term, setTerm] = useState(search);

  // The term is sent to CHAT-01; the list is never filtered on the device.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === search) return;
    const timer = setTimeout(() => dispatch(searchChanged(trimmed)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, search, term]);

  // Mount, and every time the query changes. In-flight requests are cancelled
  // by the thunk, so a slow first page cannot land on top of a newer one.
  useEffect(() => {
    void dispatch(loadConversations());
  }, [dispatch, filter, search]);

  const onRefresh = useCallback(() => {
    void dispatch(loadConversations({ refresh: true }));
  }, [dispatch]);

  const onEndReached = useCallback(() => {
    if (hasMore) void dispatch(loadMoreConversations());
  }, [dispatch, hasMore]);

  const onFilter = useCallback(
    (next: ChatFilter) => {
      dispatch(filterChanged(next));
    },
    [dispatch],
  );

  const clearQuery = useCallback(() => {
    setTerm('');
    dispatch(searchChanged(''));
    dispatch(filterChanged('mine'));
  }, [dispatch]);

  const openConversation = useCallback((conversation: Conversation) => {
    router.push({ pathname: '/chats/[id]', params: { id: String(conversation.id) } });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow conversation={item} onPress={openConversation} />
    ),
    [openConversation],
  );

  const busy = status === 'loading';
  const failed = status === 'failed';

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <AppText variant="h1" accessibilityRole="header">
          {Copy.title}
        </AppText>
      </View>

      <ChatSearchField value={term} onChangeText={setTerm} />
      <ChatFilterChips value={filter} onChange={onFilter} />

      {/* A refresh or a next page that failed with rows already listed: the
          rows stay, and this says they may be out of date. */}
      {failed ? null : (
        <View style={styles.stale}>
          <StaleDataBanner error={error} title={Copy.stale} />
        </View>
      )}

      {busy ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={7} label="Loading your conversations" />
        </View>
      ) : failed ? (
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadConversations())}
          retryAccessibilityLabel={Copy.retryLabel}
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <ListFooterLoader visible={status === 'loadingMore'} label="Loading more conversations" />
          }
          refreshControl={
            <RefreshControl
              refreshing={status === 'refreshing'}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            // No "Start a Conversation": WhatsApp conversations begin with the
            // customer, and phase 1 has no outbound creation endpoint.
            <StateView
              icon="chatbubbles-outline"
              tone={narrowed ? 'neutral' : 'brand'}
              title={narrowed ? Copy.noMatchTitle : Copy.emptyTitle}
              description={narrowed ? Copy.noMatchDescription : Copy.emptyDescription}
              actionLabel={narrowed ? Copy.clear : undefined}
              onAction={narrowed ? clearQuery : undefined}
              actionVariant="secondary"
            />
          }
        />
      )}
    </Screen>
  );
}

const Separator = () => <View style={styles.separator} />;

export default function ChatsTab() {
  return (
    <RequirePermission permission={Permissions.conversationsView}>
      <ChatsScreen />
    </RequirePermission>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.sm },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.sm },
  stale: { paddingHorizontal: Layout.screenPadding },
  listContent: { paddingBottom: Spacing.xxl },
  emptyContent: { flexGrow: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginLeft: Layout.screenPadding + 48 + Spacing.md,
  },
});
