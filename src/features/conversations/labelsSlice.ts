import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { ApiError, Label } from '@/api/types';
import { appReset } from '@/store/actions';
import { createAppAsyncThunk } from '@/store/hooks';
import type { RootState } from '@/store/store';

export type LabelsState = {
  items: Label[];
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: ApiError | null;
  /**
   * CHAT-13 (2026-10-19): each number has its own labels, so the cache is per
   * number and a chat on another number reloads instead of showing the wrong
   * catalogue.
   */
  numberId: number | null;
};

const initialState: LabelsState = { items: [], status: 'idle', error: null, numberId: null };

const labelsSlice = createSlice({
  name: 'labels',
  initialState,
  reducers: {
    labelsLoading(state, action: PayloadAction<{ numberId?: number | null } | undefined>) {
      const numberId = action.payload?.numberId ?? null;
      if (numberId !== state.numberId) {
        state.numberId = numberId;
        state.items = [];
      }
      state.status = 'loading';
      state.error = null;
    },
    labelsLoaded(state, action: PayloadAction<Label[]>) {
      state.items = action.payload;
      state.status = 'ready';
      state.error = null;
    },
    labelsFailed(state, action: PayloadAction<ApiError>) {
      state.error = action.payload;
      state.status = state.items.length > 0 ? 'ready' : 'failed';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { labelsLoading, labelsLoaded, labelsFailed } = labelsSlice.actions;
export const labelsReducer = labelsSlice.reducer;

/** CHAT-13. Small enough to fetch once per number per session. */
export const loadLabels = createAppAsyncThunk<void, { numberId?: number | null } | void>(
  'labels/load',
  async (arg, { dispatch, rejectWithValue }) => {
    const numberId = (arg && arg.numberId) ?? null;
    dispatch(labelsLoading({ numberId }));
    try {
      const { data } = await api.getLabels(numberId ? { whatsapp_account_id: numberId } : {});
      dispatch(labelsLoaded(Array.isArray(data) ? data : []));
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(labelsFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

export const selectLabels = (state: RootState) => state.labels.items;
export const selectLabelsStatus = (state: RootState) => state.labels.status;
/** Which number the cached catalogue belongs to (CHAT-13, 2026-10-19). */
export const selectLabelsNumberId = (state: RootState) => state.labels.numberId;
