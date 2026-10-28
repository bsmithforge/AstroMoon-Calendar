/**
 * Live eval for Ask the Almanac. Manual only: it calls a real provider and
 * spends free-tier quota, so it never runs in CI.
 *
 *   npm run eval:ask                              # primary provider (AI_*) from .env.local
 *   npm run eval:ask -- --provider=fallback       # the AI_FALLBACK_* provider alone
 *   npm run eval:ask -- --only=next-full-moon,eclipses-2027 --delay=6000 --out=eval.md
 *
 * Each question in evals/ask-questions.json may name the tools it should use
 * and a deterministic tool call whose results the answer must cite. Expected
 * events are computed by the real tools at eval time with the same clock and
 * timezone, so the question set holds no hardcoded dates.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { askAlmanac, AskResult } from '../server/ai/ask';
import { createChatModel, ProviderError, readProviderConfigs } from '../server/ai/provider';
import { runAlmanacTool } from '../src/utils/almanacTools';
import { Hemisphere } from '../src/types';

interface EvalQuestion {
  id: string;
  question: string;
  hemisphere?: Hemisphere;
  timezone?: string;
  /** Tools that must appear in the trace. An empty list means no tool calls. */
  expectTools?: string[];
  /** Deterministic call whose results the answer must cite. */
  expectCites?: { tool: string; args: Record<string, unknown>; take?: number; signs?: string[] };
  /** Case-insensitive regex the answer text must match. */
  expectText?: string;
  /** Timezone the cited events must be reported in. */
  expectTimezone?: string;
}

interface EvalSet {
  now: string;
  timezone: string;
  hemisphere: Hemisphere;
  questions: EvalQuestion[];
}

interface Outcome {
  id: string;
  tools: boolean | null;
  cites: boolean | null;
  text: boolean | null;
  source: AskResult['source'] | 'error';
  corrections: number;
  ms: number;
  note: string;
}

const root = path.resolve(import.meta.dirname, '..');
try {
  process.loadEnvFile(path.join(root, '.env.local'));
} catch {
  // No .env.local; rely on the shell's environment.
}

const flags = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const configs = readProviderConfigs(process.env);
const config = flags.provider === 'fallback' ? configs[1] : configs[0];
if (!config) {
  console.error(`No ${flags.provider === 'fallback' ? 'AI_FALLBACK_*' : 'AI_*'} provider configured. See .env.example.`);
  process.exit(1);
}
const model = createChatModel([config]);
const delayMs = Number(flags.delay ?? 4000);
const only = flags.only ? new Set(flags.only.split(',')) : null;

const evalSet: EvalSet = JSON.parse(readFileSync(path.join(root, 'evals/ask-questions.json'), 'utf8'));
const now = new Date(evalSet.now);
const questions = evalSet.questions.filter((q) => !only || only.has(q.id));

function expectedIds(q: EvalQuestion, timezone: string, hemisphere: Hemisphere): string[] | null {
  if (!q.expectCites) return null;
  const result = runAlmanacTool(q.expectCites.tool, q.expectCites.args, { timezone, hemisphere, now });
  if (!('records' in result)) throw new Error(`${q.id}: expectCites call failed: ${'error' in result ? result.error : 'no records'}`);
  let records = result.records;
  if (q.expectCites.signs) records = records.filter((r) => q.expectCites!.signs!.includes(r.sign.name));
  return records.slice(0, q.expectCites.take ?? records.length).map((r) => r.id);
}

function answerText(result: AskResult): string {
  return result.segments.map((s) => (s.type === 'text' ? s.text : `[${s.id}]`)).join('');
}

const mark = (value: boolean | null) => (value === null ? '–' : value ? '✓' : '✗');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const outcomes: Outcome[] = [];
let consecutiveQuota = 0;

console.log(`Ask eval: ${questions.length} questions · ${config.model} at ${config.baseUrl}\n`);
for (const [index, q] of questions.entries()) {
  if (index > 0) await sleep(delayMs);
  const timezone = q.timezone ?? evalSet.timezone;
  const hemisphere = q.hemisphere ?? evalSet.hemisphere;
  const expected = expectedIds(q, timezone, hemisphere);
  const started = Date.now();

  try {
    const result = await askAlmanac({ question: q.question, timezone, hemisphere }, { model, now });
    consecutiveQuota = 0;
    const called = result.trace.map((t) => t.tool);
    const cited = result.events.map((e) => e.id);
    const text = answerText(result);
    const missing = expected?.filter((id) => !cited.includes(id)) ?? [];
    const wrongZone = q.expectTimezone ? result.events.filter((e) => e.timezone !== q.expectTimezone).length : 0;

    const outcome: Outcome = {
      id: q.id,
      tools: q.expectTools === undefined ? null
        : q.expectTools.length === 0 ? called.length === 0
        : q.expectTools.every((tool) => called.includes(tool)),
      cites: expected === null ? null : missing.length === 0 && wrongZone === 0,
      text: q.expectText === undefined ? null : new RegExp(q.expectText, 'i').test(text),
      source: result.source,
      corrections: result.corrections,
      ms: Date.now() - started,
      note: [
        `tools: ${called.join(', ') || 'none'}`,
        missing.length ? `missing ${missing.length}/${expected!.length} expected events` : '',
        wrongZone ? `${wrongZone} event(s) not in ${q.expectTimezone}` : '',
      ].filter(Boolean).join('; '),
    };
    outcomes.push(outcome);
    console.log(`${mark(outcome.tools)}${mark(outcome.cites)}${mark(outcome.text)} ${q.id} (${outcome.source}, ${outcome.ms} ms)\n   ${text.replace(/\n/g, ' ')}\n`);
  } catch (err) {
    const kind = err instanceof ProviderError ? err.kind : 'exception';
    outcomes.push({ id: q.id, tools: null, cites: null, text: null, source: 'error', corrections: 0, ms: Date.now() - started, note: `${kind}: ${(err as Error).message}` });
    console.log(`!!! ${q.id}: ${kind}: ${(err as Error).message}\n`);
    consecutiveQuota = kind === 'quota' ? consecutiveQuota + 1 : 0;
    if (consecutiveQuota >= 3) {
      console.log('Stopping: three quota errors in a row.');
      break;
    }
  }
}

function rate(values: (boolean | null)[]): string {
  const scored = values.filter((v): v is boolean => v !== null);
  return scored.length ? `${scored.filter(Boolean).length}/${scored.length}` : '–';
}
const answered = outcomes.filter((o) => o.source !== 'error');
const latencies = answered.map((o) => o.ms).sort((a, b) => a - b);
const percentile = (p: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] : 0);

const report = [
  `## ${config.model} (${new URL(config.baseUrl).host})`,
  '',
  `Run ${new Date().toISOString().slice(0, 10)} · eval clock ${evalSet.now} · ${evalSet.timezone} · ${outcomes.length} questions`,
  '',
  '| Metric | Result |',
  '| --- | --- |',
  `| Expected tools called | ${rate(outcomes.map((o) => o.tools))} |`,
  `| Expected events cited | ${rate(outcomes.map((o) => o.cites))} |`,
  `| Expected text present | ${rate(outcomes.map((o) => o.text))} |`,
  `| Model answer passed grounding | ${answered.filter((o) => o.source === 'model').length}/${answered.length} |`,
  `| Needed a correction | ${answered.filter((o) => o.corrections > 0).length}/${answered.length} |`,
  `| Provider errors | ${outcomes.length - answered.length} |`,
  `| Latency median / p90 | ${percentile(0.5)} ms / ${percentile(0.9)} ms |`,
  '',
  '| Question | Tools | Cites | Text | Answer by | Corrections | ms | Notes |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...outcomes.map((o) => `| ${o.id} | ${mark(o.tools)} | ${mark(o.cites)} | ${mark(o.text)} | ${o.source} | ${o.corrections} | ${o.ms} | ${o.note} |`),
  '',
].join('\n');

console.log(report);
if (flags.out) {
  writeFileSync(path.resolve(flags.out), report);
  console.log(`Wrote ${flags.out}`);
}
