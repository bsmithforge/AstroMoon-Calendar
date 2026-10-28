/**
 * Export settings shared by the export dialog and Ask's prepare_export tool.
 *
 * A draft is settings, never a file: Ask prepares one from a request, the
 * export dialog opens prefilled with it, and the user reviews and downloads.
 * The dialog builds every file from these settings the same way whether they
 * came from a draft or were entered by hand.
 */

import { AstroRecord, FilterSettings, Hemisphere } from '../types';
import { filterAstroRecords, generateRangeDataset } from './astronomy';
import { getCalendarPdfRangeError, getDateRangeError, getRecordExportRangeError } from './dateRange';

export type ExportFormat = 'ics' | 'calendar_pdf' | 'table_pdf';

export const EXPORT_FORMATS: readonly ExportFormat[] = ['ics', 'calendar_pdf', 'table_pdf'];

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  ics: '.ics calendar file',
  calendar_pdf: 'Calendar PDF',
  table_pdf: 'Data-table PDF',
};

export interface ExportSettings {
  startDate: string;
  endDate: string;
  timezone: string;
  hemisphere: Hemisphere;
  /** All four primary quarters, as in the shared filter. */
  includeMajorPhases: boolean;
  includeIngresses: boolean;
  includeDailySigns: boolean;
  includeEclipses: boolean;
}

export interface ExportDraft extends ExportSettings {
  format: ExportFormat;
}

export const EXPORT_EVENT_LABELS: [keyof ExportSettings, string][] = [
  ['includeMajorPhases', 'Moon phases'],
  ['includeIngresses', 'Sign changes'],
  ['includeDailySigns', 'Noon signs'],
  ['includeEclipses', 'Eclipses'],
];

export function hasIncludedEvents(settings: ExportSettings): boolean {
  return settings.includeMajorPhases || settings.includeIngresses || settings.includeDailySigns || settings.includeEclipses;
}

/**
 * Why a draft can't be exported in its format, or null. Each format keeps its
 * own limit: 24 whole months for calendar PDFs, 3,660 days for ICS and
 * data-table files, which also need at least one event type.
 */
export function getExportDraftError(draft: ExportDraft): string | null {
  const rangeError = getDateRangeError(draft.startDate, draft.endDate);
  if (rangeError) return rangeError;
  if (draft.format === 'calendar_pdf') return getCalendarPdfRangeError(draft.startDate, draft.endDate);
  const recordError = getRecordExportRangeError(draft.startDate, draft.endDate);
  if (recordError) return recordError;
  return hasIncludedEvents(draft) ? null : 'Include at least one event type in an .ics or data-table export.';
}

export function toExportFilters(settings: ExportSettings): FilterSettings {
  return {
    startDate: settings.startDate,
    endDate: settings.endDate,
    timezone: settings.timezone,
    hemisphere: settings.hemisphere,
    showFullNewMoon: settings.includeMajorPhases,
    showIngresses: settings.includeIngresses,
    showDailySigns: settings.includeDailySigns,
    showEclipses: settings.includeEclipses,
  };
}

/** Records for ICS and data-table exports. Throws if the range is over the record-export limit. */
export function getExportRecords(settings: ExportSettings): AstroRecord[] {
  const rangeError = getRecordExportRangeError(settings.startDate, settings.endDate);
  if (rangeError) throw new Error(rangeError);
  const { records } = generateRangeDataset(settings.startDate, settings.endDate, settings.hemisphere, settings.timezone);
  return filterAstroRecords(records, toExportFilters(settings));
}
