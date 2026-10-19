import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, Conversation, ConversationSort } from '@/api/types';
import { appReset } from '@/store/actions';

import { ALL_CHATS, type ChatScope } from './chatScope';

/**
 * One chip = one server-side query. Every view except `unassigned` stays
 * scoped to the signed-in user, which is the closest CHAT-01 comes to the
 * personal list this app promises.
 */
export const ChatFilters = ['mine', 'unread', 'open', 'urgent', 'unassigned'] as const;
export type ChatFilter = (typeof ChatFilters)[number];

export type ConversationsStatus =
  | 'idle'
  | 'loading'
  /** Pull-to-refresh over rows that are already on screen. */
  | 'refreshing'
  /** Fetching the next page; the current rows stay put. */
  | 'loadingMore'
  | 'ready'
  | 'failed';

export type LoadMode = 'initial' | 'refresh' | 'more';

export type ConversationsState = {
  items: Conversation[];
  status: ConversationsStatus;
  error: ApiError | null;
  filter: ChatFilter;
  /**
   * CHAT-01 (2026-10-19). Which brand, branch or number the list is asking
   * about. Not persisted here: ORG-17 wants the choice kept per account and
   * user, which belongs with the brand switcher rather than this slice.
   */
  scope: ChatScope;
  /** CHAT-01 (2026-10-19). `newest` is the server's own default. */
  sort: ConversationSort;
  /** The term actually sent to the API (already debounced by the screen). */
  search: string;
  page: number;
  lastPage: number;
  total: number;
  /** When page 1 last arrived, for the foreground/reconnect refresh. */
  loadedAt: number | null;
};

const initialState: ConversationsState = {
  items: [],
  status: 'idle',
  error: null,
  filter: 'mine',
  scope: ALL_CHATS,
  sort: 'newest',
  search: '',
  page: 0,
  lastPage: 1,
  total: 0,
  loadedAt: null,
};

/** Keeps the server's order while making sure a row never appears twice. */
const mergeById = (existing: Conversation[], incoming: Conversation[]): Conversation[] => {
  const seen = new Set(existing.map((item) => item.id));
  return existing.concat(incoming.filter((item) => item && !seen.has(item.id)));
};

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    conversationsLoading(state, action: PayloadAction<{ mode: LoadMode }>) {
      const { mode } = action.payload;
      state.status = mode === 'refresh' ? 'refreshing' : mode === 'more' ? 'loadingMore' : 'loading';
      state.error = null;
    },
    conversationsLoaded(
      state,
      action: PayloadAction<{
        items: Conversation[];
        page: number;
        lastPage: number;
        total: number;
        mode: LoadMode;
        /**
         * A live update of page 1 while the user has paged further: page 1
         * goes on top in the server's order and the rows they scrolled to stay
         * below it, instead of being replaced.
         */
        merge?: boolean;
      }>,
    ) {
      const { items, page, lastPage, total, mode, merge } = action.payload;
      const keepPages = !!merge && mode !== 'more' && state.page > 1;
      if (keepPages) {
        const fresh = new Set(items.map((item) => item.id));
        state.items = items.concat(state.items.filter((item) => !fresh.has(item.id)));
        state.page = Math.max(state.page, page);
        state.lastPage = Math.max(lastPage, state.page);
      } else {
        state.items = mode === 'more' ? mergeById(state.items, items) : items;
        state.page = page;
        state.lastPage = lastPage;
      }
      state.total = total;
      state.status = 'ready';
      state.error = null;
      if (mode !== 'more') state.loadedAt = Date.now();
    },
    conversationsFailed(state, action: PayloadAction<ApiError>) {
      state.error = action.payload;
      // A failed refresh or next page keeps whatever is already listed.
      state.status = state.items.length > 0 ? 'ready' : 'failed';
    },
    /**
     * Replaces one row with the server's latest copy (CHAT-06 and the Stage 11
     * actions all return the updated Conversation). Rows the current query does
     * not contain are ignored rather than inserted out of order.
     */
    conversationPatched(state, action: PayloadAction<Conversation>) {
      const index = state.items.findIndex((item) => item.id === action.payload.id);
      if (index >= 0) state.items[index] = action.payload;
    },
    filterChanged(state, action: PayloadAction<ChatFilter>) {
      if (state.filter === action.payload) return;
      state.filter = action.payload;
      // The rows below belong to the previous query; drop them before reloading.
      state.items = [];
      state.page = 0;
      state.lastPage = 1;
      state.total = 0;
      state.loadedAt = null;
      state.status = 'loading';
      state.error = null;
    },
    searchChanged(state, action: PayloadAction<string>) {
      if (state.search === action.payload) return;
      state.search = action.payload;
      state.items = [];
      state.page = 0;
      state.lastPage = 1;
      state.total = 0;
      state.loadedAt = null;
      state.status = 'loading';
      state.error = null;
    },
    /**
     * CHAT-01 (2026-10-19). A different brand, branch or number is a different
     * server query, so the rows below belong to the old one and go.
     */
    scopeChanged(state, action: PayloadAction<ChatScope>) {
      if (state.scope.kind === action.payload.kind && state.scope.id === action.payload.id) return;
      state.scope = action.payload;
      state.items = [];
      state.page = 0;
      state.lastPage = 1;
      state.total = 0;
      state.loadedAt = null;
      state.status = 'loading';
      state.error = null;
    },
    /** CHAT-01 (2026-10-19). The server orders the list; the app never re-sorts. */
    sortChanged(state, action: PayloadAction<ConversationSort>) {
      if (state.sort === action.payload) return;
      state.sort = action.payload;
      state.items = [];
      state.page = 0;
      state.lastPage = 1;
      state.total = 0;
      state.loadedAt = null;
      state.status = 'loading';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const {
  conversationsLoading,
  conversationsLoaded,
  conversationsFailed,
  conversationPatched,
  filterChanged,
  searchChanged,
  scopeChanged,
  sortChanged,
} = conversationsSlice.actions;

export const conversationsReducer = conversationsSlice.reducer;
