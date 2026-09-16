import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '@/store/store';

import { emptyThread, type ThreadState } from './messagesSlice';

const selectThreads = (state: RootState) => state.messages.byConversation;

/** Never returns undefined: an unopened thread reads as an empty, idle one. */
export const selectThread = (conversationId: string) =>
  createSelector([selectThreads], (threads): ThreadState => threads[conversationId] ?? emptyThread);

export const selectThreadMessages = (conversationId: string) => (state: RootState) =>
  state.messages.byConversation[conversationId]?.items ?? emptyThread.items;

export const selectThreadStatus = (conversationId: string) => (state: RootState) =>
  state.messages.byConversation[conversationId]?.status ?? 'idle';

export const selectThreadConversation = (conversationId: string) => (state: RootState) =>
  state.messages.byConversation[conversationId]?.conversation ?? null;

export const selectThreadError = (conversationId: string) => (state: RootState) =>
  state.messages.byConversation[conversationId]?.error ?? null;

/** True while CHAT-02 reports older pages the app has not fetched. */
export const selectHasOlderMessages = (conversationId: string) => (state: RootState) => {
  const thread = state.messages.byConversation[conversationId];
  return !!thread && thread.page > 0 && thread.page < thread.lastPage;
};
