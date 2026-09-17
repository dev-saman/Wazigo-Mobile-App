import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import { createAppAsyncThunk } from '@/store/hooks';

import { threadFailed, threadLoaded, threadLoading } from './messagesSlice';

const PER_PAGE = 30;

/**
 * CHAT-02. The page is newest-first and `meta.conversation` carries the thread
 * itself, which is fresher than the row the user tapped - that row may have
 * been listed minutes ago.
 *
 * `merge` (live updates) keeps older history the user has already loaded.
 */
export const loadThread = createAppAsyncThunk<
  void,
  { conversationId: string; quiet?: boolean; merge?: boolean }
>(
  'messages/loadThread',
  async ({ conversationId, quiet = false, merge = false }, { dispatch, rejectWithValue }) => {
    // A quiet reload (foreground, reconnect) must not blank a thread the user
    // is reading: no loading status, so the skeleton never replaces it.
    if (!quiet) dispatch(threadLoading({ conversationId, older: false }));
    try {
      const { data, meta } = await api.getConversationMessages(conversationId, {
        page: 1,
        per_page: PER_PAGE,
      });
      dispatch(
        threadLoaded({
          conversationId,
          items: Array.isArray(data) ? data : [],
          page: meta?.current_page ?? 1,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? (Array.isArray(data) ? data.length : 0),
          older: false,
          conversation: meta?.conversation ?? null,
          merge,
        }),
      );
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(threadFailed({ conversationId, error: apiError }));
      return rejectWithValue(apiError);
    }
  },
);

/** The next CHAT-02 page, which is older history. No-op on the last page. */
export const loadOlderMessages = createAppAsyncThunk<void, { conversationId: string }>(
  'messages/loadOlder',
  async ({ conversationId }, { dispatch, getState, rejectWithValue }) => {
    const thread = getState().messages.byConversation[conversationId];
    if (!thread || thread.status !== 'ready' || thread.page >= thread.lastPage) return;

    dispatch(threadLoading({ conversationId, older: true }));
    try {
      const { data, meta } = await api.getConversationMessages(conversationId, {
        page: thread.page + 1,
        per_page: PER_PAGE,
      });
      dispatch(
        threadLoaded({
          conversationId,
          items: Array.isArray(data) ? data : [],
          page: meta?.current_page ?? thread.page + 1,
          lastPage: meta?.last_page ?? thread.lastPage,
          total: meta?.total ?? thread.total,
          older: true,
          conversation: meta?.conversation ?? null,
        }),
      );
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(threadFailed({ conversationId, error: apiError }));
      return rejectWithValue(apiError);
    }
  },
);
