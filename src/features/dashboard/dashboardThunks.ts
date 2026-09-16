import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { DashboardOverview } from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import {
  dashboardFailed,
  dashboardLoaded,
  dashboardLoading,
  recentFailed,
  recentLoaded,
  recentLoading,
} from './dashboardSlice';

/** Design screen 4 shows three rows under "Recent Conversations". */
export const RECENT_CONVERSATIONS_COUNT = 3;

/**
 * DASH-01. BACKEND BLOCKER: the endpoint still counts every chat on every
 * number the user can reach, not just their own. The fix belongs on the server;
 * filtering here would only hide the discrepancy.
 */
export const loadDashboard = createAppAsyncThunk<
  DashboardOverview,
  { refresh?: boolean; quiet?: boolean } | void
>(
  'dashboard/load',
  async (arg, { dispatch, rejectWithValue }) => {
    // `quiet` is the foreground/reconnect refresh: no pull-to-refresh spinner,
    // because the user did not ask for it.
    if (!(arg && arg.quiet)) dispatch(dashboardLoading({ refresh: !!(arg && arg.refresh) }));
    try {
      const { data } = await api.getDashboardOverview();
      dispatch(dashboardLoaded(data));
      return data;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(dashboardFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/**
 * CHAT-01, page 1 of the agent's own conversations - the same scope as the Chats
 * tab's default "Mine" chip, newest first as the server orders them.
 *
 * BACKEND BLOCKER 1 applies here exactly as on the Chats tab: `assigned=mine`
 * currently also returns unassigned conversations. That is fixed on the server,
 * never by filtering the rows here.
 *
 * Its own request, not the Chats tab's: that list cancels its in-flight call
 * whenever a new one starts, and the two would cancel each other.
 */
export const loadRecentConversations = createAppAsyncThunk<void, void>(
  'dashboard/loadRecentConversations',
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(recentLoading());
    try {
      const { data } = await api.getConversations({
        assigned: 'mine',
        page: 1,
        per_page: RECENT_CONVERSATIONS_COUNT,
      });
      dispatch(recentLoaded(Array.isArray(data) ? data.slice(0, RECENT_CONVERSATIONS_COUNT) : []));
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(recentFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);
