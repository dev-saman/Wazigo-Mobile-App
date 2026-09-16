import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, Conversation, DashboardOverview } from '@/api/types';
import { conversationPatched } from '@/features/conversations/conversationsSlice';
import { appReset } from '@/store/actions';

export type DashboardStatus =
  | 'idle'
  | 'loading'
  /** A pull-to-refresh over data that is already on screen. */
  | 'refreshing'
  | 'ready'
  | 'failed';

export type RecentConversationsStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type RecentConversationsState = {
  items: Conversation[];
  status: RecentConversationsStatus;
  error: ApiError | null;
};

export type DashboardState = {
  status: DashboardStatus;
  overview: DashboardOverview | null;
  error: ApiError | null;
  loadedAt: number | null;
  /**
   * The newest few of the agent's own conversations (CHAT-01, `assigned=mine`).
   * Held here, not in the conversations slice: the Chats tab owns that list's
   * filter, search and paging, and cancels its own requests.
   */
  recent: RecentConversationsState;
};

const initialState: DashboardState = {
  status: 'idle',
  overview: null,
  error: null,
  loadedAt: null,
  recent: { items: [], status: 'idle', error: null },
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
    recentLoading(state) {
      // Rows already on screen stay while they are refreshed.
      if (state.recent.items.length === 0) state.recent.status = 'loading';
      state.recent.error = null;
    },
    recentLoaded(state, action: PayloadAction<Conversation[]>) {
      state.recent.items = action.payload;
      state.recent.status = 'ready';
      state.recent.error = null;
    },
    recentFailed(state, action: PayloadAction<ApiError>) {
      state.recent.error = action.payload;
      state.recent.status = state.recent.items.length > 0 ? 'ready' : 'failed';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
    // Reading, resolving or relabelling a chat answers with the Conversation;
    // the dashboard's copy follows it instead of waiting for the next refresh.
    builder.addCase(conversationPatched, (state, action) => {
      const index = state.recent.items.findIndex((item) => item.id === action.payload.id);
      if (index >= 0) state.recent.items[index] = action.payload;
    });
  },
});

export const {
  dashboardLoading,
  dashboardLoaded,
  dashboardFailed,
  recentLoading,
  recentLoaded,
  recentFailed,
} = dashboardSlice.actions;

export const dashboardReducer = dashboardSlice.reducer;
