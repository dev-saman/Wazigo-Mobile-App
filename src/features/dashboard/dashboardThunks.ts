import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { DashboardOverview } from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import { dashboardFailed, dashboardLoaded, dashboardLoading } from './dashboardSlice';

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
