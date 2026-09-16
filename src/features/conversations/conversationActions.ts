import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { Conversation, ConversationPriority } from '@/api/types';
import { threadConversationUpdated } from '@/features/messages/messagesSlice';
import { createAppAsyncThunk } from '@/store/hooks';

import { conversationPatched } from './conversationsSlice';

/**
 * CHAT-10, CHAT-11, CHAT-14, CHAT-15 and CHAT-18 all answer with the updated
 * Conversation, so every action patches the open thread and the listed row from
 * the response. Nothing is guessed locally and nothing is refetched.
 */
const applyResult = (
  conversationId: string,
  conversation: Conversation | null | undefined,
  dispatch: (action: unknown) => unknown,
) => {
  if (!conversation) return;
  dispatch(conversationPatched(conversation));
  dispatch(threadConversationUpdated({ conversationId, conversation }));
};

/** CHAT-10 */
export const resolveConversation = createAppAsyncThunk<void, { conversationId: string }>(
  'conversations/resolve',
  async ({ conversationId }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.resolveConversation(conversationId);
      applyResult(conversationId, data, dispatch);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

/**
 * CHAT-11. Reopening does **not** extend the 24-hour reply window: if it had
 * closed, the template path is still the only way to send.
 */
export const reopenConversation = createAppAsyncThunk<void, { conversationId: string }>(
  'conversations/reopen',
  async ({ conversationId }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.reopenConversation(conversationId);
      applyResult(conversationId, data, dispatch);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

/** CHAT-15 - needs `conversations.tag`. */
export const setConversationPriority = createAppAsyncThunk<
  void,
  { conversationId: string; priority: ConversationPriority }
>('conversations/setPriority', async ({ conversationId, priority }, { dispatch, rejectWithValue }) => {
  try {
    const { data } = await api.updateConversationPriority(conversationId, { priority });
    applyResult(conversationId, data, dispatch);
  } catch (error) {
    return rejectWithValue(normalizeError(error));
  }
});

/**
 * CHAT-14 - needs `conversations.tag`. The endpoint **replaces** the whole
 * list, so the caller sends every label the conversation should end up with.
 */
export const setConversationLabels = createAppAsyncThunk<
  void,
  { conversationId: string; labelIds: number[] }
>('conversations/setLabels', async ({ conversationId, labelIds }, { dispatch, rejectWithValue }) => {
  try {
    const { data } = await api.updateConversationLabels(conversationId, { label_ids: labelIds });
    applyResult(conversationId, data, dispatch);
  } catch (error) {
    return rejectWithValue(normalizeError(error));
  }
});

/** CHAT-18 - take the conversation over from the chatbot. */
export const stopChatbot = createAppAsyncThunk<void, { conversationId: string }>(
  'conversations/stopChatbot',
  async ({ conversationId }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.stopChatbot(conversationId);
      applyResult(conversationId, data, dispatch);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);
