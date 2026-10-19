import type { RootState } from '@/store/store';

import { numberIdsForScope } from './chatScope';

export const selectConversations = (state: RootState) => state.conversations.items;
export const selectConversationsStatus = (state: RootState) => state.conversations.status;
export const selectConversationsError = (state: RootState) => state.conversations.error;
export const selectChatFilter = (state: RootState) => state.conversations.filter;
export const selectChatSearch = (state: RootState) => state.conversations.search;
export const selectConversationsTotal = (state: RootState) => state.conversations.total;
export const selectConversationsLoadedAt = (state: RootState) => state.conversations.loadedAt;
export const selectConversationsPage = (state: RootState) => state.conversations.page;

/** True while CHAT-01 reports pages the app has not fetched yet. */
export const selectHasMoreConversations = (state: RootState) =>
  state.conversations.page > 0 && state.conversations.page < state.conversations.lastPage;

/** True when the list is empty because of a filter or search, not because there is nothing. */
export const selectChatQueryIsNarrowed = (state: RootState) =>
  state.conversations.filter !== 'mine' || state.conversations.search.length > 0;

/** The listed row for a thread, used as the header until CHAT-02 meta arrives. */
export const selectConversationById = (conversationId: string) => (state: RootState) =>
  state.conversations.items.find((item) => String(item.id) === String(conversationId)) ?? null;

/** CHAT-01 (2026-10-19). Which brand, branch or number the list is asking about. */
export const selectChatScope = (state: RootState) => state.conversations.scope;
export const selectChatSort = (state: RootState) => state.conversations.sort;
/** ORG-17. The list waits for this before its first request. */
export const selectChatScopeRestored = (state: RootState) => state.conversations.scopeRestored;

/**
 * REP-01 takes the same choice as a brand, or as a set of numbers. A branch or
 * a single number is sent as `numbers[]`, because the Report API has no
 * concept of a branch.
 */
export const selectReportScopeParams = (state: RootState) => {
  const { scope } = state.conversations;
  if (scope.kind === 'brand' && scope.id !== null) return { business_id: scope.id };
  const numberIds = numberIdsForScope(scope, state.bootstrap.numbers, state.bootstrap.locations);
  return numberIds && numberIds.length > 0 ? { numbers: numberIds } : {};
};
