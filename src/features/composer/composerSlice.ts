import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { appReset } from '@/store/actions';
import type { RootState } from '@/store/store';

/**
 * Unsent message drafts, keyed by conversation id.
 *
 * This lives in the store rather than in the thread screen's own state for one
 * concrete reason: the CHAT-20 quick-replies picker is a separate route, so the
 * thread screen is not mounted when a reply is chosen. Passing the text back
 * through an effect meant calling setState inside useEffect on return, which
 * causes the cascading render the React Compiler rule warns about. Writing
 * straight into the store removes the effect entirely.
 *
 * Drafts surviving a trip to the picker (or to the template screen and back) is
 * the behaviour a person expects anyway - a half-typed sentence should still be
 * there. Not persisted to disk: an unsent draft is session state.
 */
export type ComposerState = {
  drafts: Record<string, string>;
};

const initialState: ComposerState = { drafts: {} };

const composerSlice = createSlice({
  name: 'composer',
  initialState,
  reducers: {
    draftChanged(state, action: PayloadAction<{ conversationId: string; text: string }>) {
      const { conversationId, text } = action.payload;
      if (text) state.drafts[conversationId] = text;
      else delete state.drafts[conversationId];
    },
    /** CHAT-20: a saved reply joins whatever was already typed. */
    draftAppended(state, action: PayloadAction<{ conversationId: string; text: string }>) {
      const { conversationId, text } = action.payload;
      if (!text) return;
      const existing = (state.drafts[conversationId] ?? '').trimEnd();
      state.drafts[conversationId] = existing ? `${existing} ${text}` : text;
    },
    draftCleared(state, action: PayloadAction<string>) {
      delete state.drafts[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { draftChanged, draftAppended, draftCleared } = composerSlice.actions;
export const composerReducer = composerSlice.reducer;

export const selectDraft = (conversationId: string) => (state: RootState) =>
  state.composer.drafts[conversationId] ?? '';
