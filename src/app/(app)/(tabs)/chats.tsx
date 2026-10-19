import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Permissions, type Conversation, type ConversationSort } from '@/api/types';
import { AppText, Screen } from '@/components/common';
import {
  ChatFilterChips,
  ChatScopeBar,
  ChatSearchField,
  ConversationRow,
  ConversationRowDivider as RowDivider,
} from '@/components/chat';
import {
  ErrorState,
  ListFooterLoader,
  SkeletonList,
  StaleDataBanner,
  StateView,
} from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import {
  RequirePermission,
  selectBrandWord,
  selectBusinesses,
  selectLocations,
  selectNumbers,
} from '@/features/bootstrap';
import {
  ALL_CHATS,
  chatScopeOptions,
  chooseChatScope,
  filterChanged,
  loadConversations,
  loadMoreConversations,
  searchChanged,
  selectChatFilter,
  selectChatQueryIsNarrowed,
  selectChatScope,
  selectChatScopeRestored,
  selectChatSearch,
  selectChatSort,
  selectConversations,
  selectConversationsError,
  selectConversationsLoadedAt,
  selectConversationsPage,
  selectConversationsStatus,
  selectConversationsTotal,
  selectHasMoreConversations,
  restoreChatScope,
  scopeIsStale,
  sortChanged,
  type ChatFilter,
  type ChatScope,
} from '@/features/conversations';
import { useLiveRefresh } from '@/features/realtime';
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
  const loadedAt = useAppSelector(selectConversationsLoadedAt);
  const page = useAppSelector(selectConversationsPage);
  const total = useAppSelector(selectConversationsTotal);
  const narrowed = useAppSelector(selectChatQueryIsNarrowed);
  const scope = useAppSelector(selectChatScope);
  const scopeRestored = useAppSelector(selectChatScopeRestored);
  const sort = useAppSelector(selectChatSort);
  const numbers = useAppSelector(selectNumbers);
  const businesses = useAppSelector(selectBusinesses);
  const locations = useAppSelector(selectLocations);
  const brandWord = useAppSelector(selectBrandWord);

  // ORG-01: the picker offers only what bootstrap listed, so a brand, branch or
  // number the server has stopped sending simply stops being offered.
  const scopeOptions = useMemo(
    () => chatScopeOptions(numbers, businesses, locations),
    [numbers, businesses, locations],
  );

  const [term, setTerm] = useState(search);

  // The term is sent to CHAT-01; the list is never filtered on the device.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === search) return;
    const timer = setTimeout(() => dispatch(searchChanged(trimmed)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, search, term]);

  // ORG-17: put back what this phone was last showing, before the first
  // request, so a restored brand is asked for once rather than the default
  // list being fetched and immediately replaced.
  useEffect(() => {
    if (!scopeRestored) void dispatch(restoreChatScope());
  }, [dispatch, scopeRestored]);

  // ORG-17: a brand, branch or number bootstrap has stopped listing is no
  // longer this person's to ask about - drop the choice rather than keep
  // sending an id the server will refuse.
  useEffect(() => {
    if (scopeRestored && scopeIsStale(scope, numbers, locations)) {
      void dispatch(chooseChatScope(ALL_CHATS));
    }
  }, [dispatch, scope, scopeRestored, numbers, locations]);

  // Mount, and every time the query changes. In-flight requests are cancelled
  // by the thunk, so a slow first page cannot land on top of a newer one.
  useEffect(() => {
    if (!scopeRestored) return;
    void dispatch(loadConversations());
  }, [dispatch, filter, search, scope, scopeRestored, sort]);

  const onRefresh = useCallback(() => {
    void dispatch(loadConversations({ refresh: true }));
  }, [dispatch]);

  // The REST fallback for live updates: quiet, so no spinner nobody pulled.
  // Not once the user has paged, though - page 1 would replace rows they
  // scrolled to. Pull-to-refresh stays theirs to choose.
  useLiveRefresh(
    useCallback(() => void dispatch(loadConversations({ quiet: true })), [dispatch]),
    { loadedAt, enabled: status !== 'failed' && page <= 1 },
  );

  const onEndReached = useCallback(() => {
    if (hasMore) void dispatch(loadMoreConversations());
  }, [dispatch, hasMore]);

  const onFilter = useCallback(
    (next: ChatFilter) => {
      dispatch(filterChanged(next));
    },
    [dispatch],
  );

  const onScope = useCallback(
    (next: ChatScope) => {
      // ORG-17: changing it and remembering it are the same step, so the two
      // can never drift apart.
      void dispatch(chooseChatScope(next));
    },
    [dispatch],
  );

  const onSort = useCallback(
    (next: ConversationSort) => {
      dispatch(sortChanged(next));
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
    // Design screen 5: the chats list sits on white, not the grey page background.
    <Screen edges={['top']} padded={false} background="surface">
      <View style={styles.header}>
        <AppText variant="h1" accessibilityRole="header">
          {Copy.title}
        </AppText>
      </View>

      {/* CHAT-01 (2026-10-19): both of these change the server query, not the
          rows already on screen. */}
      <ChatScopeBar
        scope={scope}
        options={scopeOptions}
        onScopeChange={onScope}
        sort={sort}
        onSortChange={onSort}
        brandWord={brandWord}
      />

      <ChatSearchField value={term} onChangeText={setTerm} />
      {/* The count belongs to the query on screen, so it is hidden while a new
          chip or search term is still loading - a stale number would mislead. */}
      <ChatFilterChips
        value={filter}
        onChange={onFilter}
        activeCount={status === 'loading' || status === 'failed' || status === 'idle' ? null : total}
      />

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
          ItemSeparatorComponent={RowDivider}
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
});
