/**
 * Export settings shared by the export dialog and Ask's prepare_export tool.
 *
 * A draft is settings, never a file: Ask prepares one from a request, the
 * export dialog opens prefilled with it, and the user reviews and downloads.
 * The dialog builds every file from these settings the same way whether they
 * came from a draft or were entered by hand.
 */

import { AstroRecord, FilterSettings, Hemisphere, QuarterPhaseSelection } from '../types';
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
  /** Exact primary phases, as in the shared filter... */
  includeMajorPhases: boolean;
  /** ...all four, or only New and Full Moons. */
  quarterPhases: QuarterPhaseSelection;
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

/** How the phase setting reads in summaries: all four phases, or only New and Full. */
export function phaseLabel(settings: ExportSettings): string {
  return settings.quarterPhases === 'newAndFull' ? 'New & Full Moons' : 'Moon phases';
}

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

/** "Jan 1 – Dec 31, 2027", from the inclusive local dates. */
export function describeExportRange(settings: ExportSettings): string {
  const toDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  };
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .formatRange(toDate(settings.startDate), toDate(settings.endDate));
}

/** "Moon phases, Eclipses", or null when no event type is included. */
export function describeExportEvents(settings: ExportSettings): string | null {
  const names = EXPORT_EVENT_LABELS.filter(([key]) => settings[key]).map(([key, label]) =>
    key === 'includeMajorPhases' ? phaseLabel(settings) : label
  );
  return names.length > 0 ? names.join(', ') : null;
}

export function toExportFilters(settings: ExportSettings): FilterSettings {
  return {
    startDate: settings.startDate,
    endDate: settings.endDate,
    timezone: settings.timezone,
    hemisphere: settings.hemisphere,
    showFullNewMoon: settings.includeMajorPhases,
    quarterPhases: settings.quarterPhases,
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
