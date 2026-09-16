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
};

const initialState: LabelsState = { items: [], status: 'idle', error: null };

const labelsSlice = createSlice({
  name: 'labels',
  initialState,
  reducers: {
    labelsLoading(state) {
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

/** CHAT-13. The whole list is small, so it is fetched once per session. */
export const loadLabels = createAppAsyncThunk<void, void>(
  'labels/load',
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(labelsLoading());
    try {
      const { data } = await api.getLabels();
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
