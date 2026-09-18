import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import { createAppAsyncThunk } from '@/store/hooks';

import {
  contactNoteAdded,
  contactNoteSaveFailed,
  contactNoteSaving,
  contactNotesFailed,
  contactNotesLoaded,
  contactNotesLoading,
} from './contactNotesSlice';

/** CHAT-21 — newest first, as the server returns them. */
export const loadContactNotes = createAppAsyncThunk<void, { contactId: number; refresh?: boolean }>(
  'contactNotes/load',
  async ({ contactId, refresh }, { dispatch, rejectWithValue }) => {
    dispatch(contactNotesLoading({ contactId, refresh: !!refresh }));
    try {
      const { data } = await api.getContactNotes(contactId);
      dispatch(contactNotesLoaded({ contactId, items: Array.isArray(data) ? data : [] }));
    } catch (error) {
      const apiError = normalizeError(error);
      if (apiError.code !== 'CANCELLED') dispatch(contactNotesFailed({ contactId, error: apiError }));
      return rejectWithValue(apiError);
    }
  },
);

/**
 * CHAT-22 — append on success. Not optimistic: an internal note that silently
 * failed to save is worse than one that took a moment to appear, because the
 * person would believe a colleague can see it.
 */
export const addContactNote = createAppAsyncThunk<void, { contactId: number; body: string }>(
  'contactNotes/add',
  async ({ contactId, body }, { dispatch, rejectWithValue }) => {
    dispatch(contactNoteSaving());
    try {
      const { data } = await api.createContactNote(contactId, { body });
      if (data) dispatch(contactNoteAdded({ contactId, note: data }));
      else void dispatch(loadContactNotes({ contactId, refresh: true }));
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(contactNoteSaveFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);
