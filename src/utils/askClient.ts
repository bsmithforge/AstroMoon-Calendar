/**
 * Browser client for Ask the Almanac (POST /api/ask), and the response types
 * the server (server/ai/ask.ts, server/ask.ts) produces.
 *
 * Every date and time the dialog shows comes from an EventView the engine
 * computed, formatted here; the model's text never supplies one.
 */

import { Hemisphere } from '../types';
import { EventView } from './almanacResults';

export type AnswerSegment = { type: 'text'; text: string } | { type: 'event'; id: string };

/** One tool call, shown under "How this was answered". */
export interface TraceEntry {
  tool: string;
  arguments: unknown;
  ok: boolean;
  detail: string;
}

export interface AskResult {
  segments: AnswerSegment[];
  /** Events the answer cites, in first-citation order. */
  events: EventView[];
  trace: TraceEntry[];
  model: string | null;
  /** 'model' if the model's answer passed the grounding check; 'fallback' if the reply lists tool results instead. */
  source: 'model' | 'fallback';
  /** How many times the model's answer was sent back for correction (0 or 1). */
  corrections: number;
}

/** Error codes from server/ask.ts, plus 'network' when the request never got an answer. */
export type AskErrorCode =
  | 'not_configured'
  | 'resting'
  | 'timeout'
  | 'unavailable'
  | 'invalid_request'
  | 'too_large'
  | 'internal'
  | 'network';

export type AskOutcome =
  | { ok: true; result: AskResult }
  | { ok: false; error: AskErrorCode; message: string; retryAfterSeconds?: number };

export interface AskRequest {
  question: string;
  timezone: string;
  hemisphere: Hemisphere;
}

/** Matches ASK_MAX_QUESTION_LENGTH in server/ask.ts. */
export const ASK_QUESTION_MAX_LENGTH = 400;

const KNOWN_ERRORS = new Set<AskErrorCode>(['not_configured', 'resting', 'timeout', 'unavailable', 'invalid_request', 'too_large', 'internal']);

const FALLBACK_MESSAGES: Record<AskErrorCode, string> = {
  not_configured: 'Ask the Almanac isn’t available on this site right now.',
  resting: 'The almanac is resting: the free AI quota is used up for now.',
  timeout: 'The almanac took too long to answer. Try again.',
  unavailable: 'The almanac is unavailable right now. Try again later.',
  invalid_request: 'That question couldn’t be sent. Try rewording it.',
  too_large: 'That question is too long.',
  internal: 'Something went wrong while answering.',
  network: 'Couldn’t reach the almanac. Check your connection and try again.',
};

function isAskResult(value: unknown): value is AskResult {
  const result = value as AskResult;
  return !!result && Array.isArray(result.segments) && Array.isArray(result.events) && Array.isArray(result.trace);
}

export async function askTheAlmanac(
  request: AskRequest,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch
): Promise<AskOutcome> {
  let response: Response;
  try {
    response = await fetchImpl('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return { ok: false, error: 'network', message: FALLBACK_MESSAGES.network };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A static host without the function, or an HTML error page.
  }

  if (response.ok && isAskResult(body)) return { ok: true, result: body };

  const payload = (body ?? {}) as { error?: string; message?: string; retryAfter?: number | null };
  const error: AskErrorCode =
    payload.error && KNOWN_ERRORS.has(payload.error as AskErrorCode)
      ? (payload.error as AskErrorCode)
      : response.status === 404
        ? 'not_configured'
        : 'unavailable';
  // Validation messages are written for people; other codes use the dialog's own wording.
  const message = error === 'invalid_request' && payload.message ? payload.message : FALLBACK_MESSAGES[error];
  const retryAfterSeconds = typeof payload.retryAfter === 'number' ? payload.retryAfter : undefined;
  return retryAfterSeconds === undefined
    ? { ok: false, error, message }
    : { ok: false, error, message, retryAfterSeconds };
}

/** "in about 3 minutes", for the resting state. */
export function describeRetryAfter(seconds: number): string {
  if (seconds < 60) return 'in under a minute';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * When an event happens, in the event's own timezone: the exact local time for
 * timed events, the date and "noon" for daily snapshots, the date otherwise.
 */
export function describeEventTime(event: EventView): string {
  if (event.utcTime && !event.isAllDay) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: event.timezone,
      timeZoneName: 'short',
    }).format(new Date(event.utcTime));
  }
  const [year, month, day] = event.localDateString.split('-').map(Number);
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return event.eventType === 'daily_summary' ? `${date}, noon` : date;
}

/** The event's title, led by its phase emoji for daily snapshots (which have none). */
export function describeEventTitle(event: EventView): string {
  return event.eventType === 'daily_summary' ? `${event.phaseEmoji} ${event.phaseName}, ${event.title}` : event.title;
}
