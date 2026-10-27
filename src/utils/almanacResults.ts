/**
 * Output formats for almanac tool results.
 *
 * - Model format: compact JSON sent back to the language model, small enough
 *   to keep free-tier token budgets in check.
 * - Event view: JSON-safe records for the browser, which renders every date
 *   and time an answer cites from these, never from model text.
 */

import { AstroEventType, AstroRecord, Hemisphere } from '../types';
import { AlmanacToolResult, Interpretation } from './almanacTools';

export interface ModelRecord {
  id: string;
  type: AstroEventType;
  /** Local date in the result's timezone. */
  date: string;
  /** Local HH:mm for timed events. */
  time?: string;
  title: string;
  sign: string;
  from_sign?: string;
  /** Noon-snapshot phase and illumination, for daily records. */
  phase?: string;
  illumination_pct?: number;
}

export type ModelToolResult =
  | {
      ok: true;
      timezone: string;
      start_date: string;
      end_date: string;
      total: number;
      truncated: boolean;
      events: ModelRecord[];
    }
  | { ok: true; interpretations: Interpretation[] }
  | { ok: false; error: string };

export interface EventView {
  id: string;
  eventType: AstroEventType;
  /** ISO 8601 UTC instant for timed events. */
  utcTime?: string;
  localDateString: string;
  formattedLocalTime?: string;
  timezone: string;
  isAllDay: boolean;
  title: string;
  signName: string;
  signSymbol: string;
  phaseName: string;
  phaseEmoji: string;
  illuminationPct: number;
  quarterType?: 'New Moon' | 'First Quarter' | 'Full Moon' | 'Third Quarter';
  eclipseType?: 'solar' | 'lunar';
  eclipseKind?: 'total' | 'partial' | 'annular' | 'penumbral';
  fromSign?: string;
  toSign?: string;
}

/** Record titles start with an emoji or sign glyph; the model doesn't need it. */
function plainTitle(title: string): string {
  return title.replace(/^[^\p{L}]+/u, '');
}

export function toModelRecord(record: AstroRecord): ModelRecord {
  const compact: ModelRecord = {
    id: record.id,
    type: record.eventType,
    date: record.localDateString,
    title: plainTitle(record.title),
    sign: record.sign.name,
  };
  if (record.formattedLocalTime && !record.isAllDay) compact.time = record.formattedLocalTime;
  if (record.metadata.fromSign) compact.from_sign = record.metadata.fromSign.name;
  if (record.eventType === 'daily_summary') {
    compact.phase = record.phase.name;
    compact.illumination_pct = Math.round(record.phase.fraction * 100);
  }
  return compact;
}

export function toModelResult(result: AlmanacToolResult): ModelToolResult {
  if ('error' in result) return { ok: false, error: result.error };
  if ('interpretations' in result) return { ok: true, interpretations: result.interpretations };
  return {
    ok: true,
    timezone: result.timezone,
    start_date: result.startDate,
    end_date: result.endDate,
    total: result.total,
    truncated: result.truncated,
    events: result.records.map(toModelRecord),
  };
}

export function toEventView(record: AstroRecord, timezone: string, hemisphere: Hemisphere): EventView {
  const { phase, metadata } = record;
  // Records carry northern emoji; quarter titles follow the selected hemisphere, as in ICS exports.
  const phaseEmoji = hemisphere === 'southern' ? phase.southernEmoji : phase.emoji;
  const title =
    record.eventType === 'quarter'
      ? `${phaseEmoji} ${metadata.quarterType || phase.name} in ${record.sign.name}`
      : record.title;

  return {
    id: record.id,
    eventType: record.eventType,
    utcTime: record.utcTime?.toISOString(),
    localDateString: record.localDateString,
    formattedLocalTime: record.isAllDay ? undefined : record.formattedLocalTime,
    timezone,
    isAllDay: record.isAllDay,
    title,
    signName: record.sign.name,
    signSymbol: record.sign.symbol,
    phaseName: phase.name,
    phaseEmoji,
    illuminationPct: Math.round(phase.fraction * 100),
    quarterType: metadata.quarterType,
    eclipseType: metadata.eclipseType,
    eclipseKind: metadata.eclipseKind,
    fromSign: metadata.fromSign?.name,
    toSign: metadata.toSign?.name,
  };
}
