import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, DashboardOverview } from '@/api/types';
import { appReset } from '@/store/actions';

export type DashboardStatus =
  | 'idle'
  | 'loading'
  /** A pull-to-refresh over data that is already on screen. */
  | 'refreshing'
  | 'ready'
  | 'failed';

export type DashboardState = {
  status: DashboardStatus;
  overview: DashboardOverview | null;
  error: ApiError | null;
  loadedAt: number | null;
};

const initialState: DashboardState = {
  status: 'idle',
  overview: null,
  error: null,
  loadedAt: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    dashboardLoading(state, action: PayloadAction<{ refresh: boolean }>) {
      state.status = action.payload.refresh && state.overview ? 'refreshing' : 'loading';
      state.error = null;
    },
    dashboardLoaded(state, action: PayloadAction<DashboardOverview>) {
      state.status = 'ready';
      state.overview = action.payload;
      state.error = null;
      state.loadedAt = Date.now();
    },
    dashboardFailed(state, action: PayloadAction<ApiError>) {
      state.error = action.payload;
      // A failed refresh keeps the numbers that are already on screen.
      state.status = state.overview ? 'ready' : 'failed';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { dashboardLoading, dashboardLoaded, dashboardFailed } = dashboardSlice.actions;

export const dashboardReducer = dashboardSlice.reducer;
