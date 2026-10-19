import type { ReportMetric, ReportSectionErrors } from '@/api/types';

/**
 * REP-01 / REP-03. `value: null` means the figure is not available - it must
 * never be drawn as 0, because "no data" and "none" are different answers and
 * the difference matters to someone deciding whether to act.
 */
export function metricValue(metric: ReportMetric | null | undefined): string {
  if (!metric || metric.value === null || metric.value === undefined) return 'Not available';
  if (typeof metric.denominator === 'number' && metric.denominator > 0) {
    return `${metric.value} of ${metric.denominator}`;
  }
  return String(metric.value);
}

/** Why a section is missing, in the server's own terms. */
export function sectionUnavailable(
  errors: ReportSectionErrors | null | undefined,
  section: string,
): string | null {
  const reason = errors?.[section];
  if (!reason) return null;
  if (reason === 'no_permission') return 'You do not have access to this part.';
  return 'This part could not be loaded.';
}
