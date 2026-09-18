import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, ContactNote } from '@/api/types';
import { appReset } from '@/store/actions';

export type ContactNotesStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'failed';

/**
 * CHAT-21/22. One contact at a time: notes are read inside a conversation, and
 * only ever for the contact of the chat on screen, so there is nothing to gain
 * from keeping a cache per contact - and a stale note from a chat the person no
 * longer has access to is exactly what should not linger.
 */
export type ContactNotesState = {
  contactId: number | null;
  items: ContactNote[];
  status: ContactNotesStatus;
  error: ApiError | null;
  /** A note is being posted; the composer stays disabled until it lands. */
  saving: boolean;
  /** Rejection of the POST specifically, shown under the composer. */
  saveError: ApiError | null;
};

const initialState: ContactNotesState = {
  contactId: null,
  items: [],
  status: 'idle',
  error: null,
  saving: false,
  saveError: null,
};

const contactNotesSlice = createSlice({
  name: 'contactNotes',
  initialState,
  reducers: {
    contactNotesLoading(state, action: PayloadAction<{ contactId: number; refresh: boolean }>) {
      const { contactId, refresh } = action.payload;
      // A different contact: drop the previous notes before the request, so the
      // screen can never show one contact's notes under another's name.
      if (state.contactId !== contactId) {
        state.contactId = contactId;
        state.items = [];
        state.error = null;
        state.saveError = null;
      }
      state.status = refresh && state.items.length > 0 ? 'refreshing' : 'loading';
    },
    contactNotesLoaded(state, action: PayloadAction<{ contactId: number; items: ContactNote[] }>) {
      // A response for a contact the screen has already moved away from.
      if (state.contactId !== action.payload.contactId) return;
      state.items = action.payload.items;
      state.status = 'ready';
      state.error = null;
    },
    contactNotesFailed(state, action: PayloadAction<{ contactId: number; error: ApiError }>) {
      if (state.contactId !== action.payload.contactId) return;
      state.error = action.payload.error;
      state.status = state.items.length > 0 ? 'ready' : 'failed';
    },
    contactNoteSaving(state) {
      state.saving = true;
      state.saveError = null;
    },
    contactNoteAdded(state, action: PayloadAction<{ contactId: number; note: ContactNote }>) {
      state.saving = false;
      state.saveError = null;
      if (state.contactId !== action.payload.contactId) return;
      // Newest first, matching the list order CHAT-21 returns.
      state.items = [action.payload.note, ...state.items];
    },
    contactNoteSaveFailed(state, action: PayloadAction<ApiError>) {
      state.saving = false;
      state.saveError = action.payload;
    },
    contactNoteRemoved(state, action: PayloadAction<number>) {
      state.items = state.items.filter((note) => note.id !== action.payload);
    },
    contactNotesClosed: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const {
  contactNotesLoading,
  contactNotesLoaded,
  contactNotesFailed,
  contactNoteSaving,
  contactNoteAdded,
  contactNoteSaveFailed,
  contactNoteRemoved,
  contactNotesClosed,
} = contactNotesSlice.actions;

export const contactNotesReducer = contactNotesSlice.reducer;
