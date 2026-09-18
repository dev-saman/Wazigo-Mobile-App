import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import type { CannedMessage } from '@/api/types';
import { CannedReplyListItem, ChatSearchField } from '@/components/chat';
import { AppText, IconButton, Screen } from '@/components/common';
import { ErrorState, SkeletonList, StaleDataBanner, StateView } from '@/components/feedback';
import { Colors, Layout, Spacing } from '@/constants/theme';
import {
  fillCannedBody,
  loadCannedMessages,
  matchesCannedSearch,
  selectCannedMessages,
  selectCannedMessagesError,
  selectCannedMessagesStatus,
} from '@/features/cannedMessages';
import { draftAppended } from '@/features/composer';
import { selectThreadConversation } from '@/features/messages';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  title: 'Quick replies',
  back: 'Back',
  search: 'Search quick replies',
  emptyTitle: 'No quick replies yet',
  emptyDescription: 'Saved replies are created in the Wazigo dashboard.',
  noMatchTitle: 'No matching replies',
  noMatchDescription: 'Try a different word, or the reply’s shortcut.',
  failedTitle: 'We could not load your quick replies',
  retryLabel: 'Retry loading your quick replies',
  stale: 'Showing the replies we already loaded',
  hint: 'Tap a reply to put it in the message box. Nothing is sent until you press send.',
};

/**
 * CHAT-20. A read-only picker: it never sends. The chosen body goes into the
 * composer so the person can edit it first and send it through CHAT-03 like
 * anything they typed - which is also what makes a half-filled `{{…}}`
 * variable safe to leave in.
 */
function QuickRepliesScreen({ conversationId }: { conversationId: string }) {
  const dispatch = useAppDispatch();
  const replies = useAppSelector(selectCannedMessages);
  const status = useAppSelector(selectCannedMessagesStatus);
  const error = useAppSelector(selectCannedMessagesError);
  const conversation = useAppSelector(selectThreadConversation(conversationId));

  const [term, setTerm] = useState('');

  useEffect(() => {
    void dispatch(loadCannedMessages());
  }, [dispatch]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/chats/[id]', params: { id: conversationId } });
  }, [conversationId]);

  // The endpoint is unpaged, so filtering happens here rather than round-tripping.
  const visible = useMemo(
    () => replies.filter((reply) => matchesCannedSearch(reply, term)),
    [replies, term],
  );

  const choose = useCallback(
    (reply: CannedMessage) => {
      dispatch(
        draftAppended({
          conversationId,
          text: fillCannedBody(reply.body ?? '', conversation?.contact),
        }),
      );
      goBack();
    },
    [conversationId, conversation?.contact, dispatch, goBack],
  );

  const renderItem = useCallback(
    ({ item }: { item: CannedMessage }) => (
      <CannedReplyListItem reply={item} contact={conversation?.contact} onPress={choose} />
    ),
    [choose, conversation?.contact],
  );

  const narrowed = term.trim().length > 0;

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" accessibilityLabel={Copy.back} onPress={goBack} />
        <AppText variant="h2" accessibilityRole="header" style={styles.headerTitle}>
          {Copy.title}
        </AppText>
      </View>

      {status === 'loading' ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={6} avatar={false} label="Loading your quick replies" />
        </View>
      ) : status === 'failed' ? (
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadCannedMessages())}
          retryAccessibilityLabel={Copy.retryLabel}
        />
      ) : (
        <>
          <ChatSearchField value={term} onChangeText={setTerm} placeholder={Copy.search} />
          <View style={styles.stale}>
            <StaleDataBanner error={error} title={Copy.stale} />
          </View>
          <FlatList
            data={visible}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={visible.length === 0 ? styles.emptyContent : styles.listContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              visible.length > 0 ? (
                <AppText variant="caption" color="textMuted" style={styles.hint}>
                  {Copy.hint}
                </AppText>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={status === 'refreshing'}
                onRefresh={() => void dispatch(loadCannedMessages({ refresh: true }))}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            ListEmptyComponent={
              <StateView
                icon="flash-outline"
                tone="neutral"
                title={narrowed ? Copy.noMatchTitle : Copy.emptyTitle}
                description={narrowed ? Copy.noMatchDescription : Copy.emptyDescription}
              />
            }
          />
        </>
      )}
    </Screen>
  );
}

const Separator = () => <View style={styles.separator} />;

export default function QuickRepliesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <Screen>
        <StateView
          icon="help-circle-outline"
          tone="neutral"
          title="Conversation unavailable"
          description="This conversation is no longer available."
          actionLabel="Back to chats"
          onAction={() => router.replace('/chats')}
        />
      </Screen>
    );
  }

  return <QuickRepliesScreen conversationId={String(id)} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { flex: 1 },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.sm },
  stale: { paddingHorizontal: Layout.screenPadding },
  hint: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.sm },
  listContent: { paddingBottom: Spacing.xxl },
  emptyContent: { flexGrow: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginLeft: Layout.screenPadding,
  },
});
