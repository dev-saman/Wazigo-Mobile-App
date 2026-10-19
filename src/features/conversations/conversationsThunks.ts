import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { ConversationListParams, ConversationSort } from '@/api/types';
import { threadConversationUpdated } from '@/features/messages/messagesSlice';
import { createAppAsyncThunk } from '@/store/hooks';

import { numberIdsForScope, type ChatScope } from './chatScope';
import {
  conversationPatched,
  conversationsFailed,
  conversationsLoaded,
  conversationsLoading,
  type ChatFilter,
  type LoadMode,
} from './conversationsSlice';

const PER_PAGE = 20;

/**
 * Every chip is a CHAT-01 query. Filtering on the device is never the fix for
 * the personal-scope blocker, so each one narrows the request instead.
 */
const FILTER_PARAMS: Record<ChatFilter, ConversationListParams> = {
  mine: { assigned: 'mine' },
  unread: { assigned: 'mine', unread: 1 },
  open: { assigned: 'mine', status: 'open' },
  urgent: { assigned: 'mine', priority: 'urgent' },
  unassigned: { assigned: 'unassigned' },
};

/**
 * One list request at a time. A new filter, a new search term or a refresh
 * cancels the previous call, so a slow reply cannot overwrite a newer one.
 */
let inFlight: AbortController | null = null;

/**
 * CHAT-01 (2026-10-19): one number is `number_id`, several are `number_ids[]`,
 * and the workbook is explicit that both forms must never go in one request.
 */
const scopeParams = (numberIds: number[] | null): ConversationListParams => {
  if (numberIds === null) return {};
  if (numberIds.length === 1) return { number_id: numberIds[0] };
  return { number_ids: numberIds };
};

type Query = {
  filter: ChatFilter;
  search: string;
  sort: ConversationSort;
  numberIds: number[] | null;
};

const fetchPage = async (query: Query, page: number) => {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  const params: ConversationListParams = {
    ...FILTER_PARAMS[query.filter],
    ...scopeParams(query.numberIds),
    page,
    per_page: PER_PAGE,
    ...(query.search ? { search: query.search } : {}),
    // `newest` is the server's own default; sending it changes nothing, so the
    // query stays as small as the question actually is.
    ...(query.sort === 'newest' ? {} : { sort: query.sort }),
  };

  try {
    return await api.getConversations(params, { signal: controller.signal });
  } finally {
    if (inFlight === controller) inFlight = null;
  }
};

/**
 * The query the current state describes. The numbers come from bootstrap, so a
 * brand or branch the server has stopped listing resolves to nothing rather
 * than to a stale id.
 */
const queryFor = (state: {
  conversations: { filter: ChatFilter; search: string; sort: ConversationSort; scope: ChatScope };
  bootstrap: { numbers: Parameters<typeof numberIdsForScope>[1]; locations: Parameters<typeof numberIdsForScope>[2] };
}): Query => ({
  filter: state.conversations.filter,
  search: state.conversations.search,
  sort: state.conversations.sort,
  numberIds: numberIdsForScope(
    state.conversations.scope,
    state.bootstrap.numbers,
    state.bootstrap.locations,
  ),
});

/**
 * CHAT-01, page 1. `refresh` keeps the current rows visible while it runs;
 * `quiet` also leaves the status alone, for the foreground/reconnect refresh
 * that the user did not ask for - a spinner nobody pulled looks like a fault.
 * `merge` (live updates) keeps pages the user has already scrolled to.
 */
export const loadConversations = createAppAsyncThunk<
  void,
  { refresh?: boolean; quiet?: boolean; merge?: boolean } | void
>(
  'conversations/load',
  async (arg, { dispatch, getState, rejectWithValue }) => {
    const query = queryFor(getState());
    const quiet = !!(arg && arg.quiet);
    const merge = !!(arg && arg.merge);
    const mode: LoadMode = arg && (arg.refresh || arg.quiet) ? 'refresh' : 'initial';
    if (!quiet) dispatch(conversationsLoading({ mode }));

    // A brand or branch that covers none of this person's numbers: an empty
    // `number_ids` would read as "no filter" and quietly show every chat, so
    // the question is answered here instead of asked.
    if (query.numberIds !== null && query.numberIds.length === 0) {
      dispatch(
        conversationsLoaded({ items: [], page: 1, lastPage: 1, total: 0, mode, merge: false }),
      );
      return;
    }

    try {
      const { data, meta } = await fetchPage(query, 1);
      dispatch(
        conversationsLoaded({
          items: Array.isArray(data) ? data : [],
          page: meta?.current_page ?? 1,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? (Array.isArray(data) ? data.length : 0),
          mode,
          merge,
        }),
      );
    } catch (error) {
      const apiError = normalizeError(error);
      // A cancelled request was replaced by a newer one: it is not a failure.
      if (apiError.code !== 'CANCELLED') dispatch(conversationsFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/** The next CHAT-01 page. Does nothing on the last page or while busy. */
export const loadMoreConversations = createAppAsyncThunk<void, void>(
  'conversations/loadMore',
  async (_, { dispatch, getState, rejectWithValue }) => {
    const state = getState();
    const { page, lastPage, status } = state.conversations;
    if (status !== 'ready' || page >= lastPage) return;

    const query = queryFor(state);
    dispatch(conversationsLoading({ mode: 'more' }));
    try {
      const { data, meta } = await fetchPage(query, page + 1);
      dispatch(
        conversationsLoaded({
          items: Array.isArray(data) ? data : [],
          page: meta?.current_page ?? page + 1,
          lastPage: meta?.last_page ?? lastPage,
          total: meta?.total ?? 0,
          mode: 'more',
        }),
      );
    } catch (error) {
      const apiError = normalizeError(error);
      if (apiError.code !== 'CANCELLED') dispatch(conversationsFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/**
 * CHAT-06. Returns the updated Conversation, so the list row and the open
 * thread are patched from the response instead of being refetched.
 */
export const markConversationRead = createAppAsyncThunk<void, { conversationId: string }>(
  'conversations/markRead',
  async ({ conversationId }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.markConversationRead(conversationId);
      if (data) {
        dispatch(conversationPatched(data));
        dispatch(threadConversationUpdated({ conversationId, conversation: data }));
      }
    } catch (error) {
      // Silent: failing to clear a badge must never interrupt reading a chat.
      return rejectWithValue(normalizeError(error));
    }
  },
);
