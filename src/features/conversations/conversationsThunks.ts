import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { ConversationListParams } from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import {
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

const fetchPage = async (filter: ChatFilter, search: string, page: number) => {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  const params: ConversationListParams = {
    ...FILTER_PARAMS[filter],
    page,
    per_page: PER_PAGE,
    ...(search ? { search } : {}),
  };

  try {
    return await api.getConversations(params, { signal: controller.signal });
  } finally {
    if (inFlight === controller) inFlight = null;
  }
};

/** CHAT-01, page 1. `refresh` keeps the current rows visible while it runs. */
export const loadConversations = createAppAsyncThunk<void, { refresh?: boolean } | void>(
  'conversations/load',
  async (arg, { dispatch, getState, rejectWithValue }) => {
    const { filter, search } = getState().conversations;
    const mode: LoadMode = arg && arg.refresh ? 'refresh' : 'initial';
    dispatch(conversationsLoading({ mode }));

    try {
      const { data, meta } = await fetchPage(filter, search, 1);
      dispatch(
        conversationsLoaded({
          items: Array.isArray(data) ? data : [],
          page: meta?.current_page ?? 1,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? (Array.isArray(data) ? data.length : 0),
          mode,
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
    const { filter, search, page, lastPage, status } = getState().conversations;
    if (status !== 'ready' || page >= lastPage) return;

    dispatch(conversationsLoading({ mode: 'more' }));
    try {
      const { data, meta } = await fetchPage(filter, search, page + 1);
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
