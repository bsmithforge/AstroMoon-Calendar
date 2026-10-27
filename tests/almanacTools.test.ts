import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toEventView, toModelResult } from '../src/utils/almanacResults';
import {
  ALMANAC_MAX_LIMIT,
  AlmanacContext,
  AlmanacToolResult,
  runAlmanacTool,
} from '../src/utils/almanacTools';
import { getLocalDateRangeUtc, getQuartersInRange } from '../src/utils/astronomy';
import { AstroRecord } from '../src/types';

// 2026-10-27 11:00 Edmonton; already 2026-10-28 in Auckland.
const now = new Date('2026-10-27T17:00:00Z');
const edmonton: AlmanacContext = { timezone: 'America/Edmonton', hemisphere: 'northern', now };
// Exact local times are asserted in zones whose rules are settled. Wall-clock
// times come from the runtime's tz database, which changes: tzdata 2026c keeps
// Alberta on UTC-6 from 2026-11-01, so Edmonton times after that date differ
// between Node releases. Edmonton is used here only for dates.
const utc: AlmanacContext = { ...edmonton, timezone: 'UTC' };

function records(result: AlmanacToolResult): AstroRecord[] {
  assert.ok('records' in result, `expected success, got: ${'error' in result ? result.error : ''}`);
  return result.records;
}

function error(result: AlmanacToolResult): string {
  assert.ok('error' in result, 'expected an error');
  return result.error;
}

// Exact Full Moon: 2026-11-24 14:54:04 UTC.
const NOV_2026_FULL_MOON = 'quarter-2026-11-24T14-54-04-191Z-2';

test('phase search matches the existing quarter helper for the same window', () => {
  const result = runAlmanacTool('find_moon_phases', { start_date: '2026-01-01', end_date: '2026-12-31', limit: ALMANAC_MAX_LIMIT }, utc);
  const { startUtc, endUtc } = getLocalDateRangeUtc('2026-01-01', '2026-12-31', 'UTC');
  const expected = getQuartersInRange(startUtc, endUtc, 'UTC').filter((rec) => rec.localDateString <= '2026-12-31');
  assert.deepEqual(records(result).map((rec) => rec.id), expected.slice(0, ALMANAC_MAX_LIMIT).map((rec) => rec.id));
  assert.ok('total' in result && result.total === expected.length && result.truncated);
});

test('phase and sign filters narrow the search', () => {
  const result = runAlmanacTool('find_moon_phases', { phases: ['full moon'], sign: 'gemini', limit: 1 }, utc);
  const [first] = records(result);
  assert.equal(first.id, NOV_2026_FULL_MOON);
  assert.equal(first.localDateString, '2026-11-24');
  assert.equal(first.formattedLocalTime, '14:54');
});

test('omitted dates default to one year from today in the selected timezone', () => {
  const inEdmonton = runAlmanacTool('find_eclipses', {}, edmonton);
  assert.ok('startDate' in inEdmonton);
  assert.equal(inEdmonton.startDate, '2026-10-27');
  assert.equal(inEdmonton.endDate, '2027-10-27');

  const inAuckland = runAlmanacTool('find_eclipses', { timezone: 'Pacific/Auckland' }, edmonton);
  assert.ok('startDate' in inAuckland);
  assert.equal(inAuckland.startDate, '2026-10-28');
});

test('results are limited to the requested local dates (Auckland rollover)', () => {
  // The 14:54 UTC Full Moon falls on Nov 25 at 03:54 in Auckland (UTC+13).
  const ctx = { ...edmonton, timezone: 'Pacific/Auckland' };
  const onUtcDate = runAlmanacTool('find_moon_phases', { start_date: '2026-11-24', end_date: '2026-11-24' }, ctx);
  assert.equal(records(onUtcDate).some((rec) => rec.id === NOV_2026_FULL_MOON), false);

  const onLocalDate = runAlmanacTool('find_moon_phases', { start_date: '2026-11-25', end_date: '2026-11-25' }, ctx);
  const [fullMoon] = records(onLocalDate);
  assert.equal(fullMoon.id, NOV_2026_FULL_MOON);
  assert.equal(fullMoon.formattedLocalTime, '03:54');
});

test('local times honor fractional offsets (Kolkata)', () => {
  const result = runAlmanacTool('find_moon_phases', { start_date: '2026-11-24', end_date: '2026-11-24', timezone: 'Asia/Kolkata' }, edmonton);
  const [fullMoon] = records(result);
  assert.equal(fullMoon.id, NOV_2026_FULL_MOON);
  assert.equal(fullMoon.formattedLocalTime, '20:24');
});

test('Aries ingresses cross the Pisces wraparound', () => {
  const result = runAlmanacTool('find_sign_ingresses', { sign: 'Aries', limit: 3 }, edmonton);
  const ingresses = records(result);
  assert.equal(ingresses.length, 3);
  for (const rec of ingresses) {
    assert.equal(rec.metadata.fromSign?.name, 'Pisces');
    assert.equal(rec.metadata.toSign?.name, 'Aries');
    const lon = rec.metadata.eclipticLongitude!;
    assert.ok(lon < 0.01 || lon > 359.99, `longitude ${lon} should be at the 0° boundary`);
  }
});

test('eclipse peaks stay separate from the nearby Full Moon', () => {
  const day = records(runAlmanacTool('get_moon_on_date', { date: '2027-02-20' }, edmonton));
  const eclipse = day.find((rec) => rec.eventType === 'eclipse');
  const fullMoon = day.find((rec) => rec.eventType === 'quarter');
  assert.ok(eclipse && fullMoon);
  assert.equal(eclipse.metadata.eclipseKind, 'penumbral');
  assert.notEqual(eclipse.id, fullMoon.id);
  assert.notEqual(eclipse.utcTime!.getTime(), fullMoon.utcTime!.getTime());

  const solar = records(runAlmanacTool('find_eclipses', { end_date: '2027-12-31', type: 'solar', kind: 'total' }, edmonton));
  assert.deepEqual(solar.map((rec) => rec.localDateString), ['2027-08-02']);
});

test('get_moon_on_date returns the noon snapshot first, then exact events in time order', () => {
  const day = records(runAlmanacTool('get_moon_on_date', { date: '2026-11-24' }, edmonton));
  assert.deepEqual(day.map((rec) => rec.eventType), ['daily_summary', 'ingress', 'quarter']);
  assert.equal(day[0].sign.name, 'Gemini');
});

test('limit, truncation, and latest-first order', () => {
  const capped = runAlmanacTool('find_moon_phases', {}, edmonton);
  assert.equal(records(capped).length, 10);
  assert.ok('truncated' in capped && capped.truncated);

  const latest = records(runAlmanacTool('find_moon_phases', { phases: ['New Moon'], end_date: '2026-12-31', order: 'latest', limit: 2 }, edmonton));
  assert.ok(latest[0].utcTime! > latest[1].utcTime!);
  assert.equal(latest[0].localDateString.slice(0, 7), '2026-12');
});

test('invalid arguments are rejected with actionable messages', () => {
  const cases: [string, unknown, RegExp][] = [
    ['find_eclipses', { start_date: '2026-02-30' }, /real date/],
    ['find_eclipses', { start_date: '2026-03-01', end_date: '2026-02-01' }, /on or after/],
    ['find_eclipses', { start_date: '2026-01-01', end_date: '2036-01-09' }, /3660 days/],
    ['find_eclipses', { start_date: '1899-12-31' }, /between 1900 and 2100/],
    ['find_eclipses', { timezone: 'Mars/Olympus_Mons' }, /Unknown IANA timezone/],
    ['find_eclipses', { kind: 'hybrid' }, /kind must be one of/],
    ['find_eclipses', { limit: ALMANAC_MAX_LIMIT + 1 }, /limit must be/],
    ['find_eclipses', { limit: '5' }, /limit must be/],
    ['find_moon_phases', { phases: [] }, /non-empty array/],
    ['find_moon_phases', { sign: 'Ophiuchus' }, /sign must be one of/],
    ['find_sign_ingresses', { year: 2027 }, /Unknown argument\(s\): year/],
    ['get_moon_on_date', { date: 20261124 }, /date must be a string/],
    ['get_moon_on_date', 'tomorrow', /JSON object/],
    ['find_planets', {}, /Unknown tool/],
  ];
  for (const [tool, args, pattern] of cases) {
    assert.match(error(runAlmanacTool(tool, args, edmonton)), pattern, `${tool} ${JSON.stringify(args)}`);
  }
});

test('model results are compact and omit emoji', () => {
  const result = toModelResult(runAlmanacTool('get_moon_on_date', { date: '2026-11-24' }, utc));
  assert.ok(result.ok);
  const [daily, ingress, fullMoon] = result.events;
  assert.deepEqual(daily, {
    id: 'daily-2026-11-24-UTC',
    type: 'daily_summary',
    date: '2026-11-24',
    title: "Moon in Gemini (0°31')",
    sign: 'Gemini',
    phase: 'Full Moon',
    illumination_pct: 100,
  });
  assert.equal(ingress.from_sign, 'Taurus');
  assert.deepEqual(fullMoon, {
    id: NOV_2026_FULL_MOON,
    type: 'quarter',
    date: '2026-11-24',
    title: 'Full Moon in Gemini',
    sign: 'Gemini',
    time: '14:54',
  });

  assert.deepEqual(toModelResult(runAlmanacTool('find_planets', {}, edmonton)), { ok: false, error: 'Unknown tool: find_planets.' });
});

test('event views carry ISO instants and hemisphere-aware quarter emoji', () => {
  const [firstQuarter] = records(runAlmanacTool('find_moon_phases', { phases: ['First Quarter'], limit: 1 }, edmonton));
  const southern = toEventView(firstQuarter, 'America/Edmonton', 'southern');
  const northern = toEventView(firstQuarter, 'America/Edmonton', 'northern');
  assert.equal(northern.title, '🌓 First Quarter in Aquarius');
  assert.equal(southern.title, '🌗 First Quarter in Aquarius');
  assert.equal(southern.utcTime, firstQuarter.utcTime!.toISOString());
  assert.equal(southern.timezone, 'America/Edmonton');
  assert.doesNotThrow(() => JSON.stringify(southern));

  const [daily] = records(runAlmanacTool('get_moon_on_date', { date: '2026-11-24' }, edmonton));
  const dailyView = toEventView(daily, 'America/Edmonton', 'northern');
  assert.equal(dailyView.utcTime, undefined);
  assert.equal(dailyView.formattedLocalTime, undefined);
  assert.equal(dailyView.isAllDay, true);
});
