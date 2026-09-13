import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateRangeDataset, filterAstroRecords } from '../src/utils/astronomy';
import { escapeIcsText, generateIcsPayload } from '../src/utils/icsExport';

function readEvents(payload: string) {
  const unfolded = payload.replace(/\r\n[ \t]/g, '');
  return [...unfolded.matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/g)].map((match) =>
    Object.fromEntries(match[1].trimEnd().split('\r\n').map((line) => {
      const colon = line.indexOf(':');
      const value = line.slice(colon + 1).replace(/\\([nN,;\\])/g, (_, escaped) =>
        escaped === 'n' || escaped === 'N' ? '\n' : escaped
      );
      return [line.slice(0, colon), value];
    }))
  );
}

const zone = 'America/Edmonton';
const march = generateRangeDataset('2026-03-01', '2026-03-31', 'northern', zone);

test('daily and ingress notes are readable without changing shared records', () => {
  const original = JSON.stringify(march.records);
  const events = readEvents(generateIcsPayload(march.records, 'March', zone));
  const daily = events.find((event) => event['DTSTART;VALUE=DATE'] === '20260301')!;
  assert.equal(daily.SUMMARY, '♌ Moon in Leo');
  assert.equal(daily.DESCRIPTION, [
    'Daily snapshot: March 1, 2026 at 12:00 noon',
    'Time zone: America/Edmonton',
    '',
    'Moon position: 20°01′ Leo · Tropical zodiac',
    'Phase: Waxing Gibbous',
    'Illumination: 97%',
    '',
    'Traditional interpretation',
    'Radiance, Creativity & Expression',
  ].join('\n'));
  const ingress = events.find((event) => event.SUMMARY === '♍ Moon enters Virgo')!;
  assert.match(ingress.DESCRIPTION, /Sign change: Leo → Virgo/);
  assert.match(ingress.DESCRIPTION, /Traditional interpretation\nPrecision/);
  assert.doesNotMatch(ingress.DESCRIPTION, /The Moon shifts|Energy focus:/);
  assert.equal(JSON.stringify(march.records), original);
});

test('hemisphere changes quarter glyphs but preserves identities and event instants', () => {
  const north = readEvents(generateIcsPayload(march.records, 'March', zone, 'northern'));
  const south = readEvents(generateIcsPayload(march.records, 'March', zone, 'southern'));
  assert.match(south.find((event) => event.SUMMARY.includes('First Quarter'))!.SUMMARY, /^🌗 /);
  assert.match(south.find((event) => event.SUMMARY.includes('Third Quarter'))!.SUMMARY, /^🌓 /);
  assert.match(north.find((event) => event.SUMMARY.includes('First Quarter'))!.SUMMARY, /^🌓 /);
  for (let i = 0; i < north.length; i++) {
    assert.equal(north[i].UID, `${march.records[i].id}@astromooncal.app`);
    assert.deepEqual({ ...south[i], SUMMARY: north[i].SUMMARY, DTSTAMP: north[i].DTSTAMP }, north[i]);
  }
});

test('single-day export retains daily, quarter, and distinct eclipse peak records', () => {
  const day = march.days.find((entry) => entry.dateString === '2026-03-03')!;
  const events = readEvents(generateIcsPayload(day.events, 'March 3', zone, 'southern'));
  assert.equal(events.length, 3);
  assert.equal(events.filter((event) => event['DTSTART;VALUE=DATE']).length, 1);
  const eclipse = events.find((event) => event.SUMMARY.includes('Eclipse'))!;
  const quarter = events.find((event) => event.SUMMARY.includes('Full Moon'))!;
  assert.notEqual(eclipse.DTSTART, quarter.DTSTART);
  assert.match(eclipse.DESCRIPTION, /^Global peak:/);
  assert.match(eclipse.DESCRIPTION, /Local visibility varies by location\./);
  assert.doesNotMatch(eclipse.DESCRIPTION, /Traditional interpretation/);
});

test('selected event types are preserved, including all-off and solar eclipses', () => {
  const { records } = generateRangeDataset('2026-08-01', '2026-08-31', 'northern', 'UTC');
  const filters = {
    hemisphere: 'northern' as const, timezone: 'UTC',
    showFullNewMoon: false, showIngresses: false, showDailySigns: false, showEclipses: true,
  };
  const selected = filterAstroRecords(records, filters);
  const events = readEvents(generateIcsPayload(selected));
  assert.equal(events.length, selected.length);
  assert(events.some((event) => event.SUMMARY.includes('Solar Eclipse')));
  assert(events.every((event) => event.SUMMARY.includes('Eclipse')));
  assert.equal(readEvents(generateIcsPayload(filterAstroRecords(records, { ...filters, showEclipses: false }))).length, 0);
});

test('descriptions use the export timezone across DST, fractional offsets, and date rollover', () => {
  const record = march.records.find((entry) => entry.eventType === 'quarter')!;
  for (const instant of ['2026-03-08T08:59:00Z', '2026-03-08T09:01:00Z', '2026-11-01T07:59:00Z', '2026-11-01T08:01:00Z']) {
    for (const timezone of ['UTC', zone, 'Asia/Kolkata', 'Pacific/Auckland']) {
      const utcTime = new Date(instant);
      const [event] = readEvents(generateIcsPayload([{ ...record, utcTime }], 'Time zones', timezone));
      const date = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'long', day: 'numeric', year: 'numeric' }).format(utcTime);
      const time = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(utcTime);
      assert(event.DESCRIPTION.startsWith(`Exact phase: ${date} at ${time}\nTime zone: ${timezone}`));
      assert.equal(event.DTSTART, instant.replace(/[-:]/g, ''));
      assert.equal(event.DTEND, new Date(utcTime.getTime() + 3600000).toISOString().replace(/[-:]/g, '').replace('.000', ''));
    }
  }
});

test('all-day end dates remain exclusive at leap-day and year boundaries', () => {
  for (const [date, nextDay] of [['2024-02-29', '20240301'], ['2026-12-31', '20270101']]) {
    for (const timezone of ['UTC', zone, 'Asia/Kolkata', 'Pacific/Auckland']) {
      const { records } = generateRangeDataset(date, date, 'southern', timezone);
      const event = readEvents(generateIcsPayload(records, 'One day', timezone, 'southern')).find((entry) => entry['DTSTART;VALUE=DATE'])!;
      assert.equal(event['DTSTART;VALUE=DATE'], date.replaceAll('-', ''));
      assert.equal(event['DTEND;VALUE=DATE'], nextDay);
      assert(event.DESCRIPTION.includes(`at 12:00 noon\nTime zone: ${timezone}`));
    }
  }
});

test('multiline Unicode notes round-trip through escaping and 75-byte folding', () => {
  const record = march.records.find((entry) => entry.eventType === 'quarter')!;
  const meaning = '🌕 ♈ é \\ commas, semicolons;\n'.repeat(20) + 'CR\ronly\r\nend';
  const payload = generateIcsPayload([{ ...record, phase: { ...record.phase, meaning } }], 'Moon, phases; 🌕');
  assert(payload.endsWith('END:VCALENDAR\r\n'));
  assert.doesNotMatch(payload.replaceAll('\r\n', ''), /[\r\n]/);
  assert(payload.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75));
  const [event] = readEvents(payload);
  assert(event.DESCRIPTION.endsWith(meaning.replace(/\r\n|\r/g, '\n')));
  assert.equal(escapeIcsText('a\rb\r\nc\nd'), 'a\\nb\\nc\\nd');
});
