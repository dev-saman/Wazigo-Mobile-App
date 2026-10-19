import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  AccountOverview,
  ActionDesk,
  ApiError,
  DeliveryIssues,
  NumberToday,
} from '@/api/types';
import { appReset } from '@/store/actions';

/**
 * REP-01 to REP-04. The app's fourth area, in place of the personal dashboard.
 *
 * Two rules from the workbook shape this slice. A section the person may not
 * see comes back null with a reason in `errors`, so a null section is kept as
 * null rather than coerced into an empty one; and a metric with `value: null`
 * means "Not available", which is why nothing here ever defaults a figure to
 * zero.
 */
export type ReportStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type ReportState = {
  overview: AccountOverview | null;
  overviewStatus: ReportStatus;
  overviewError: ApiError | null;
  /** REP-10: the account can have the overview switched off entirely. */
  overviewDisabled: boolean;

  issues: DeliveryIssues | null;
  issuesStatus: ReportStatus;
  issuesError: ApiError | null;

  today: NumberToday | null;
  todayFor: number | null;
  todayStatus: ReportStatus;
  todayError: ApiError | null;

  desk: ActionDesk | null;
  deskStatus: ReportStatus;
  deskError: ApiError | null;
};

const initialState: ReportState = {
  overview: null,
  overviewStatus: 'idle',
  overviewError: null,
  overviewDisabled: false,
  issues: null,
  issuesStatus: 'idle',
  issuesError: null,
  today: null,
  todayFor: null,
  todayStatus: 'idle',
  todayError: null,
  desk: null,
  deskStatus: 'idle',
  deskError: null,
};

const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    overviewLoading(state, action: PayloadAction<{ quiet: boolean }>) {
      if (!action.payload.quiet && !state.overview) state.overviewStatus = 'loading';
      state.overviewError = null;
    },
    overviewLoaded(state, action: PayloadAction<AccountOverview>) {
      state.overview = action.payload;
      state.overviewStatus = 'ready';
      state.overviewDisabled = false;
      state.overviewError = null;
    },
    overviewFailed(state, action: PayloadAction<{ error: ApiError; disabled: boolean }>) {
      // REP-10: a 403 with the overview switched off is not a fault to retry -
      // the card is hidden and Today stands on its own.
      state.overviewDisabled = action.payload.disabled;
      state.overviewStatus = state.overview ? 'ready' : 'failed';
      state.overviewError = action.payload.error;
    },

    issuesLoading(state) {
      state.issuesStatus = state.issues ? 'ready' : 'loading';
      state.issuesError = null;
    },
    issuesLoaded(state, action: PayloadAction<DeliveryIssues>) {
      state.issues = action.payload;
      state.issuesStatus = 'ready';
      state.issuesError = null;
    },
    issuesFailed(state, action: PayloadAction<ApiError>) {
      state.issuesStatus = state.issues ? 'ready' : 'failed';
      state.issuesError = action.payload;
    },

    todayLoading(state, action: PayloadAction<{ numberId: number }>) {
      if (state.todayFor !== action.payload.numberId) {
        state.today = null;
        state.desk = null;
      }
      state.todayFor = action.payload.numberId;
      state.todayStatus = state.today ? 'ready' : 'loading';
      state.todayError = null;
    },
    todayLoaded(state, action: PayloadAction<{ numberId: number; today: NumberToday }>) {
      state.todayFor = action.payload.numberId;
      state.today = action.payload.today;
      state.todayStatus = 'ready';
      state.todayError = null;
      // REP-03 carries the first page of the desk, so a second call is only
      // needed when the person changes tab or pages.
      if (action.payload.today.action_desk) state.desk = action.payload.today.action_desk;
    },
    todayFailed(state, action: PayloadAction<ApiError>) {
      state.todayStatus = state.today ? 'ready' : 'failed';
      state.todayError = action.payload;
    },

    deskLoading(state) {
      state.deskStatus = state.desk ? 'ready' : 'loading';
      state.deskError = null;
    },
    deskLoaded(state, action: PayloadAction<{ desk: ActionDesk; append: boolean }>) {
      const { desk, append } = action.payload;
      state.desk =
        append && state.desk
          ? { ...desk, items: [...state.desk.items, ...desk.items] }
          : desk;
      state.deskStatus = 'ready';
      state.deskError = null;
    },
    deskFailed(state, action: PayloadAction<ApiError>) {
      state.deskStatus = state.desk ? 'ready' : 'failed';
      state.deskError = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const {
  overviewLoading,
  overviewLoaded,
  overviewFailed,
  issuesLoading,
  issuesLoaded,
  issuesFailed,
  todayLoading,
  todayLoaded,
  todayFailed,
  deskLoading,
  deskLoaded,
  deskFailed,
} = reportSlice.actions;

export const reportReducer = reportSlice.reducer;
