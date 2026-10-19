import type { RootState } from '@/store/store';

import type { FollowUpsEntry } from './followUpsSlice';

const EMPTY: FollowUpsEntry = {
  items: [],
  canCreate: false,
  limit: null,
  status: 'idle',
  busyId: null,
  creating: false,
  error: null,
};

export const selectFollowUps = (conversationId: string) => (state: RootState) =>
  state.followUps.byConversation[conversationId] ?? EMPTY;

/**
 * CHAT-28. How many open ones there are, for the badge on the chat's menu.
 * "Open" here is the server's own word: open, acknowledged or snoozed are all
 * still outstanding, and only done and cancelled are finished.
 */
export const selectOpenFollowUpCount = (conversationId: string) => (state: RootState) =>
  (state.followUps.byConversation[conversationId]?.items ?? []).filter(
    (item) => item.status !== 'done' && item.status !== 'cancelled',
  ).length;
