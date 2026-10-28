/**
 * Deterministic lookups for Ask the Almanac (docs/ai-features-plan.md, Phase 2).
 *
 * The language model chooses which tool to call and with what arguments; the
 * tools do all of the astronomy. Each tool validates its arguments before any
 * search runs, works in inclusive local dates for the selected timezone, and
 * returns engine records with their stable IDs, so every date, time, and sign
 * an answer can cite comes from astronomy-engine.
 */

import { AstroRecord, Hemisphere } from '../types';
import {
  findIngressesInRange,
  generateRangeDataset,
  getEclipsesInRange,
  getLocalDateComponents,
  getLocalDateRangeUtc,
  getQuartersInRange,
  MOON_PHASE_MEANINGS,
  MoonPhaseName,
} from './astronomy';
import { CALENDAR_PDF_MAX_MONTHS, countInclusiveDays, getDateRangeError, isValidIsoDate, RECORD_EXPORT_MAX_DAYS } from './dateRange';
import { EXPORT_FORMATS, ExportDraft, getExportDraftError } from './exportDraft';
import { isValidTimeZone } from './subscription';
import { ZODIAC_SIGNS } from './zodiac';

/** Same bound as ICS/table exports: keeps synchronous searches short. */
export const ALMANAC_MAX_RANGE_DAYS = RECORD_EXPORT_MAX_DAYS;
export const ALMANAC_DEFAULT_LIMIT = 10;
export const ALMANAC_MAX_LIMIT = 40;
export const ALMANAC_MIN_YEAR = 1900;
export const ALMANAC_MAX_YEAR = 2100;
/** Searches without an end date cover one year from the start date. */
const DEFAULT_RANGE_EXTRA_DAYS = 365;

const QUARTER_NAMES = ['New Moon', 'First Quarter', 'Full Moon', 'Third Quarter'] as const;
const ECLIPSE_TYPES = ['solar', 'lunar'] as const;
const ECLIPSE_KINDS = ['total', 'partial', 'annular', 'penumbral'] as const;
const ORDERS = ['earliest', 'latest'] as const;
const HEMISPHERES = ['northern', 'southern'] as const;
/** Export event types, named as in the app's filters. */
const EXPORT_EVENTS = ['moon_phases', 'sign_changes', 'noon_signs', 'eclipses'] as const;
const SIGN_NAMES = ZODIAC_SIGNS.map((sign) => sign.name);
const PHASE_NAMES = Object.keys(MOON_PHASE_MEANINGS) as MoonPhaseName[];

export type AlmanacToolName =
  | 'find_moon_phases'
  | 'find_sign_ingresses'
  | 'find_eclipses'
  | 'get_moon_on_date'
  | 'get_traditional_meaning'
  | 'prepare_export';

/** The user's settings, which tools fall back to when arguments are omitted. */
export interface AlmanacContext {
  timezone: string;
  hemisphere: Hemisphere;
  /** Clock for resolving "today"; injectable for tests and evals. */
  now?: Date;
}

export interface AlmanacToolSchema {
  name: AlmanacToolName;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
}

export interface AlmanacRecordsResult {
  ok: true;
  tool: AlmanacToolName;
  timezone: string;
  startDate: string;
  endDate: string;
  /** Matching events before `limit` was applied. */
  total: number;
  truncated: boolean;
  records: AstroRecord[];
}

/** The app's own traditional interpretation copy, as shown in the zodiac guide and exports. */
export type Interpretation =
  | {
      kind: 'sign';
      name: string;
      element: string;
      modality: string;
      ruler: string;
      theme: string;
      description: string;
      activities: string[];
    }
  | { kind: 'phase'; name: MoonPhaseName; meaning: string };

export interface AlmanacInterpretationResult {
  ok: true;
  tool: 'get_traditional_meaning';
  interpretations: Interpretation[];
}

/** Export settings for the user to review in the export dialog. Never a file. */
export interface AlmanacExportResult {
  ok: true;
  tool: 'prepare_export';
  draft: ExportDraft;
}

export type AlmanacToolResult =
  | AlmanacRecordsResult
  | AlmanacInterpretationResult
  | AlmanacExportResult
  | { ok: false; tool: string; error: string };

const rangeParameters = {
  start_date: {
    type: 'string',
    description: 'First local date to search, YYYY-MM-DD. Defaults to today.',
  },
  end_date: {
    type: 'string',
    description: `Last local date to search (inclusive), YYYY-MM-DD. Defaults to one year after start_date. At most ${ALMANAC_MAX_RANGE_DAYS} days after start_date.`,
  },
  timezone: {
    type: 'string',
    description: "IANA timezone for dates and times, e.g. 'Asia/Tokyo'. Defaults to the user's timezone.",
  },
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: ALMANAC_MAX_LIMIT,
    description: `Maximum events to return. Defaults to ${ALMANAC_DEFAULT_LIMIT}.`,
  },
  order: {
    type: 'string',
    enum: ORDERS,
    description: "'earliest' (default) returns the first matches in the range; 'latest' returns the last, most recent first.",
  },
};

export const ALMANAC_TOOL_SCHEMAS: AlmanacToolSchema[] = [
  {
    name: 'find_moon_phases',
    description:
      'Find exact primary Moon phases (New Moon, First Quarter, Full Moon, Third Quarter) in a date range, optionally only those in a given zodiac sign.',
    parameters: {
      type: 'object',
      properties: {
        ...rangeParameters,
        phases: {
          type: 'array',
          items: { type: 'string', enum: QUARTER_NAMES },
          description: 'Phases to include. Defaults to all four.',
        },
        sign: {
          type: 'string',
          enum: SIGN_NAMES,
          description: 'Only phases occurring while the Moon is in this tropical sign.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'find_sign_ingresses',
    description:
      'Find exact moments the Moon enters a tropical zodiac sign in a date range, optionally only entries into one sign.',
    parameters: {
      type: 'object',
      properties: {
        ...rangeParameters,
        sign: {
          type: 'string',
          enum: SIGN_NAMES,
          description: 'Only ingresses into this sign.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'find_eclipses',
    description:
      'Find solar and lunar eclipses in a date range. Times are global peaks, not local visibility.',
    parameters: {
      type: 'object',
      properties: {
        ...rangeParameters,
        type: { type: 'string', enum: ECLIPSE_TYPES, description: 'Only solar or only lunar eclipses.' },
        kind: { type: 'string', enum: ECLIPSE_KINDS, description: 'Only eclipses of this kind.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_moon_on_date',
    description:
      "Get the Moon's sign and phase at 12:00 local time on one date, plus any exact phases, ingresses, or eclipses on that date.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Local date, YYYY-MM-DD. Defaults to today.' },
        timezone: rangeParameters.timezone,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_traditional_meaning',
    description:
      "Get AstroMoon's traditional astrological interpretation of a zodiac sign, a Moon phase, or both. Use this instead of your own knowledge for meanings.",
    parameters: {
      type: 'object',
      properties: {
        sign: { type: 'string', enum: SIGN_NAMES, description: 'Tropical zodiac sign.' },
        phase: { type: 'string', enum: PHASE_NAMES, description: 'One of the eight Moon phase categories.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'prepare_export',
    description:
      'Prepare export settings when the user wants to download or print a calendar. The app opens its export dialog prefilled with them for the user to review and download; this tool never creates a file. Give the range as start_date and end_date, as a year, or as a month (optionally with months).',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: EXPORT_FORMATS,
          description: `'ics' for a calendar-app file, 'calendar_pdf' for printable month grids (whole months, at most ${CALENDAR_PDF_MAX_MONTHS}), 'table_pdf' for a printable list of events. ICS and table exports cover at most ${RECORD_EXPORT_MAX_DAYS} days.`,
        },
        start_date: { type: 'string', description: 'First local date, YYYY-MM-DD.' },
        end_date: { type: 'string', description: 'Last local date (inclusive), YYYY-MM-DD.' },
        year: { type: 'integer', description: 'A whole calendar year, instead of start_date and end_date.' },
        month: { type: 'string', description: 'A whole month, YYYY-MM, instead of start_date and end_date.' },
        months: {
          type: 'integer',
          minimum: 1,
          maximum: CALENDAR_PDF_MAX_MONTHS,
          description: 'With month: how many consecutive whole months, starting with that month. Defaults to 1.',
        },
        include: {
          type: 'array',
          items: { type: 'string', enum: EXPORT_EVENTS },
          description: "Event types to include: 'moon_phases' (always all four: New, First Quarter, Full, Third Quarter; exports can't include only some of them, so say so if the user asked for fewer), 'sign_changes' (Moon entering a sign), 'noon_signs' (daily sign and phase at noon), 'eclipses'. Defaults to all four types.",
        },
        timezone: rangeParameters.timezone,
        hemisphere: {
          type: 'string',
          enum: HEMISPHERES,
          description: "Moon orientation in the export. Defaults to the user's hemisphere.",
        },
      },
      required: ['format'],
      additionalProperties: false,
    },
  },
];

class ToolArgumentError extends Error {}

type Args = Record<string, unknown>;

function readArgs(raw: unknown, tool: AlmanacToolName): Args {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ToolArgumentError('Arguments must be a JSON object.');
  }
  const schema = ALMANAC_TOOL_SCHEMAS.find((s) => s.name === tool)!;
  const allowed = Object.keys(schema.parameters.properties as object);
  const unknown = Object.keys(raw).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new ToolArgumentError(`Unknown argument(s): ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}.`);
  }
  return raw as Args;
}

function optionalString(args: Args, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ToolArgumentError(`${key} must be a string.`);
  return value.trim();
}

/** Case-insensitive match against allowed values, returning the canonical spelling. */
function matchChoice<T extends string>(value: string, key: string, choices: readonly T[]): T {
  const match = choices.find((choice) => choice.toLowerCase() === value.toLowerCase());
  if (!match) throw new ToolArgumentError(`${key} must be one of: ${choices.join(', ')}.`);
  return match;
}

function optionalChoice<T extends string>(args: Args, key: string, choices: readonly T[]): T | undefined {
  const value = optionalString(args, key);
  return value === undefined ? undefined : matchChoice(value, key, choices);
}

function optionalChoiceList<T extends string>(args: Args, key: string, choices: readonly T[]): T[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string')) {
    throw new ToolArgumentError(`${key} must be a non-empty array of: ${choices.join(', ')}.`);
  }
  return value.map((item: string) => matchChoice(item.trim(), key, choices));
}

function resolveTimezone(args: Args, ctx: AlmanacContext): string {
  const timezone = optionalString(args, 'timezone') || ctx.timezone;
  if (!isValidTimeZone(timezone)) throw new ToolArgumentError(`Unknown IANA timezone: ${timezone}.`);
  return timezone;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function checkYearBounds(date: string, key: string): void {
  const year = Number(date.slice(0, 4));
  if (year < ALMANAC_MIN_YEAR || year > ALMANAC_MAX_YEAR) {
    throw new ToolArgumentError(`${key} must be between ${ALMANAC_MIN_YEAR} and ${ALMANAC_MAX_YEAR}.`);
  }
}

function resolveDate(args: Args, key: string, fallback: string): string {
  const date = optionalString(args, key) || fallback;
  if (!isValidIsoDate(date)) throw new ToolArgumentError(`${key} must be a real date in YYYY-MM-DD form.`);
  checkYearBounds(date, key);
  return date;
}

function today(ctx: AlmanacContext, timezone: string): string {
  return getLocalDateComponents(ctx.now ?? new Date(), timezone).dateString;
}

interface ResolvedRange {
  timezone: string;
  startDate: string;
  endDate: string;
  limit: number;
  order: (typeof ORDERS)[number];
}

function resolveRange(args: Args, ctx: AlmanacContext): ResolvedRange {
  const timezone = resolveTimezone(args, ctx);
  const startDate = resolveDate(args, 'start_date', today(ctx, timezone));
  const endDate = resolveDate(args, 'end_date', addDays(startDate, DEFAULT_RANGE_EXTRA_DAYS));
  const rangeError = getDateRangeError(startDate, endDate);
  if (rangeError) throw new ToolArgumentError('end_date must be on or after start_date.');
  if (countInclusiveDays(startDate, endDate) > ALMANAC_MAX_RANGE_DAYS) {
    throw new ToolArgumentError(`Ranges are limited to ${ALMANAC_MAX_RANGE_DAYS} days. Search a shorter range.`);
  }

  const rawLimit = args.limit;
  if (
    rawLimit !== undefined &&
    rawLimit !== null &&
    (typeof rawLimit !== 'number' || !Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > ALMANAC_MAX_LIMIT)
  ) {
    throw new ToolArgumentError(`limit must be a whole number from 1 to ${ALMANAC_MAX_LIMIT}.`);
  }
  const limit = typeof rawLimit === 'number' ? rawLimit : ALMANAC_DEFAULT_LIMIT;
  const order = optionalChoice(args, 'order', ORDERS) ?? 'earliest';
  return { timezone, startDate, endDate, limit, order };
}

function byTime(a: AstroRecord, b: AstroRecord): number {
  return (a.utcTime?.getTime() ?? 0) - (b.utcTime?.getTime() ?? 0);
}

/** Runs a UTC-window search and keeps only events on the requested local dates. */
function searchRange(
  range: ResolvedRange,
  search: (startUtc: Date, endUtc: Date, timezone: string) => AstroRecord[]
): AstroRecord[] {
  const { startUtc, endUtc } = getLocalDateRangeUtc(range.startDate, range.endDate, range.timezone);
  return search(startUtc, endUtc, range.timezone)
    .filter((rec) => rec.localDateString >= range.startDate && rec.localDateString <= range.endDate)
    .sort(byTime);
}

function finish(tool: AlmanacToolName, range: ResolvedRange, matches: AstroRecord[]): AlmanacToolResult {
  const ordered = range.order === 'latest' ? [...matches].reverse() : matches;
  return {
    ok: true,
    tool,
    timezone: range.timezone,
    startDate: range.startDate,
    endDate: range.endDate,
    total: matches.length,
    truncated: matches.length > range.limit,
    records: ordered.slice(0, range.limit),
  };
}

const TOOLS: Record<AlmanacToolName, (args: Args, ctx: AlmanacContext) => AlmanacToolResult> = {
  find_moon_phases(args, ctx) {
    const range = resolveRange(args, ctx);
    const phases = optionalChoiceList(args, 'phases', QUARTER_NAMES);
    const sign = optionalChoice(args, 'sign', SIGN_NAMES);
    const matches = searchRange(range, getQuartersInRange).filter(
      (rec) =>
        (!phases || phases.includes(rec.metadata.quarterType!)) &&
        (!sign || rec.sign.name === sign)
    );
    return finish('find_moon_phases', range, matches);
  },

  find_sign_ingresses(args, ctx) {
    const range = resolveRange(args, ctx);
    const sign = optionalChoice(args, 'sign', SIGN_NAMES);
    const matches = searchRange(range, findIngressesInRange).filter(
      (rec) => !sign || rec.metadata.toSign?.name === sign
    );
    return finish('find_sign_ingresses', range, matches);
  },

  find_eclipses(args, ctx) {
    const range = resolveRange(args, ctx);
    const type = optionalChoice(args, 'type', ECLIPSE_TYPES);
    const kind = optionalChoice(args, 'kind', ECLIPSE_KINDS);
    const matches = searchRange(range, getEclipsesInRange).filter(
      (rec) =>
        (!type || rec.metadata.eclipseType === type) &&
        (!kind || rec.metadata.eclipseKind === kind)
    );
    return finish('find_eclipses', range, matches);
  },

  get_moon_on_date(args, ctx) {
    const timezone = resolveTimezone(args, ctx);
    const date = resolveDate(args, 'date', today(ctx, timezone));
    const { days, error } = generateRangeDataset(date, date, ctx.hemisphere, timezone);
    if (error || days.length !== 1) throw new Error(error || 'No snapshot for date.');
    // Noon snapshot first, then that date's exact events in time order.
    const [snapshot, ...events] = days[0].events;
    const records = [snapshot, ...events.sort(byTime)];
    return {
      ok: true,
      tool: 'get_moon_on_date',
      timezone,
      startDate: date,
      endDate: date,
      total: records.length,
      truncated: false,
      records,
    };
  },

  get_traditional_meaning(args) {
    const signName = optionalChoice(args, 'sign', SIGN_NAMES);
    const phaseName = optionalChoice(args, 'phase', PHASE_NAMES);
    if (!signName && !phaseName) throw new ToolArgumentError('Provide a sign, a phase, or both.');

    const interpretations: Interpretation[] = [];
    if (signName) {
      const sign = ZODIAC_SIGNS.find((s) => s.name === signName)!;
      interpretations.push({
        kind: 'sign',
        name: sign.name,
        element: sign.element,
        modality: sign.modality,
        ruler: sign.ruler,
        theme: sign.theme,
        description: sign.description,
        activities: sign.activities,
      });
    }
    if (phaseName) {
      interpretations.push({ kind: 'phase', name: phaseName, meaning: MOON_PHASE_MEANINGS[phaseName] });
    }
    return { ok: true, tool: 'get_traditional_meaning', interpretations };
  },

  prepare_export(args, ctx) {
    const format = optionalChoice(args, 'format', EXPORT_FORMATS);
    if (!format) throw new ToolArgumentError(`format is required: one of ${EXPORT_FORMATS.join(', ')}.`);
    const { startDate, endDate } = resolveExportRange(args);
    const include = optionalChoiceList(args, 'include', EXPORT_EVENTS) ?? EXPORT_EVENTS;
    const draft: ExportDraft = {
      format,
      startDate,
      endDate,
      timezone: resolveTimezone(args, ctx),
      hemisphere: optionalChoice(args, 'hemisphere', HEMISPHERES) ?? ctx.hemisphere,
      includeMajorPhases: include.includes('moon_phases'),
      includeIngresses: include.includes('sign_changes'),
      includeDailySigns: include.includes('noon_signs'),
      includeEclipses: include.includes('eclipses'),
    };
    const error = getExportDraftError(draft);
    if (error) throw new ToolArgumentError(error);
    return { ok: true, tool: 'prepare_export', draft };
  },
};

function optionalInteger(args: Args, key: string, min: number, max: number): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ToolArgumentError(`${key} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/** Exactly one of: start_date and end_date, year, or month (with optional months). */
function resolveExportRange(args: Args): { startDate: string; endDate: string } {
  const year = optionalInteger(args, 'year', ALMANAC_MIN_YEAR, ALMANAC_MAX_YEAR);
  const month = optionalString(args, 'month');
  const months = optionalInteger(args, 'months', 1, CALENDAR_PDF_MAX_MONTHS);
  const hasDates = args.start_date !== undefined || args.end_date !== undefined;
  const forms = [hasDates, year !== undefined, month !== undefined].filter(Boolean).length;
  if (forms !== 1) {
    throw new ToolArgumentError('Give the range one way: start_date and end_date, a year, or a month (with optional months).');
  }
  if (months !== undefined && month === undefined) throw new ToolArgumentError('months goes with month.');

  if (year !== undefined) return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  if (month !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ToolArgumentError('month must be YYYY-MM.');
    const startDate = `${month}-01`;
    checkYearBounds(startDate, 'month');
    const [y, m] = month.split('-').map(Number);
    // Day 0 of the month after the last one is that month's last day.
    const endDate = new Date(Date.UTC(y, m - 1 + (months ?? 1), 0)).toISOString().slice(0, 10);
    checkYearBounds(endDate, 'month');
    return { startDate, endDate };
  }
  if (args.start_date === undefined || args.end_date === undefined) {
    throw new ToolArgumentError('Give both start_date and end_date.');
  }
  const startDate = resolveDate(args, 'start_date', '');
  const endDate = resolveDate(args, 'end_date', '');
  return { startDate, endDate };
}

export function isAlmanacToolName(name: string): name is AlmanacToolName {
  return Object.prototype.hasOwnProperty.call(TOOLS, name);
}

/**
 * Runs one tool call. Invalid arguments and unknown tools come back as
 * `{ ok: false, error }` with a message the model can act on; nothing is
 * calculated for a rejected call.
 */
export function runAlmanacTool(name: string, args: unknown, ctx: AlmanacContext): AlmanacToolResult {
  if (!isAlmanacToolName(name)) {
    return { ok: false, tool: name, error: `Unknown tool: ${name}.` };
  }
  try {
    return TOOLS[name](readArgs(args, name), ctx);
  } catch (err) {
    if (err instanceof ToolArgumentError) return { ok: false, tool: name, error: err.message };
    console.error(`Almanac tool ${name} failed:`, err);
    return { ok: false, tool: name, error: 'The calculation failed for these arguments.' };
  }
}
