import type { ReportMetric } from '@/api/types';
import type { RootState } from '@/store/store';

export const selectOverview = (state: RootState) => state.report.overview;
export const selectOverviewStatus = (state: RootState) => state.report.overviewStatus;
export const selectOverviewError = (state: RootState) => state.report.overviewError;
export const selectOverviewDisabled = (state: RootState) => state.report.overviewDisabled;

export const selectDeliveryIssues = (state: RootState) => state.report.issues;
export const selectDeliveryIssuesStatus = (state: RootState) => state.report.issuesStatus;
export const selectDeliveryIssuesError = (state: RootState) => state.report.issuesError;

export const selectToday = (state: RootState) => state.report.today;
export const selectTodayFor = (state: RootState) => state.report.todayFor;
export const selectTodayStatus = (state: RootState) => state.report.todayStatus;
export const selectTodayError = (state: RootState) => state.report.todayError;

export const selectActionDesk = (state: RootState) => state.report.desk;
export const selectActionDeskStatus = (state: RootState) => state.report.deskStatus;
export const selectActionDeskError = (state: RootState) => state.report.deskError;

/**
 * REP-01: "Your numbers", never "the whole account", when the person can only
 * see part of it.
 */
export const selectOverviewIsPartial = (state: RootState) =>
  state.report.overview?.scope.partial_access === true;

/** A metric by key, or null when the server did not send it at all. */
export const selectMetric =
  (key: string, from: 'snapshot' | 'period' = 'snapshot') =>
  (state: RootState): ReportMetric | null => {
    const list =
      from === 'snapshot'
        ? state.report.overview?.snapshot_metrics
        : state.report.overview?.period_metrics;
    return list?.find((metric) => metric.key === key) ?? null;
  };
