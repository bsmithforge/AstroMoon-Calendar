/**
 * Ask the Almanac: tool loop and grounding check.
 *
 * The model may call the almanac tools for up to ASK_MAX_TOOL_ROUNDS rounds,
 * then must answer citing events as {{event:<id>}} tokens. An answer passes
 * only if every token names a record a tool returned in this request and the
 * surrounding text writes no dates, times, years, months, or weekdays itself
 * (ones the user typed are allowed). A failing answer gets one correction; if
 * that fails too, the reply lists the tool results instead. The browser
 * renders every cited event from the returned event views, so displayed
 * dates and times always come from the engine.
 */

import { Hemisphere } from '../../src/types';
import { EventView, toEventView, toModelResult } from '../../src/utils/almanacResults';
import { ALMANAC_TOOL_SCHEMAS, AlmanacContext, runAlmanacTool } from '../../src/utils/almanacTools';
import { getLocalDateComponents } from '../../src/utils/astronomy';
import { EXPORT_FORMAT_LABELS, ExportDraft } from '../../src/utils/exportDraft';
import type { AnswerSegment, AskResult, TraceEntry } from '../../src/utils/askClient';
import { buildCorrectionMessage, buildSystemPrompt } from './prompt';
import { ChatMessage, ChatModel, ChatTool, ProviderError, ToolCall } from './provider';

export const ASK_MAX_TOOL_ROUNDS = 4;
export const ASK_MAX_TOOL_CALLS_PER_ROUND = 4;
export const ASK_MAX_TOKENS = 500;
export const ASK_CALL_TIMEOUT_MS = 20_000;
/** Whole-request budget across model calls. */
export const ASK_DEADLINE_MS = 25_000;
const FALLBACK_EVENT_LIMIT = 5;

export interface AskInput {
  question: string;
  timezone: string;
  hemisphere: Hemisphere;
}

export interface AskOptions {
  model: ChatModel;
  now?: Date;
  deadlineMs?: number;
  callTimeoutMs?: number;
}

// The response types are shared with the browser client, which defines them.
export type { AnswerSegment, AskResult, TraceEntry } from '../../src/utils/askClient';

const TOOLS: ChatTool[] = ALMANAC_TOOL_SCHEMAS.map(({ name, description, parameters }) => ({
  type: 'function',
  function: { name, description, parameters },
}));

const TOKEN = /\{\{\s*event\s*:\s*([^}\s]+)\s*\}\}/g;

const MONTHS = 'january|february|march|april|june|july|august|september|october|november|december';
const MONTHS_SHORT = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const WEEKDAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
// "May" alone is too often the verb; it is caught when followed by a day number.
const RAW_DATE_PATTERNS = [
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
  /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}\b/g,
  /\b\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?)(?![a-z])/gi,
  /\b(?:19|20)\d{2}\b/g,
  new RegExp(`\\b(?:${MONTHS})\\b`, 'gi'),
  new RegExp(`\\b(?:${MONTHS_SHORT})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS}|may)\\b`, 'gi'),
  new RegExp(`\\b(?:${WEEKDAYS})\\b`, 'gi'),
];

/** Date-like text the model wrote itself, in text order, ignoring anything the user also typed. */
export function findRawDateText(text: string, question: string): string[] {
  const asked = question.toLowerCase();
  const spans = RAW_DATE_PATTERNS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => ({ start: match.index!, end: match.index! + match[0].length, text: match[0] }))
  ).sort((a, b) => a.start - b.start || b.end - a.end);

  const found: string[] = [];
  let coveredUntil = -1;
  for (const span of spans) {
    // Skip pieces of a longer match, e.g. the year inside 2026-11-24.
    if (span.end <= coveredUntil) continue;
    coveredUntil = span.end;
    if (!asked.includes(span.text.toLowerCase()) && !found.includes(span.text)) found.push(span.text);
  }
  return found;
}

type GroundingCheck =
  | { ok: true; segments: AnswerSegment[]; citedIds: string[] }
  | { ok: false; problems: string[] };

export function checkGrounding(answer: string, known: Map<string, EventView>, question: string): GroundingCheck {
  if (!answer) return { ok: false, problems: ['it was empty'] };

  const segments: AnswerSegment[] = [];
  const citedIds: string[] = [];
  const unknownIds: string[] = [];
  let cursor = 0;
  for (const match of answer.matchAll(TOKEN)) {
    const id = match[1];
    if (match.index! > cursor) segments.push({ type: 'text', text: answer.slice(cursor, match.index) });
    segments.push({ type: 'event', id });
    cursor = match.index! + match[0].length;
    if (!known.has(id)) unknownIds.push(id);
    else if (!citedIds.includes(id)) citedIds.push(id);
  }
  if (cursor < answer.length) segments.push({ type: 'text', text: answer.slice(cursor) });

  const problems: string[] = [];
  if (unknownIds.length > 0) {
    problems.push(`it cites ${unknownIds.length === 1 ? 'an event id' : 'event ids'} no tool returned (${unknownIds.slice(0, 3).join(', ')})`);
  }
  const raw = findRawDateText(answer.replace(TOKEN, ' '), question);
  if (raw.length > 0) {
    problems.push(`it writes date or time text itself ("${raw.slice(0, 3).join('", "')}")`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, segments, citedIds };
}

function describeResult(result: ReturnType<typeof runAlmanacTool>): string {
  if ('error' in result) return result.error;
  if ('interpretations' in result) return result.interpretations.map((i) => i.name).join(', ');
  if ('draft' in result) {
    const { draft } = result;
    return `${EXPORT_FORMAT_LABELS[draft.format]} · ${draft.startDate} to ${draft.endDate} · ${draft.timezone}`;
  }
  const range = result.startDate === result.endDate ? result.startDate : `${result.startDate} to ${result.endDate}`;
  const count = result.truncated ? `${result.total} found, ${result.records.length} returned` : `${result.total} found`;
  return `${range} · ${result.timezone} · ${count}`;
}

function byInstant(a: EventView, b: EventView): number {
  return (a.utcTime ?? a.localDateString).localeCompare(b.utcTime ?? b.localDateString);
}

function fallbackAnswer(found: Map<string, EventView>, hasDraft: boolean): { segments: AnswerSegment[]; events: EventView[] } {
  const events = [...found.values()].sort(byInstant);
  if (events.length === 0) {
    const text = hasDraft
      ? 'Your export is ready to review below.'
      : "I couldn't answer that from the almanac's calculations. Try asking about Moon phases, zodiac signs, or eclipses.";
    return { segments: [{ type: 'text', text }], events: [] };
  }
  const shown = events.slice(0, FALLBACK_EVENT_LIMIT);
  const segments: AnswerSegment[] = [{ type: 'text', text: "Here's what the almanac found:" }];
  for (const event of shown) segments.push({ type: 'text', text: '\n• ' }, { type: 'event', id: event.id });
  if (events.length > shown.length) segments.push({ type: 'text', text: `\n…and ${events.length - shown.length} more.` });
  return { segments, events: shown };
}

export async function askAlmanac(input: AskInput, options: AskOptions): Promise<AskResult> {
  const now = options.now ?? new Date();
  const deadlineMs = options.deadlineMs ?? ASK_DEADLINE_MS;
  const callTimeoutMs = options.callTimeoutMs ?? ASK_CALL_TIMEOUT_MS;
  const ctx: AlmanacContext = { timezone: input.timezone, hemisphere: input.hemisphere, now };
  const today = getLocalDateComponents(now, input.timezone).dateString;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt({ today, timezone: input.timezone, hemisphere: input.hemisphere }) },
    { role: 'user', content: input.question },
  ];
  const found = new Map<string, EventView>();
  let exportDraft: ExportDraft | null = null;
  const trace: TraceEntry[] = [];
  let model: string | null = null;
  let toolRounds = 0;
  let corrections = 0;
  const started = Date.now();

  const runCall = (call: ToolCall): string => {
    let args: unknown;
    try {
      args = call.function.arguments?.trim() ? JSON.parse(call.function.arguments) : {};
    } catch {
      trace.push({ tool: call.function.name, arguments: call.function.arguments, ok: false, detail: 'Arguments were not valid JSON.' });
      return JSON.stringify({ ok: false, error: 'Arguments were not valid JSON.' });
    }
    const result = runAlmanacTool(call.function.name, args, ctx);
    if ('records' in result) {
      for (const record of result.records) {
        if (!found.has(record.id)) found.set(record.id, toEventView(record, result.timezone, input.hemisphere));
      }
    }
    // The latest valid draft wins, so a corrected call replaces an earlier one.
    if ('draft' in result) exportDraft = result.draft;
    trace.push({ tool: call.function.name, arguments: args, ok: result.ok, detail: describeResult(result) });
    return JSON.stringify(toModelResult(result));
  };

  while (true) {
    const remaining = deadlineMs - (Date.now() - started);
    if (remaining <= 0) throw new ProviderError('timeout', `No answer within ${deadlineMs} ms.`);
    const response = await options.model({
      messages,
      tools: TOOLS,
      maxTokens: ASK_MAX_TOKENS,
      timeoutMs: Math.min(callTimeoutMs, remaining),
    });
    model = response.model;

    if (response.toolCalls.length > 0) {
      if (toolRounds >= ASK_MAX_TOOL_ROUNDS) break;
      toolRounds++;
      messages.push({ role: 'assistant', content: response.content, tool_calls: response.toolCalls });
      response.toolCalls.forEach((call, index) => {
        const content = index < ASK_MAX_TOOL_CALLS_PER_ROUND
          ? runCall(call)
          : JSON.stringify({ ok: false, error: `Too many tool calls at once; make at most ${ASK_MAX_TOOL_CALLS_PER_ROUND}.` });
        messages.push({ role: 'tool', tool_call_id: call.id, content });
      });
      continue;
    }

    const answer = response.content?.trim() ?? '';
    const check = checkGrounding(answer, found, input.question);
    if ('citedIds' in check) {
      return {
        segments: check.segments,
        events: check.citedIds.map((id) => found.get(id)!),
        trace,
        model,
        source: 'model',
        corrections,
        exportDraft,
      };
    }
    if (corrections > 0) break;
    corrections++;
    messages.push({ role: 'assistant', content: answer }, { role: 'user', content: buildCorrectionMessage(check.problems) });
  }

  return { ...fallbackAnswer(found, exportDraft !== null), trace, model, source: 'fallback', corrections, exportDraft };
}
