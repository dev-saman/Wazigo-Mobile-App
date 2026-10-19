import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import { createAppAsyncThunk } from '@/store/hooks';

import { threadConversationUpdated, threadFailed, threadLoaded, threadLoading } from './messagesSlice';

const PER_PAGE = 30;

/**
 * What CHAT-23 decided about a chat the app was asked to open from outside -
 * a push tap or a link.
 *
 * `gone` is the only answer that stops the app opening the chat: a 404 means
 * this person may no longer see it. The workbook is explicit that nothing else
 * may be opened in its place, because quietly landing someone in a different
 * customer's chat is worse than telling them this one is unavailable.
 *
 * `unknown` is a network failure or a 5xx, which says nothing about access -
 * open the chat and let the thread screen report the problem in context.
 */
export type OpenChatOutcome = 'ok' | 'gone' | 'unknown';

/**
 * CHAT-23. Asks the server for one chat before its messages are loaded, which
 * is both the access check and the freshest header the app can have: the push
 * was composed before it was delivered, and access may have changed since.
 */
export const checkChatBeforeOpening = createAppAsyncThunk<
  OpenChatOutcome,
  { conversationId: string }
>('messages/checkChatBeforeOpening', async ({ conversationId }, { dispatch }) => {
  try {
    const { data } = await api.getConversation(conversationId);
    if (data) dispatch(threadConversationUpdated({ conversationId, conversation: data }));
    return 'ok';
  } catch (error) {
    return normalizeError(error).code === 'NOT_FOUND' ? 'gone' : 'unknown';
  }
});

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
