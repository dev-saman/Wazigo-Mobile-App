import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { AccountOverviewParams, ActionDeskParams, NumberTodayParams } from '@/api/types';
import { selectReportScopeParams } from '@/features/conversations';
import { createAppAsyncThunk } from '@/store/hooks';

import {
  deskFailed,
  deskLoaded,
  deskLoading,
  issuesFailed,
  issuesLoaded,
  issuesLoading,
  overviewFailed,
  overviewLoaded,
  overviewLoading,
  todayFailed,
  todayLoaded,
  todayLoading,
} from './reportSlice';

/**
 * REP-01. The brand or numbers come from the one selection the app already
 * has (ORG-17), so Report and Chats always answer about the same thing.
 */
export const loadAccountOverview = createAppAsyncThunk<void, { quiet?: boolean } | void>(
  'report/overview',
  async (arg, { dispatch, getState, rejectWithValue }) => {
    const quiet = !!(arg && arg.quiet);
    dispatch(overviewLoading({ quiet }));
    const params: AccountOverviewParams = { ...selectReportScopeParams(getState()) };
    try {
      const { data } = await api.getAccountOverview(params);
      if (data) dispatch(overviewLoaded(data));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      // REP-10: the account can have the overview switched off, which arrives
      // as a 403. That is a setting, not a failure to retry.
      dispatch(overviewFailed({ error: apiError, disabled: apiError.code === 'FORBIDDEN' }));
      return rejectWithValue(apiError);
    }
  },
);

/** REP-02. Plain-language failure reasons; no customer names or numbers. */
export const loadDeliveryIssues = createAppAsyncThunk<void, void>(
  'report/deliveryIssues',
  async (_, { dispatch, getState, rejectWithValue }) => {
    dispatch(issuesLoading());
    try {
      const { data } = await api.getDeliveryIssues({ ...selectReportScopeParams(getState()) });
      if (data) dispatch(issuesLoaded(data));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(issuesFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/** REP-03. One number's Today page, including the first page of its desk. */
export const loadNumberToday = createAppAsyncThunk<
  void,
  { numberId: number; params?: NumberTodayParams }
>('report/today', async ({ numberId, params }, { dispatch, rejectWithValue }) => {
  dispatch(todayLoading({ numberId }));
  try {
    const { data } = await api.getNumberToday(numberId, params ?? {});
    if (data) dispatch(todayLoaded({ numberId, today: data }));
    return;
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(todayFailed(apiError));
    return rejectWithValue(apiError);
  }
});

/**
 * REP-04. A tab or the next page of the desk. `cursor` appends; anything else
 * replaces, because a different tab is a different question.
 */
export const loadActionDesk = createAppAsyncThunk<
  void,
  { numberId: number; params?: ActionDeskParams }
>('report/actionDesk', async ({ numberId, params }, { dispatch, rejectWithValue }) => {
  dispatch(deskLoading());
  try {
    const { data } = await api.getActionDesk(numberId, params ?? {});
    if (data) dispatch(deskLoaded({ desk: data, append: !!params?.cursor }));
    return;
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(deskFailed(apiError));
    return rejectWithValue(apiError);
  }
});
