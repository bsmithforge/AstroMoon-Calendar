/**
 * Shared validation for inclusive YYYY-MM-DD date ranges.
 *
 * Callers must validate before calling generateRangeDataset() or
 * generateMonthData(): reversed or impossible dates can make range
 * generation loop without end.
 */

/** Calendar PDFs render every whole month the range touches, one per page. */
export const CALENDAR_PDF_MAX_MONTHS = 24;

/** ICS and data-table exports bound synchronous calculation by inclusive day count. */
export const RECORD_EXPORT_MAX_DAYS = 3660;

/** True for a real calendar date in strict YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Error for malformed or reversed ranges; null when both endpoints are valid and ordered. */
export function getDateRangeError(startDate: string, endDate: string): string | null {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return 'Enter a valid start and end date.';
  }
  if (startDate > endDate) return 'End date must be on or after start date.';
  return null;
}

/** Number of calendar months touched by the range, counting both endpoint months. */
export function countMonthsSpanned(startDate: string, endDate: string): number {
  const [startYear, startMonth] = startDate.split('-').map(Number);
  const [endYear, endMonth] = endDate.split('-').map(Number);
  return (endYear - startYear) * 12 + endMonth - startMonth + 1;
}

/** Number of dates in the range, counting both endpoints. */
export function countInclusiveDays(startDate: string, endDate: string): number {
  return (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86400000 + 1;
}

export function getCalendarPdfRangeError(startDate: string, endDate: string): string | null {
  return getDateRangeError(startDate, endDate) || (
    countMonthsSpanned(startDate, endDate) > CALENDAR_PDF_MAX_MONTHS
      ? `Calendar PDFs support up to ${CALENDAR_PDF_MAX_MONTHS} whole months. Choose a shorter range.`
      : null
  );
}

export function getRecordExportRangeError(startDate: string, endDate: string): string | null {
  return getDateRangeError(startDate, endDate) || (
    countInclusiveDays(startDate, endDate) > RECORD_EXPORT_MAX_DAYS
      ? `ICS and data-table exports support up to ${RECORD_EXPORT_MAX_DAYS.toLocaleString('en-US')} days per download. Choose a shorter range.`
      : null
  );
}
