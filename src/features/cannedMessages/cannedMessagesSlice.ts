import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, CannedMessage } from '@/api/types';
import { appReset } from '@/store/actions';

export type CannedMessagesStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'failed';

export type CannedMessagesState = {
  items: CannedMessage[];
  status: CannedMessagesStatus;
  error: ApiError | null;
  /**
   * CHAT-20 (2026-10-19): quick replies belong to one number, so the cache
   * does too - a chat on another number starts from an empty list.
   */
  numberId: number | null;
};

const initialState: CannedMessagesState = {
  items: [],
  status: 'idle',
  error: null,
  numberId: null,
};

const cannedMessagesSlice = createSlice({
  name: 'cannedMessages',
  initialState,
  reducers: {
    cannedMessagesLoading(
      state,
      action: PayloadAction<{ refresh: boolean; numberId?: number | null }>,
    ) {
      const numberId = action.payload.numberId ?? null;
      if (numberId !== state.numberId) {
        state.numberId = numberId;
        state.items = [];
      }
      state.status = action.payload.refresh ? 'refreshing' : 'loading';
      state.error = null;
    },
    cannedMessagesLoaded(state, action: PayloadAction<CannedMessage[]>) {
      state.items = action.payload;
      state.status = 'ready';
      state.error = null;
    },
    cannedMessagesFailed(state, action: PayloadAction<ApiError>) {
      state.error = action.payload;
      // Keep showing what we have; a stale list still beats an error screen.
      state.status = state.items.length > 0 ? 'ready' : 'failed';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { cannedMessagesLoading, cannedMessagesLoaded, cannedMessagesFailed } =
  cannedMessagesSlice.actions;

export const cannedMessagesReducer = cannedMessagesSlice.reducer;
