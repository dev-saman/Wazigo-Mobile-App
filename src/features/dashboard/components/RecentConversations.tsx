import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import type { Conversation } from '@/api/types';
import { ConversationRow, ConversationRowDivider } from '@/components/chat/ConversationRow';
import { AppText, Button, Card } from '@/components/common';
import { ChatRowSkeleton } from '@/components/feedback';
import { Layout, Spacing } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import { selectRecentConversations, selectRecentConversationsStatus } from '../dashboardSelectors';
import { loadRecentConversations, RECENT_CONVERSATIONS_COUNT } from '../dashboardThunks';

const Copy = {
  title: 'Recent Conversations',
  seeAll: 'See all',
  seeAllLabel: 'See all conversations',
  empty: 'No conversations yet. When customers message you, they will appear here.',
  failed: 'We could not load your recent conversations.',
  retry: 'Retry',
  retryLabel: 'Retry loading recent conversations',
};

/**
 * Design screen 4: the agent's newest conversations, with "See all" opening the
 * Chats tab. Rows are the Chats tab's own, so both screens read identically.
 *
 * Personal scope comes from the server (`assigned=mine`), exactly as on the
 * Chats tab - including backend blocker 1 until it is fixed.
 */
export function RecentConversations() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectRecentConversations);
  const status = useAppSelector(selectRecentConversationsStatus);

  const openConversation = useCallback((conversation: Conversation) => {
    router.push({ pathname: '/chats/[id]', params: { id: String(conversation.id) } });
  }, []);

  const loading = status === 'idle' || status === 'loading';

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText variant="sectionTitle" accessibilityRole="header">
          {Copy.title}
        </AppText>
        <Pressable
          onPress={() => router.navigate('/chats')}
          accessibilityRole="link"
          accessibilityLabel={Copy.seeAllLabel}
          hitSlop={12}
        >
          <AppText variant="label" color="primary">
            {Copy.seeAll}
          </AppText>
        </Pressable>
      </View>

      <Card padded={false} style={styles.card}>
        {loading ? (
          <View
            style={styles.skeleton}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Loading recent conversations"
          >
            {Array.from({ length: RECENT_CONVERSATIONS_COUNT }, (_, index) => (
              <ChatRowSkeleton key={index} />
            ))}
          </View>
        ) : status === 'failed' ? (
          <View style={styles.message} accessibilityLiveRegion="polite">
            <AppText variant="bodySmall" color="textSecondary" align="center">
              {Copy.failed}
            </AppText>
            <Button
              title={Copy.retry}
              accessibilityLabel={Copy.retryLabel}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => void dispatch(loadRecentConversations())}
            />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.message}>
            <AppText variant="bodySmall" color="textSecondary" align="center">
              {Copy.empty}
            </AppText>
          </View>
        ) : (
          // The same inset dividers as the Chats tab (design screen 5).
          items.map((conversation, index) => (
            <View key={conversation.id}>
              {index > 0 ? <ConversationRowDivider /> : null}
              <ConversationRow conversation={conversation} onPress={openConversation} />
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The rows bring their own horizontal padding; the card clips their press state.
  card: { overflow: 'hidden' },
  skeleton: { paddingHorizontal: Layout.screenPadding },
  message: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg },
});
