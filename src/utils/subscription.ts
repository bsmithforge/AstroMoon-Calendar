/**
 * Live calendar subscription feed (webcal).
 *
 * Shared by the Vercel function in `api/calendar.ts` (which serves the feed)
 * and `ExportModal` (which builds the URL users subscribe to). Everything here
 * is pure and runs in both Node and the browser.
 *
 * A subscription has no fixed date range: each fetch generates a rolling window
 * around "today", so calendar apps that poll the URL always see upcoming events.
 */

import { FilterSettings, Hemisphere } from '../types';
import { filterAstroRecords, generateRangeDataset } from './astronomy';
import { generateIcsPayload } from './icsExport';

export interface SubscriptionOptions {
  timezone: string;
  hemisphere: Hemisphere;
  showFullNewMoon: boolean;
  showIngresses: boolean;
  showDailySigns: boolean;
  showEclipses: boolean;
}

export const SUBSCRIPTION_PATH = '/api/calendar';
export const SUBSCRIPTION_CALENDAR_NAME = 'AstroMoon Calendar';
/** Whole months included before/after the current month on each fetch. */
export const SUBSCRIPTION_MONTHS_BACK = 1;
export const SUBSCRIPTION_MONTHS_AHEAD = 12;
/** Suggested client poll interval (RFC 7986 REFRESH-INTERVAL). */
export const SUBSCRIPTION_REFRESH_INTERVAL = 'P1D';

const TOGGLE_PARAMS: Record<
  Exclude<keyof SubscriptionOptions, 'timezone' | 'hemisphere'>,
  string
> = {
  showFullNewMoon: 'phases',
  showIngresses: 'ingresses',
  showDailySigns: 'daily',
  showEclipses: 'eclipses',
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Serializes options to the query string used by the feed URL. */
export function buildSubscriptionQuery(options: SubscriptionOptions): string {
  const params = new URLSearchParams();
  params.set('tz', options.timezone);
  params.set('hemi', options.hemisphere);
  for (const [key, name] of Object.entries(TOGGLE_PARAMS) as [keyof typeof TOGGLE_PARAMS, string][]) {
    params.set(name, options[key] ? '1' : '0');
  }
  return params.toString();
}

/**
 * Parses and validates feed query parameters. Missing toggles default to on so
 * a bare `/api/calendar?tz=...` still yields a useful feed.
 */
export function parseSubscriptionQuery(
  params: URLSearchParams
): { options: SubscriptionOptions } | { error: string } {
  const timezone = params.get('tz') || 'UTC';
  if (!isValidTimeZone(timezone)) {
    return { error: `Unknown IANA time zone: ${timezone}` };
  }

  const hemi = params.get('hemi') || 'northern';
  if (hemi !== 'northern' && hemi !== 'southern') {
    return { error: `hemi must be "northern" or "southern", got: ${hemi}` };
  }

  const flag = (name: string) => {
    const value = params.get(name);
    return value === null ? true : !/^(0|false|no|off)$/i.test(value);
  };

  const options: SubscriptionOptions = {
    timezone,
    hemisphere: hemi,
    showFullNewMoon: flag(TOGGLE_PARAMS.showFullNewMoon),
    showIngresses: flag(TOGGLE_PARAMS.showIngresses),
    showDailySigns: flag(TOGGLE_PARAMS.showDailySigns),
    showEclipses: flag(TOGGLE_PARAMS.showEclipses),
  };

  if (!options.showFullNewMoon && !options.showIngresses && !options.showDailySigns && !options.showEclipses) {
    return { error: 'At least one event type must be enabled.' };
  }

  return { options };
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Rolling window: first day of (month - back) through last day of (month + ahead), in UTC. */
export function getSubscriptionWindow(now: Date = new Date()): { startDate: string; endDate: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    startDate: toIsoDate(new Date(Date.UTC(year, month - SUBSCRIPTION_MONTHS_BACK, 1))),
    // Day 0 of the following month is the last day of the target month.
    endDate: toIsoDate(new Date(Date.UTC(year, month + SUBSCRIPTION_MONTHS_AHEAD + 1, 0))),
  };
}

/**
 * Builds the full feed payload for one fetch. DTSTAMP is pinned to the start of
 * the current UTC day so repeated polls within a day produce byte-identical
 * output and clients do not treat every event as modified.
 */
export function buildSubscriptionIcs(
  options: SubscriptionOptions,
  now: Date = new Date()
): { ics: string; eventCount: number; startDate: string; endDate: string } {
  const { startDate, endDate } = getSubscriptionWindow(now);
  const { records } = generateRangeDataset(startDate, endDate, options.hemisphere, options.timezone);

  const filters: FilterSettings = { ...options, startDate, endDate };
  const events = filterAstroRecords(records, filters);

  const dtstamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ics = generateIcsPayload(events, SUBSCRIPTION_CALENDAR_NAME, options.timezone, options.hemisphere, {
    dtstamp,
    refreshInterval: SUBSCRIPTION_REFRESH_INTERVAL,
  });

  return { ics, eventCount: events.length, startDate, endDate };
}

/** Absolute https URL of the feed for a given site origin. */
export function buildSubscriptionUrl(origin: string, options: SubscriptionOptions): string {
  return `${origin.replace(/\/$/, '')}${SUBSCRIPTION_PATH}?${buildSubscriptionQuery(options)}`;
}

/** webcal:// variant that opens the native "Subscribe" dialog in Apple Calendar / Outlook. */
export function toWebcalUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https?:/, 'webcal:');
}

/** Deep links that pre-fill "Add calendar from URL" in web calendar products. */
export function buildAddToCalendarLinks(httpsUrl: string): { google: string; outlook: string } {
  const webcal = toWebcalUrl(httpsUrl);
  return {
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(SUBSCRIPTION_CALENDAR_NAME)}`,
  };
}
