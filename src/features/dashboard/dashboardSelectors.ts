import { createSelector } from '@reduxjs/toolkit';

import type { ConversationPriority, DashboardTotals } from '@/api/types';
import type { RootState } from '@/store/store';

export const selectDashboardStatus = (state: RootState) => state.dashboard.status;
export const selectDashboardError = (state: RootState) => state.dashboard.error;
export const selectDashboardOverview = (state: RootState) => state.dashboard.overview;
export const selectDashboardLoadedAt = (state: RootState) => state.dashboard.loadedAt;

const ZERO_TOTALS: DashboardTotals = { total: 0, open: 0, unread: 0, window_open: 0 };

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Only the four documented totals. `totals.closed` is deliberately ignored:
 * it counts `"closed"` while the conversation lifecycle uses `"resolved"`.
 */
export const selectDashboardTotals = createSelector([selectDashboardOverview], (overview): DashboardTotals => {
  if (!overview?.totals) return ZERO_TOTALS;
  return {
    total: count(overview.totals.total),
    open: count(overview.totals.open),
    unread: count(overview.totals.unread),
    window_open: count(overview.totals.window_open),
  };
});

/** Highest urgency first, and only the priorities the server actually reported. */
const PRIORITY_ORDER: ConversationPriority[] = ['urgent', 'high', 'normal', 'low'];

export const selectPriorityBreakdown = createSelector([selectDashboardOverview], (overview) => {
  const rows = Array.isArray(overview?.by_priority) ? overview.by_priority : [];
  return rows
    .filter((row) => row && PRIORITY_ORDER.includes(row.priority))
    .map((row) => ({ priority: row.priority, count: count(row.count) }))
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
});

export const selectDashboardActivity = createSelector(
  [selectDashboardOverview],
  (overview) => overview?.activity ?? null,
);

export const selectDashboardDelivery = createSelector(
  [selectDashboardOverview],
  (overview) => overview?.delivery ?? null,
);
