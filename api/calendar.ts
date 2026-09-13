/**
 * Vercel serverless function: live iCalendar subscription feed.
 *
 *   GET /api/calendar?tz=America/Edmonton&hemi=northern&phases=1&ingresses=1&daily=0&eclipses=1
 *
 * Users subscribe via webcal://<host>/api/calendar?... and their calendar app
 * re-fetches this URL on its own schedule. Each response covers a rolling
 * window around today (see `getSubscriptionWindow`), so the feed never runs out.
 *
 * Uses the Web-standard Request/Response signature supported by Vercel's Node
 * runtime; the same export is mounted by the Vite dev server in vite.config.ts.
 */

import { buildSubscriptionIcs, parseSubscriptionQuery } from '../src/utils/subscription.js';

// Vercel's edge cache serves repeat fetches of the same URL for a day; the
// window is computed per UTC day so a longer cache would lag it anyway.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400';

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const parsed = parseSubscriptionQuery(url.searchParams);

  if ('error' in parsed) {
    return new Response(parsed.error, {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const { ics } = buildSubscriptionIcs(parsed.options);
  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="astromoon-calendar.ics"',
      'Cache-Control': CACHE_CONTROL,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Some calendar clients probe with HEAD before subscribing.
export function HEAD(request: Request): Response {
  const response = GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
