import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, Conversation } from '@/api/types';
import { appReset } from '@/store/actions';

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
  /** The term actually sent to the API (already debounced by the screen). */
  search: string;
  page: number;
  lastPage: number;
  total: number;
};

const initialState: ConversationsState = {
  items: [],
  status: 'idle',
  error: null,
  filter: 'mine',
  search: '',
  page: 0,
  lastPage: 1,
  total: 0,
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
      }>,
    ) {
      const { items, page, lastPage, total, mode } = action.payload;
      state.items = mode === 'more' ? mergeById(state.items, items) : items;
      state.page = page;
      state.lastPage = lastPage;
      state.total = total;
      state.status = 'ready';
      state.error = null;
    },
    conversationsFailed(state, action: PayloadAction<ApiError>) {
      state.error = action.payload;
      // A failed refresh or next page keeps whatever is already listed.
      state.status = state.items.length > 0 ? 'ready' : 'failed';
    },
    filterChanged(state, action: PayloadAction<ChatFilter>) {
      if (state.filter === action.payload) return;
      state.filter = action.payload;
      // The rows below belong to the previous query; drop them before reloading.
      state.items = [];
      state.page = 0;
      state.lastPage = 1;
      state.total = 0;
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
  filterChanged,
  searchChanged,
} = conversationsSlice.actions;

export const conversationsReducer = conversationsSlice.reducer;
