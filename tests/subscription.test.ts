import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET, HEAD } from '../server/calendar';
import {
  buildAddToCalendarLinks,
  buildSubscriptionIcs,
  buildSubscriptionQuery,
  buildSubscriptionUrl,
  getSubscriptionWindow,
  parseSubscriptionQuery,
  toWebcalUrl,
} from '../src/utils/subscription';

const options = {
  timezone: 'America/Edmonton',
  hemisphere: 'southern' as const,
  showFullNewMoon: true,
  showIngresses: false,
  showDailySigns: true,
  showEclipses: false,
};

test('query string round-trips every option', () => {
  const query = buildSubscriptionQuery(options);
  assert.equal(query, 'tz=America%2FEdmonton&hemi=southern&phases=1&ingresses=0&daily=1&eclipses=0');
  const parsed = parseSubscriptionQuery(new URLSearchParams(query));
  assert.deepEqual(parsed, { options });
});

test('parsing applies defaults and rejects bad input', () => {
  const bare = parseSubscriptionQuery(new URLSearchParams('tz=Asia/Kolkata'));
  assert.deepEqual(bare, {
    options: {
      timezone: 'Asia/Kolkata',
      hemisphere: 'northern',
      showFullNewMoon: true,
      showIngresses: true,
      showDailySigns: true,
      showEclipses: true,
    },
  });
  assert.match((parseSubscriptionQuery(new URLSearchParams('tz=Mars/Olympus')) as { error: string }).error, /time zone/);
  assert.match((parseSubscriptionQuery(new URLSearchParams('hemi=equator')) as { error: string }).error, /hemi/);
  assert.match(
    (parseSubscriptionQuery(new URLSearchParams('phases=0&ingresses=0&daily=0&eclipses=0')) as { error: string }).error,
    /At least one/
  );
});

test('window rolls with the current month and spans whole months', () => {
  assert.deepEqual(getSubscriptionWindow(new Date('2026-09-13T20:00:00Z')), {
    startDate: '2026-08-01',
    endDate: '2027-09-30',
  });
  // Year boundary
  assert.deepEqual(getSubscriptionWindow(new Date('2026-01-05T00:00:00Z')), {
    startDate: '2025-12-01',
    endDate: '2027-01-31',
  });
});

test('feed payload is stable within a day and carries refresh hints', () => {
  const morning = new Date('2026-03-10T03:00:00Z');
  const evening = new Date('2026-03-10T22:30:00Z');
  const first = buildSubscriptionIcs(options, morning);
  const second = buildSubscriptionIcs(options, evening);
  assert.equal(first.ics, second.ics);
  assert.ok(first.eventCount > 0);
  assert.match(first.ics, /\r\nREFRESH-INTERVAL;VALUE=DURATION:P1D\r\n/);
  assert.match(first.ics, /\r\nX-PUBLISHED-TTL:P1D\r\n/);
  assert.match(first.ics, /\r\nX-WR-CALNAME:AstroMoon Calendar\r\n/);
  assert.match(first.ics, /\r\nDTSTAMP:20260310T000000Z\r\n/);
  // Only the requested event types are present
  assert.doesNotMatch(first.ics, /Moon enters/);
  assert.match(first.ics, /Moon in /);
  assert.match(first.ics, /Full Moon in /);
  // Southern-hemisphere quarter emoji is used
  assert.match(first.ics, /🌗 First Quarter in /);
});

test('URL helpers produce webcal and add-to-calendar links', () => {
  const url = buildSubscriptionUrl('https://astromoon.example/', options);
  assert.equal(url, `https://astromoon.example/api/calendar?${buildSubscriptionQuery(options)}`);
  assert.equal(toWebcalUrl(url), url.replace('https:', 'webcal:'));
  const links = buildAddToCalendarLinks(url);
  assert.ok(links.google.startsWith('https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2F'));
  assert.ok(links.outlook.startsWith('https://outlook.live.com/calendar/0/addfromweb?url=https%3A%2F%2F'));
  assert.match(links.outlook, /&name=AstroMoon%20Calendar$/);
});

test('handler serves text/calendar with edge caching and rejects bad zones', async () => {
  const ok = GET(new Request('https://astromoon.example/api/calendar?tz=Europe/London&daily=0'));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'text/calendar; charset=utf-8');
  assert.match(ok.headers.get('cache-control') || '', /s-maxage=86400/);
  const body = await ok.text();
  assert.ok(body.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(body.endsWith('END:VCALENDAR\r\n'));
  assert.doesNotMatch(body, /Daily snapshot/);

  const head = HEAD(new Request('https://astromoon.example/api/calendar?tz=Europe/London'));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');

  const bad = GET(new Request('https://astromoon.example/api/calendar?tz=Nowhere/Here'));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('cache-control'), 'no-store');
});
