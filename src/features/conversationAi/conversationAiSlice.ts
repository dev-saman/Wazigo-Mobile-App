import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AiStatus, ApiError } from '@/api/types';
import { appReset } from '@/store/actions';

/**
 * CHAT-24 to CHAT-26. What the AI is doing in one chat, and whether a request
 * about it is in flight.
 *
 * Kept per conversation because the thread screen is the only place it is
 * shown, and the answer is only ever about the chat on screen.
 */
export type ConversationAiEntry = {
  status: AiStatus | null;
  loading: boolean;
  /** A pause or resume is in flight: the button is disabled, not hidden. */
  busy: boolean;
  error: ApiError | null;
};

export type ConversationAiState = {
  byConversation: Record<string, ConversationAiEntry>;
};

const initialState: ConversationAiState = { byConversation: {} };

const EMPTY: ConversationAiEntry = { status: null, loading: false, busy: false, error: null };

const entryOf = (state: ConversationAiState, conversationId: string): ConversationAiEntry => {
  if (!state.byConversation[conversationId]) {
    state.byConversation[conversationId] = { ...EMPTY };
  }
  return state.byConversation[conversationId];
};

const conversationAiSlice = createSlice({
  name: 'conversationAi',
  initialState,
  reducers: {
    aiLoading(state, action: PayloadAction<{ conversationId: string }>) {
      const entry = entryOf(state, action.payload.conversationId);
      entry.loading = true;
      entry.error = null;
    },
    aiLoaded(state, action: PayloadAction<{ conversationId: string; status: AiStatus }>) {
      const entry = entryOf(state, action.payload.conversationId);
      entry.status = action.payload.status;
      entry.loading = false;
      entry.busy = false;
      entry.error = null;
    },
    aiFailed(state, action: PayloadAction<{ conversationId: string; error: ApiError }>) {
      const entry = entryOf(state, action.payload.conversationId);
      entry.loading = false;
      entry.busy = false;
      // Keep the last known status: a bar that vanishes on a timeout is worse
      // than one that is a few seconds out of date.
      entry.error = action.payload.error;
    },
    aiBusy(state, action: PayloadAction<{ conversationId: string; busy: boolean }>) {
      entryOf(state, action.payload.conversationId).busy = action.payload.busy;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { aiLoading, aiLoaded, aiFailed, aiBusy } = conversationAiSlice.actions;
export const conversationAiReducer = conversationAiSlice.reducer;
