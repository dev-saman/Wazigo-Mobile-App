import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, MessageTemplate } from '@/api/types';
import { appReset } from '@/store/actions';

export type TemplatesStatus = 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'ready' | 'failed';

export type TemplatesState = {
  items: MessageTemplate[];
  status: TemplatesStatus;
  error: ApiError | null;
  /** Sent to CHAT-07 as `search`, already debounced by the screen. */
  search: string;
  page: number;
  lastPage: number;
  total: number;
};

const initialState: TemplatesState = {
  items: [],
  status: 'idle',
  error: null,
  search: '',
  page: 0,
  lastPage: 1,
  total: 0,
};

const mergeById = (existing: MessageTemplate[], incoming: MessageTemplate[]): MessageTemplate[] => {
  const seen = new Set(existing.map((item) => item.id));
  return existing.concat(incoming.filter((item) => item && !seen.has(item.id)));
};

const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    templatesLoading(state, action: PayloadAction<{ mode: 'initial' | 'refresh' | 'more' }>) {
      const { mode } = action.payload;
      state.status = mode === 'refresh' ? 'refreshing' : mode === 'more' ? 'loadingMore' : 'loading';
      state.error = null;
    },
    templatesLoaded(
      state,
      action: PayloadAction<{
        items: MessageTemplate[];
        page: number;
        lastPage: number;
        total: number;
        mode: 'initial' | 'refresh' | 'more';
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
    templatesFailed(state, action: PayloadAction<ApiError>) {
      state.error = action.payload;
      state.status = state.items.length > 0 ? 'ready' : 'failed';
    },
    templateSearchChanged(state, action: PayloadAction<string>) {
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

export const { templatesLoading, templatesLoaded, templatesFailed, templateSearchChanged } =
  templatesSlice.actions;

export const templatesReducer = templatesSlice.reducer;
