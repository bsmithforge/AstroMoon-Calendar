import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toEventView } from '../src/utils/almanacResults';
import { runAlmanacTool } from '../src/utils/almanacTools';
import {
  AskResult,
  askTheAlmanac,
  describeEventTime,
  describeEventTitle,
  describeRetryAfter,
} from '../src/utils/askClient';

const request = { question: 'When is the next full moon?', timezone: 'UTC', hemisphere: 'northern' as const };
const result: AskResult = { segments: [{ type: 'text', text: 'Hi.' }], events: [], trace: [], model: 'm', source: 'model', corrections: 0 };

function respond(response: Response | Error) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response;
  }) as typeof fetch;
  return { impl, calls };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('the client posts the question and returns the answer', async () => {
  const { impl, calls } = respond(json(200, result));
  assert.deepEqual(await askTheAlmanac(request, undefined, impl), { ok: true, result });
  assert.equal(calls[0].url, '/api/ask');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), request);
});

test('the client turns every failure into a code and a message for people', async () => {
  const cases: [Response | Error, string, number?][] = [
    [json(503, { error: 'resting', message: 'x', retryAfter: 120 }), 'resting', 120],
    [json(503, { error: 'not_configured', message: 'x' }), 'not_configured'],
    [json(503, { error: 'timeout', message: 'x' }), 'timeout'],
    [json(500, { error: 'internal', message: 'x' }), 'internal'],
    [json(418, { error: 'teapot' }), 'unavailable'],
    [new Response('<html>Not found</html>', { status: 404 }), 'not_configured'],
    [new Response('<html>Bad gateway</html>', { status: 502 }), 'unavailable'],
    [json(200, { unexpected: true }), 'unavailable'],
    [new TypeError('Failed to fetch'), 'network'],
  ];
  for (const [response, error, retryAfterSeconds] of cases) {
    const outcome = await askTheAlmanac(request, undefined, respond(response).impl);
    assert.ok('error' in outcome);
    assert.equal(outcome.error, error);
    assert.equal(outcome.retryAfterSeconds, retryAfterSeconds);
    assert.notEqual(outcome.message, 'x', 'uses the dialog’s own wording');
  }

  const invalid = await askTheAlmanac(request, undefined, respond(json(400, { error: 'invalid_request', message: 'Ask a question.' })).impl);
  assert.ok('message' in invalid);
  assert.equal(invalid.message, 'Ask a question.');
});

test('a cancelled request rejects instead of reporting an error', async () => {
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  await assert.rejects(askTheAlmanac(request, undefined, respond(abort).impl), (err) => (err as Error).name === 'AbortError');
});

test('event times come from the engine, in the event’s timezone', () => {
  const ctx = { timezone: 'Asia/Kolkata', hemisphere: 'southern' as const, now: new Date('2026-10-27T17:00:00Z') };
  const full = runAlmanacTool('find_moon_phases', { phases: ['Full Moon'], limit: 1 }, ctx);
  const day = runAlmanacTool('get_moon_on_date', { date: '2026-11-24' }, ctx);
  assert.ok('records' in full && 'records' in day);

  const fullView = toEventView(full.records[0], 'Asia/Kolkata', 'southern');
  assert.equal(describeEventTime(fullView), 'Tue, Nov 24, 2026, 8:24 PM GMT+5:30');
  assert.equal(describeEventTitle(fullView), '🌕 Full Moon in Gemini');

  const dayView = toEventView(day.records.find((r) => r.eventType === 'daily_summary')!, 'Asia/Kolkata', 'southern');
  assert.equal(describeEventTime(dayView), 'Tue, Nov 24, 2026, noon');
  assert.match(describeEventTitle(dayView), /^\S+ Waxing Gibbous|^\S+ Full Moon/);
});

test('retry hints round to a readable unit', () => {
  assert.equal(describeRetryAfter(20), 'in under a minute');
  assert.equal(describeRetryAfter(60), 'in about 1 minute');
  assert.equal(describeRetryAfter(170), 'in about 3 minutes');
  assert.equal(describeRetryAfter(7200), 'in about 2 hours');
});
