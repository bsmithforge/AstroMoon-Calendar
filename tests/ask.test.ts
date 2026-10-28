import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { askAlmanac, ASK_MAX_TOOL_CALLS_PER_ROUND, ASK_MAX_TOOL_ROUNDS, AskInput, findRawDateText } from '../server/ai/ask';
import {
  ChatModel,
  ChatRequest,
  ChatResponse,
  createChatModel,
  createProviderModel,
  ProviderError,
  providersForCountry,
  readProviderConfigs,
  ToolCall,
} from '../server/ai/provider';
import { createAskHandler } from '../server/ask';
import { ALMANAC_TOOL_SCHEMAS, runAlmanacTool } from '../src/utils/almanacTools';

/**
 * Ask the Almanac against a scripted model: no network, no keys. Each step
 * answers one model call; the tools themselves run for real.
 */

const now = new Date('2026-10-27T17:00:00Z');
const input: AskInput = { question: 'When is the next full moon?', timezone: 'UTC', hemisphere: 'northern' };
// Exact Full Moon: 2026-11-24 14:54:04 UTC.
const FULL_MOON = 'quarter-2026-11-24T14-54-04-191Z-2';

type Step = (request: ChatRequest) => ChatResponse;

function scripted(steps: Step[]) {
  const requests: ChatRequest[] = [];
  const model: ChatModel = async (request) => {
    requests.push({ ...request, messages: [...request.messages] });
    const step = steps[requests.length - 1];
    if (!step) throw new Error(`Unexpected model call #${requests.length}`);
    return step(request);
  };
  return { model, requests };
}

let callCount = 0;
function call(name: string, args: unknown): ToolCall {
  callCount++;
  return { id: `call-${callCount}`, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } };
}

const tools = (...calls: ToolCall[]): Step => () => ({ content: null, toolCalls: calls, model: 'fake-model' });
const say = (text: string): Step => () => ({ content: text, toolCalls: [], model: 'fake-model' });

/** Parsed content of the tool messages in a request, in order. */
function toolResults(request: ChatRequest): any[] {
  return request.messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content as string));
}

test('a grounded answer returns segments, cited engine events, and a trace', async () => {
  const { model, requests } = scripted([
    tools(call('find_moon_phases', { phases: ['Full Moon'], limit: 1 })),
    say(`The next Full Moon is {{event:${FULL_MOON}}}, in Gemini.`),
  ]);
  const result = await askAlmanac(input, { model, now });

  assert.equal(result.source, 'model');
  assert.equal(result.corrections, 0);
  assert.equal(result.model, 'fake-model');
  assert.deepEqual(result.segments, [
    { type: 'text', text: 'The next Full Moon is ' },
    { type: 'event', id: FULL_MOON },
    { type: 'text', text: ', in Gemini.' },
  ]);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].utcTime, '2026-11-24T14:54:04.191Z');
  assert.equal(result.events[0].formattedLocalTime, '14:54');
  assert.deepEqual(result.trace, [
    { tool: 'find_moon_phases', arguments: { phases: ['Full Moon'], limit: 1 }, ok: true, detail: '2026-10-27 to 2027-10-27 · UTC · 12 found, 1 returned' },
  ]);

  const [first] = requests;
  assert.equal(first.tools.length, 5);
  assert.match(first.messages[0].content as string, /Today is 2026-10-27 in the user's timezone, UTC/);
  assert.deepEqual(first.messages[1], { role: 'user', content: input.question });
  assert.deepEqual(toolResults(requests[1])[0].events[0].id, FULL_MOON);
});

test('several calls per round and several rounds can feed one answer', async () => {
  const { model, requests } = scripted([
    tools(
      call('find_moon_phases', { phases: ['Full Moon'], limit: 1 }),
      call('get_traditional_meaning', { sign: 'Gemini', phase: 'Full Moon' })
    ),
    tools(call('find_eclipses', { end_date: '2027-12-31', type: 'solar', kind: 'total' })),
    (request) => {
      const [eclipses] = toolResults(request).slice(-1);
      return say(`Full Moon: {{event:${FULL_MOON}}}. Total solar eclipse: {{event:${eclipses.events[0].id}}}.`)(request);
    },
  ]);
  const result = await askAlmanac(input, { model, now });

  assert.equal(result.source, 'model');
  assert.deepEqual(result.trace.map((t) => t.tool), ['find_moon_phases', 'get_traditional_meaning', 'find_eclipses']);
  assert.deepEqual(result.events.map((e) => e.localDateString), ['2026-11-24', '2027-08-02']);
  assert.equal(toolResults(requests[1])[1].interpretations[1].name, 'Full Moon');
});

test('tool errors go back to the model, which can fix its arguments', async () => {
  const { model, requests } = scripted([
    tools(call('find_moon_phases', { phases: ['Blue Moon'] }), call('find_eclipses', '{not json')),
    tools(call('find_moon_phases', { phases: ['Full Moon'], limit: 1 })),
    say(`{{event:${FULL_MOON}}}`),
  ]);
  const result = await askAlmanac(input, { model, now });

  const [phaseError, jsonError] = toolResults(requests[1]);
  assert.match(phaseError.error, /phases must be/);
  assert.equal(jsonError.error, 'Arguments were not valid JSON.');
  assert.deepEqual(result.trace.map((t) => t.ok), [false, false, true]);
  assert.equal(result.source, 'model');
});

test('an answer citing an unknown event is corrected once', async () => {
  const { model, requests } = scripted([
    tools(call('find_moon_phases', { phases: ['Full Moon'], limit: 1 })),
    say('The next Full Moon is {{event:quarter-made-up}}.'),
    say(`The next Full Moon is {{event:${FULL_MOON}}}.`),
  ]);
  const result = await askAlmanac(input, { model, now });

  const correction = requests[2].messages.at(-1)!;
  assert.equal(correction.role, 'user');
  assert.match(correction.content as string, /no tool returned \(quarter-made-up\)/);
  assert.equal(result.source, 'model');
  assert.equal(result.corrections, 1);
});

test('an answer that keeps writing dates is replaced by the tool results', async () => {
  const { model, requests } = scripted([
    tools(call('find_moon_phases', { phases: ['Full Moon'], limit: 3 })),
    say('The next Full Moon is on November 24 at 14:54.'),
    say(`It is {{event:${FULL_MOON}}}, a Tuesday.`),
  ]);
  const result = await askAlmanac(input, { model, now });

  assert.match(requests[2].messages.at(-1)!.content as string, /"November", "14:54"/);
  assert.equal(result.source, 'fallback');
  assert.equal(result.corrections, 1);
  assert.equal(result.segments[0].type === 'text' && result.segments[0].text, "Here's what the almanac found:");
  assert.deepEqual(result.events.map((e) => e.quarterType), ['Full Moon', 'Full Moon', 'Full Moon']);
  assert.equal(result.events[0].id, FULL_MOON);
  assert.equal(result.segments.filter((s) => s.type === 'event').length, 3);
});

test('years and months the user typed may appear in the answer', async () => {
  const { model } = scripted([
    tools(call('find_eclipses', { start_date: '2027-01-01', end_date: '2027-12-31' })),
    (request) => {
      const ids = toolResults(request)[0].events.map((e: { id: string }) => `{{event:${e.id}}}`);
      return say(`In 2027 there are five eclipses, including one in August: ${ids.join(', ')}.`)(request);
    },
  ]);
  const result = await askAlmanac({ ...input, question: 'Any eclipses in August 2027 or the rest of 2027?' }, { model, now });
  assert.equal(result.source, 'model');
  assert.equal(result.events.length, 5);
});

test('answers without events, such as declines, pass', async () => {
  const { model } = scripted([say('I can only help with the Moon, the zodiac, and eclipses.')]);
  const result = await askAlmanac({ ...input, question: 'Will it rain tomorrow?' }, { model, now });
  assert.equal(result.source, 'model');
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.trace, []);
});

test('empty answers fall back to a plain apology when nothing was found', async () => {
  const { model } = scripted([say(''), say('   ')]);
  const result = await askAlmanac(input, { model, now });
  assert.equal(result.source, 'fallback');
  assert.deepEqual(result.events, []);
  assert.match(result.segments[0].type === 'text' ? result.segments[0].text : '', /couldn't answer that/);
});

test('tool rounds are capped', async () => {
  const loop = tools(call('find_moon_phases', { limit: 1 }));
  const { model, requests } = scripted(Array(ASK_MAX_TOOL_ROUNDS + 1).fill(loop));
  const result = await askAlmanac(input, { model, now });
  assert.equal(requests.length, ASK_MAX_TOOL_ROUNDS + 1);
  assert.equal(result.trace.length, ASK_MAX_TOOL_ROUNDS);
  assert.equal(result.source, 'fallback');
});

test('tool calls beyond the per-round cap are refused without running', async () => {
  const calls = Array.from({ length: ASK_MAX_TOOL_CALLS_PER_ROUND + 1 }, () => call('find_eclipses', {}));
  const { model, requests } = scripted([tools(...calls), say('No answer.')]);
  const result = await askAlmanac(input, { model, now });
  const results = toolResults(requests[1]);
  assert.equal(results.length, ASK_MAX_TOOL_CALLS_PER_ROUND + 1);
  assert.match(results.at(-1).error, /Too many tool calls/);
  assert.equal(result.trace.length, ASK_MAX_TOOL_CALLS_PER_ROUND);
});

test('provider errors propagate, and the deadline bounds the whole request', async () => {
  const quota: ChatModel = async () => {
    throw new ProviderError('quota', 'limit', 30);
  };
  await assert.rejects(askAlmanac(input, { model: quota, now }), (err) => err instanceof ProviderError && err.kind === 'quota');

  const timeouts: number[] = [];
  const slow: ChatModel = async (request) => {
    timeouts.push(request.timeoutMs);
    await new Promise((resolve) => setTimeout(resolve, 40));
    return tools(call('find_eclipses', {}))(request);
  };
  await assert.rejects(
    askAlmanac(input, { model: slow, now, deadlineMs: 30, callTimeoutMs: 1000 }),
    (err) => err instanceof ProviderError && err.kind === 'timeout'
  );
  assert.ok(timeouts[0] <= 30, 'each call gets at most the remaining budget');
});

test('findRawDateText catches written dates and allows what the user typed', () => {
  assert.deepEqual(
    findRawDateText('On 2026-11-24 at 14:54 (2:54 pm), a Tuesday in November 2026. Also Nov 24th and 3 May. You may look.', 'in 2026?'),
    ['2026-11-24', '14:54', '2:54 pm', 'Tuesday', 'November', 'Nov 24th', '3 May']
  );
  assert.deepEqual(findRawDateText('Three Full Moons, two in Gemini. You may see them.', ''), []);
});

// Provider client, against a fake fetch.

function fakeFetch(responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected fetch');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const config = { baseUrl: 'https://primary.example/v1', model: 'primary-model', apiKey: 'key-1' };
const request: ChatRequest = { messages: [{ role: 'user', content: 'hi' }], tools: [], maxTokens: 50, timeoutMs: 1000 };
const okBody = (message: object) => new Response(JSON.stringify({ model: 'served-model', choices: [{ message }] }), { status: 200 });

test('provider client sends a Chat Completions request and parses tool calls', async () => {
  const toolCall = { id: 'x', type: 'function', function: { name: 'find_eclipses', arguments: '{}' } };
  const { impl, calls } = fakeFetch([okBody({ content: null, tool_calls: [toolCall] })]);
  const response = await createProviderModel(config, impl)(request);

  assert.equal(calls[0].url, 'https://primary.example/v1/chat/completions');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer key-1');
  const sent = JSON.parse(calls[0].init.body as string);
  assert.equal(sent.model, 'primary-model');
  assert.equal(sent.max_tokens, 50);
  assert.equal(sent.tool_choice, 'auto');
  assert.deepEqual(response, { content: null, toolCalls: [toolCall], model: 'served-model' });
});

test('provider failures map to typed errors', async () => {
  const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
  const cases: [Response | Error, string, number?][] = [
    [new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }), 'quota', 30],
    [new Response('{}', { status: 401 }), 'misconfigured'],
    [new Response('{}', { status: 503 }), 'unavailable'],
    [new Response('{}', { status: 400 }), 'bad_response'],
    [new Response('not json', { status: 200 }), 'bad_response'],
    [new Response('{"choices":[]}', { status: 200 }), 'bad_response'],
    [timeout, 'timeout'],
    [new TypeError('fetch failed'), 'unavailable'],
  ];
  for (const [response, kind, retryAfter] of cases) {
    const { impl } = fakeFetch([response]);
    await assert.rejects(createProviderModel(config, impl)(request), (err) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.kind, kind);
      assert.equal(err.retryAfterSeconds, retryAfter);
      return true;
    });
  }
});

test('provider error messages keep the error code but not the failed generation', async () => {
  const groq = new Response(JSON.stringify({
    error: { message: 'Failed to call a function.', code: 'tool_use_failed', failed_generation: 'secret-ish model output' },
  }), { status: 400 });
  const gemini = new Response(JSON.stringify([{ error: { code: 503, message: 'High demand.', status: 'UNAVAILABLE' } }]), { status: 503 });
  for (const [response, expected] of [[groq, '(HTTP 400, tool_use_failed)'], [gemini, '(HTTP 503, UNAVAILABLE)']] as const) {
    const { impl } = fakeFetch([response]);
    await assert.rejects(createProviderModel(config, impl)(request), (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(err.message.includes(expected), err.message);
      assert.ok(!err.message.includes('secret-ish'));
      return true;
    });
  }
});

test('the fallback provider answers when the primary fails', async () => {
  const fallback = { baseUrl: 'https://fallback.example/v1', model: 'fallback-model', apiKey: 'key-2' };
  const { impl, calls } = fakeFetch([new Response('{}', { status: 429 }), okBody({ content: 'hello' })]);
  const response = await createChatModel([config, fallback], impl)(request);
  assert.equal(response.content, 'hello');
  assert.deepEqual(calls.map((c) => c.url), ['https://primary.example/v1/chat/completions', 'https://fallback.example/v1/chat/completions']);

  const both = fakeFetch([new Response('{}', { status: 429 }), new Response('{}', { status: 503 })]);
  await assert.rejects(createChatModel([config, fallback], both.impl)(request), (err) => err instanceof ProviderError && err.kind === 'unavailable');
});

test('provider settings need a base URL, model, and key', () => {
  assert.deepEqual(readProviderConfigs({}), []);
  assert.deepEqual(readProviderConfigs({ AI_BASE_URL: 'https://a/v1', AI_MODEL: 'm' }), []);
  assert.deepEqual(
    readProviderConfigs({
      AI_BASE_URL: 'https://a/v1/', AI_MODEL: 'm', AI_API_KEY: 'k',
      AI_FALLBACK_BASE_URL: 'https://b/v1', AI_FALLBACK_MODEL: 'n', AI_FALLBACK_API_KEY: ' j ',
    }),
    [{ baseUrl: 'https://a/v1', model: 'm', apiKey: 'k' }, { baseUrl: 'https://b/v1', model: 'n', apiKey: 'j' }]
  );
});

test('a provider with excluded countries is skipped there, and when the country is unknown', () => {
  const configs = readProviderConfigs({
    AI_BASE_URL: 'https://a/v1', AI_MODEL: 'm', AI_API_KEY: 'k',
    AI_FALLBACK_BASE_URL: 'https://b/v1', AI_FALLBACK_MODEL: 'n', AI_FALLBACK_API_KEY: 'j',
    AI_FALLBACK_EXCLUDED_COUNTRIES: ' de, gb ,CH,',
  });
  assert.deepEqual(configs[1].excludedCountries, ['DE', 'GB', 'CH']);
  const models = (country: string | null) => providersForCountry(configs, country).map((c) => c.model);
  assert.deepEqual(models('CA'), ['m', 'n']);
  assert.deepEqual(models('gb'), ['m']);
  assert.deepEqual(models(null), ['m']);
  assert.deepEqual(models(''), ['m']);
});

// HTTP handler.

function post(body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }): Request {
  return new Request('https://astromoon.ca/api/ask', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

const answering: ChatModel = async () => ({ content: 'I can only help with the Moon, the zodiac, and eclipses.', toolCalls: [], model: 'fake-model' });

test('the handler validates requests before calling the model', async () => {
  let modelCalls = 0;
  const handler = createAskHandler({ getModel: () => { modelCalls++; return answering; }, now: () => now });
  const cases: [Request, number, string][] = [
    [post('hello', { 'content-type': 'text/plain' }), 415, 'unsupported_media_type'],
    [post({ question: 'x'.repeat(5000) }), 413, 'too_large'],
    [post('{bad'), 400, 'invalid_request'],
    [post([1]), 400, 'invalid_request'],
    [post({ question: '   ' }), 400, 'invalid_request'],
    [post({ question: 'x'.repeat(401) }), 400, 'invalid_request'],
    [post({ question: 'hi', timezone: 'Mars/Base' }), 400, 'invalid_request'],
    [post({ question: 'hi', hemisphere: 'eastern' }), 400, 'invalid_request'],
  ];
  for (const [req, status, error] of cases) {
    const res = await handler(req);
    assert.equal(res.status, status);
    assert.equal((await res.json()).error, error);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
  assert.equal(modelCalls, 0);
});

test('the handler answers, or explains why it cannot', async () => {
  const ok = await createAskHandler({ getModel: () => answering, now: () => now })(post({ question: 'Will it rain?' }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal((await ok.json()).source, 'model');

  const countries: (string | null)[] = [];
  const located = createAskHandler({ getModel: (country) => { countries.push(country); return answering; }, now: () => now });
  await located(post({ question: 'hi' }, { 'content-type': 'application/json', 'x-vercel-ip-country': 'FR' }));
  await located(post({ question: 'hi' }));
  assert.deepEqual(countries, ['FR', null]);

  const unconfigured = await createAskHandler({ getModel: () => null })(post({ question: 'hi' }));
  assert.equal(unconfigured.status, 503);
  assert.equal((await unconfigured.json()).error, 'not_configured');

  const failing = (err: Error) => createAskHandler({ getModel: () => async () => { throw err; }, now: () => now });
  const resting = await failing(new ProviderError('quota', 'limit', 45))(post({ question: 'hi' }));
  assert.equal(resting.status, 503);
  assert.equal(resting.headers.get('retry-after'), '45');
  assert.deepEqual(await resting.json(), { error: 'resting', message: 'The almanac is resting: the free AI quota is used up for now.', retryAfter: 45 });

  const slow = await failing(new ProviderError('timeout', 'slow'))(post({ question: 'hi' }));
  assert.equal((await slow.json()).error, 'timeout');
  const broken = await failing(new Error('bug'))(post({ question: 'hi' }));
  assert.equal(broken.status, 500);
});

// The live eval's question set, checked without a model.

test('every eval question is well formed and its expected events resolve', () => {
  const evalSet = JSON.parse(readFileSync(new URL('../evals/ask-questions.json', import.meta.url), 'utf8'));
  const toolNames = ALMANAC_TOOL_SCHEMAS.map((s) => s.name as string);
  const ids = evalSet.questions.map((q: { id: string }) => q.id);
  assert.equal(new Set(ids).size, ids.length, 'question ids are unique');

  for (const q of evalSet.questions) {
    for (const tool of q.expectTools ?? []) assert.ok(toolNames.includes(tool), `${q.id}: unknown tool ${tool}`);
    if (!q.expectCites) continue;
    const result = runAlmanacTool(q.expectCites.tool, q.expectCites.args, {
      timezone: q.timezone ?? evalSet.timezone,
      hemisphere: q.hemisphere ?? evalSet.hemisphere,
      now: new Date(evalSet.now),
    });
    assert.ok('records' in result, `${q.id}: ${'error' in result ? result.error : 'no records'}`);
    const matching = q.expectCites.signs ? result.records.filter((r) => q.expectCites.signs.includes(r.sign.name)) : result.records;
    assert.ok(matching.length > 0, `${q.id}: expects at least one event`);
  }
});
