import type { RootState } from '@/store/store';

export const selectConversations = (state: RootState) => state.conversations.items;
export const selectConversationsStatus = (state: RootState) => state.conversations.status;
export const selectConversationsError = (state: RootState) => state.conversations.error;
export const selectChatFilter = (state: RootState) => state.conversations.filter;
export const selectChatSearch = (state: RootState) => state.conversations.search;
export const selectConversationsTotal = (state: RootState) => state.conversations.total;

/** True while CHAT-01 reports pages the app has not fetched yet. */
export const selectHasMoreConversations = (state: RootState) =>
  state.conversations.page > 0 && state.conversations.page < state.conversations.lastPage;

/** True when the list is empty because of a filter or search, not because there is nothing. */
export const selectChatQueryIsNarrowed = (state: RootState) =>
  state.conversations.filter !== 'mine' || state.conversations.search.length > 0;

/** The listed row for a thread, used as the header until CHAT-02 meta arrives. */
export const selectConversationById = (conversationId: string) => (state: RootState) =>
  state.conversations.items.find((item) => String(item.id) === String(conversationId)) ?? null;
