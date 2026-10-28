import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toModelResult } from '../src/utils/almanacResults';
import { AlmanacContext, AlmanacToolResult, runAlmanacTool } from '../src/utils/almanacTools';
import { filterAstroRecords, generateRangeDataset, includesQuarter } from '../src/utils/astronomy';
import {
  describeExportEvents,
  describeExportRange,
  ExportDraft,
  getExportDraftError,
  getExportRecords,
  toExportFilters,
} from '../src/utils/exportDraft';
import { generateIcsPayload } from '../src/utils/icsExport';
import { FilterSettings } from '../src/types';

const ctx: AlmanacContext = { timezone: 'America/Halifax', hemisphere: 'northern', now: new Date('2026-10-27T17:00:00Z') };

function draft(args: unknown): ExportDraft {
  const result = runAlmanacTool('prepare_export', args, ctx);
  assert.ok('draft' in result, `expected a draft, got: ${'error' in result ? result.error : 'other result'}`);
  return result.draft;
}

function error(args: unknown): string {
  const result: AlmanacToolResult = runAlmanacTool('prepare_export', args, ctx);
  assert.ok('error' in result, 'expected an error');
  return result.error;
}

test('prepare_export resolves a year, whole months, or explicit dates', () => {
  assert.deepEqual(draft({ format: 'calendar_pdf', year: 2027 }), {
    format: 'calendar_pdf',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    timezone: 'America/Halifax',
    hemisphere: 'northern',
    includeMajorPhases: true,
    quarterPhases: 'all',
    includeIngresses: true,
    includeDailySigns: true,
    includeEclipses: true,
  });

  const quarter = draft({ format: 'table_pdf', month: '2026-11', months: 3 });
  assert.deepEqual([quarter.startDate, quarter.endDate], ['2026-11-01', '2027-01-31']);
  const leapFebruary = draft({ format: 'ics', month: '2028-02' });
  assert.deepEqual([leapFebruary.startDate, leapFebruary.endDate], ['2028-02-01', '2028-02-29']);

  const tokyo = draft({
    format: 'ics',
    start_date: '2027-03-01',
    end_date: '2027-03-31',
    include: ['Eclipses', 'moon_phases'],
    timezone: 'Asia/Tokyo',
    hemisphere: 'Southern',
  });
  assert.equal(tokyo.timezone, 'Asia/Tokyo');
  assert.equal(tokyo.hemisphere, 'southern');
  assert.deepEqual(
    [tokyo.includeMajorPhases, tokyo.includeIngresses, tokyo.includeDailySigns, tokyo.includeEclipses],
    [true, false, false, true]
  );
});

test('prepare_export rejects unclear ranges and each format’s own limits before anything is calculated', () => {
  assert.match(error({ year: 2027 }), /format is required/);
  assert.match(error({ format: 'ics' }), /one way/);
  assert.match(error({ format: 'ics', year: 2027, month: '2027-01' }), /one way/);
  assert.match(error({ format: 'ics', year: 2027, months: 2 }), /months goes with month/);
  assert.match(error({ format: 'ics', start_date: '2027-01-01' }), /both start_date and end_date/);
  assert.match(error({ format: 'ics', month: '2027-13' }), /YYYY-MM/);
  assert.match(error({ format: 'ics', year: 2101 }), /1900 to 2100/);
  assert.match(error({ format: 'ics', start_date: '2027-02-30', end_date: '2027-03-01' }), /real date/);
  assert.match(error({ format: 'ics', start_date: '2027-03-01', end_date: '2027-02-01' }), /on or after/);
  assert.match(error({ format: 'pdf', year: 2027 }), /format must be one of/);
  assert.match(error({ format: 'ics', year: 2027, include: [] }), /non-empty array/);
  assert.match(error({ format: 'ics', year: 2027, timezone: 'Mars/Olympus' }), /Unknown IANA timezone/);
  assert.match(error({ format: 'ics', year: 2027, path: '/etc' }), /Unknown argument/);

  // Calendar PDFs stop at 24 whole months; ICS and table files at 3,660 days.
  assert.match(error({ format: 'calendar_pdf', start_date: '2026-01-15', end_date: '2028-01-01' }), /24 whole months/);
  assert.ok(draft({ format: 'ics', start_date: '2026-01-15', end_date: '2028-01-01' }));
  assert.match(error({ format: 'table_pdf', start_date: '2026-01-01', end_date: '2036-01-09' }), /3,660 days/);
  assert.ok(draft({ format: 'table_pdf', start_date: '2026-01-01', end_date: '2036-01-08' }));
});

test('ICS and table drafts need an event type; calendar PDFs can be grids alone', () => {
  const none = { startDate: '2027-01-01', endDate: '2027-01-31', timezone: 'UTC', hemisphere: 'northern' as const, includeMajorPhases: false, quarterPhases: 'all' as const, includeIngresses: false, includeDailySigns: false, includeEclipses: false };
  assert.equal(getExportDraftError({ ...none, format: 'calendar_pdf' }), null);
  assert.match(getExportDraftError({ ...none, format: 'ics' })!, /at least one event type/);
  assert.match(getExportDraftError({ ...none, format: 'table_pdf' })!, /at least one event type/);
});

test('a draft exports exactly what the same settings entered by hand export', () => {
  const tokyo = draft({ format: 'ics', year: 2027, include: ['moon_phases', 'eclipses'], timezone: 'Asia/Tokyo', hemisphere: 'southern' });

  // The export dialog's path before drafts existed: app filters, overridden by the form.
  const byHand: FilterSettings = {
    timezone: 'Asia/Tokyo',
    hemisphere: 'southern',
    rangePreset: 'month',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    showFullNewMoon: true,
    showIngresses: false,
    showDailySigns: false,
    showEclipses: true,
  };
  const handRecords = filterAstroRecords(
    generateRangeDataset(byHand.startDate!, byHand.endDate!, byHand.hemisphere, byHand.timezone).records,
    byHand
  );
  const draftRecords = getExportRecords(tokyo);

  assert.ok(draftRecords.length > 50, 'a year of quarters and eclipses');
  assert.deepEqual(draftRecords.map((r) => r.id), handRecords.map((r) => r.id));
  assert.equal(
    generateIcsPayload(draftRecords, 'AstroMoon', tokyo.timezone, tokyo.hemisphere),
    generateIcsPayload(handRecords, 'AstroMoon', byHand.timezone, byHand.hemisphere)
  );
});

test('New & Full exports keep only those phases, in records and in the calendar filter', () => {
  const newFull = draft({ format: 'ics', year: 2027, include: ['new_and_full_moons', 'eclipses'] });
  assert.equal(newFull.includeMajorPhases, true);
  assert.equal(newFull.quarterPhases, 'newAndFull');
  const all = draft({ format: 'ics', year: 2027, include: ['moon_phases', 'new_and_full_moons', 'eclipses'] });
  assert.equal(all.quarterPhases, 'all', 'all four phases win when both are asked for');

  const quarters = (settings: ExportDraft) => getExportRecords(settings).filter((r) => r.eventType === 'quarter');
  const types = new Set(quarters(newFull).map((r) => r.metadata.quarterType));
  assert.deepEqual([...types].sort(), ['Full Moon', 'New Moon']);
  assert.equal(quarters(newFull).length, quarters(all).filter((r) => r.metadata.quarterType === 'New Moon' || r.metadata.quarterType === 'Full Moon').length);
  assert.equal(getExportRecords(newFull).filter((r) => r.eventType === 'eclipse').length, getExportRecords(all).filter((r) => r.eventType === 'eclipse').length);

  // The calendar grid (and so the calendar PDF) reads the same filter.
  const filters = toExportFilters(newFull);
  assert.equal(includesQuarter(filters, 'Full Moon'), true);
  assert.equal(includesQuarter(filters, 'First Quarter'), false);
  assert.equal(includesQuarter({ ...filters, quarterPhases: undefined }, 'First Quarter'), true, 'the main calendar is unaffected');
  assert.equal(includesQuarter({ ...filters, showFullNewMoon: false }, 'Full Moon'), false);

  assert.equal(describeExportEvents(newFull), 'New & Full Moons, Eclipses');
  assert.deepEqual((toModelResult(runAlmanacTool('prepare_export', { format: 'ics', year: 2027, include: ['new_and_full_moons'] }, ctx)) as { export_draft: { include: string[] } }).export_draft.include, ['new_and_full_moons']);
});

test('getExportRecords refuses ranges over the record-export limit', () => {
  const tooLong = { ...draft({ format: 'calendar_pdf', year: 2027 }), endDate: '2037-12-31' };
  assert.throws(() => getExportRecords(tooLong), /3,660 days/);
});

test('the model sees the draft’s settings, and the card describes them from the draft', () => {
  const result = runAlmanacTool('prepare_export', { format: 'calendar_pdf', year: 2027, include: ['moon_phases'] }, ctx);
  assert.deepEqual(toModelResult(result), {
    ok: true,
    export_draft: {
      format: 'calendar_pdf',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      timezone: 'America/Halifax',
      hemisphere: 'northern',
      include: ['moon_phases'],
    },
    note: 'The app shows these settings with a Review export button; the user downloads from the export dialog.',
  });

  const year = draft({ format: 'calendar_pdf', year: 2027, include: ['moon_phases', 'eclipses'] });
  // ICU spaces ranges with thin spaces, which vary by version.
  const range = (settings: ExportDraft) => describeExportRange(settings).replace(/\s/g, ' ');
  assert.equal(range(year), 'Jan 1 – Dec 31, 2027');
  assert.equal(range({ ...year, startDate: '2026-11-15', endDate: '2027-02-03' }), 'Nov 15, 2026 – Feb 3, 2027');
  assert.equal(describeExportEvents(year), 'Moon phases, Eclipses');
  assert.equal(describeExportEvents({ ...year, includeMajorPhases: false, includeEclipses: false }), null);
});
