import type { RootState } from '@/store/store';

const EMPTY = { status: null, loading: false, busy: false, error: null } as const;

export const selectConversationAi = (conversationId: string) => (state: RootState) =>
  state.conversationAi.byConversation[conversationId] ?? EMPTY;

/** CHAT-24. Null until the first answer arrives, or where the AI is off. */
export const selectConversationAiStatus = (conversationId: string) => (state: RootState) =>
  state.conversationAi.byConversation[conversationId]?.status ?? null;

export const selectConversationAiBusy = (conversationId: string) => (state: RootState) =>
  state.conversationAi.byConversation[conversationId]?.busy ?? false;
