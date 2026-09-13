/**
 * AstroMoon Cal - Astronomical Calculation Engine
 *
 * Underlying library: astronomy-engine (pinned v2.1.19)
 * Reference: https://github.com/cosinekitty/astronomy
 *
 * Coordinate Convention:
 * - System: Tropical Zodiac (12 equal 30-degree sectors, Aries beginning at 0°).
 * - Coordinates: Geocentric apparent ecliptic longitude of the Moon (λ ∈ [0°, 360°)),
 *   referenced to the true equinox of date (Astronomy.EclipticGeoMoon).
 * - Corrections: Light-travel time and stellar aberration are accounted for by
 *   the Astronomy Engine's apparent position algorithm (VSOP87 / ELP2000-82).
 * - Numerical Search: Boundary crossings (sign ingresses) are refined using
 *   bisection to a bracket of <= 1 second.
 *   (Note: Numerical convergence precision is not an independently verified real-world empirical observation accuracy).
 */

import * as Astronomy from 'astronomy-engine';
import {
  AstroRecord,
  DayLunarData,
  FilterSettings,
  Hemisphere,
  MoonPhaseInfo,
  ZodiacSignInfo,
} from '../types.js';
import { getZodiacSignFromLongitude, ZODIAC_SIGNS } from './zodiac.js';

/**
 * Normalizes an angle into [0, 360)
 */
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Calculates the exact UTC Date instant corresponding to a local date and time
 * in any specified IANA timezone (e.g., 'America/Edmonton', 'Asia/Kolkata', 'Pacific/Auckland').
 *
 * Correctly accounts for DST transitions (23-hour or 25-hour days),
 * fractional UTC offsets, and midnight boundaries.
 */
export function getUtcForLocalTime(
  year: number,
  month: number, // 1-indexed (1 = Jan, 12 = Dec)
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = 'UTC'
): Date {
  // Initial estimate: assume UTC
  let estimateMs = Date.UTC(year, month - 1, day, hour, minute, second);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  // Fixed-point convergence in 1-3 iterations
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(estimateMs));
    const p: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        p[part.type] = parseInt(part.value, 10);
      }
    }

    const localFormattedMs = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second
    );
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = targetMs - localFormattedMs;

    if (diff === 0) {
      break;
    }
    estimateMs += diff;
  }

  return new Date(estimateMs);
}

/**
 * Converts a UTC Date into local calendar date components for a specified IANA timezone.
 */
export function getLocalDateComponents(
  date: Date,
  timeZone: string
): {
  year: number;
  month: number; // 1-indexed
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:mm
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const p: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      p[part.type] = part.value;
    }
  }

  const year = parseInt(p.year, 10);
  const month = parseInt(p.month, 10);
  const day = parseInt(p.day, 10);
  const hour = parseInt(p.hour, 10);
  const minute = parseInt(p.minute, 10);
  const second = parseInt(p.second, 10);

  const dateString = `${p.year}-${p.month}-${p.day}`;
  const timeString = `${p.hour}:${p.minute}`;

  return { year, month, day, hour, minute, second, dateString, timeString };
}

/**
 * Get apparent geocentric ecliptic longitude of the Moon in tropical zodiac [0, 360)
 * referenced to the true equinox of date.
 */
export function getMoonEclipticLongitude(date: Date): number {
  const geo = Astronomy.EclipticGeoMoon(date);
  return normalizeDegrees(geo.lon);
}

/**
 * Get lunar phase information for any instant.
 * - phaseAngle in [0, 360)
 * - fraction: illuminated fraction in [0, 1]
 * - 8 distinct phase categories
 */
export function getMoonPhaseInfo(
  date: Date,
  hemisphere: Hemisphere = 'northern'
): MoonPhaseInfo {
  const phaseAngle = Astronomy.MoonPhase(date); // 0..360°
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const fraction = illum.phase_fraction;

  let name = '';
  let emoji = '🌑';
  let southernEmoji = '🌑';
  let isQuarter = false;
  let quarterName:
    | 'New Moon'
    | 'First Quarter'
    | 'Full Moon'
    | 'Third Quarter'
    | undefined = undefined;
  let meaning = '';

  // 8-phase categorization
  if (phaseAngle >= 354 || phaseAngle < 6) {
    name = 'New Moon';
    emoji = '🌑';
    southernEmoji = '🌑';
    isQuarter = true;
    quarterName = 'New Moon';
    meaning =
      'New beginnings, intention setting, quiet contemplation, seed planting.';
  } else if (phaseAngle >= 6 && phaseAngle < 84) {
    name = 'Waxing Crescent';
    emoji = '🌒';
    southernEmoji = '🌘';
    meaning =
      'Emergence, early momentum, nurturing commitments, fresh hope.';
  } else if (phaseAngle >= 84 && phaseAngle < 96) {
    name = 'First Quarter';
    emoji = '🌓';
    southernEmoji = '🌗';
    isQuarter = true;
    quarterName = 'First Quarter';
    meaning =
      'Decision-making, overcoming initial obstacles, commitment, action.';
  } else if (phaseAngle >= 96 && phaseAngle < 174) {
    name = 'Waxing Gibbous';
    emoji = '🌔';
    southernEmoji = '🌖';
    meaning =
      'Refinement, adjustment, anticipation, patience before culmination.';
  } else if (phaseAngle >= 174 && phaseAngle < 186) {
    name = 'Full Moon';
    emoji = '🌕';
    southernEmoji = '🌕';
    isQuarter = true;
    quarterName = 'Full Moon';
    meaning =
      'Culmination, illumination, emotional clarity, celebration, harvesting.';
  } else if (phaseAngle >= 186 && phaseAngle < 264) {
    name = 'Waning Gibbous';
    emoji = '🌖';
    southernEmoji = '🌔';
    meaning =
      'Gratitude, dissemination, sharing wisdom, emotional release.';
  } else if (phaseAngle >= 264 && phaseAngle < 276) {
    name = 'Third Quarter';
    emoji = '🌗';
    southernEmoji = '🌓';
    isQuarter = true;
    quarterName = 'Third Quarter';
    meaning =
      'Forgiveness, conscious clearing, closure, letting go of what no longer serves.';
  } else {
    name = 'Waning Crescent';
    emoji = '🌘';
    southernEmoji = '🌒';
    meaning =
      'Rest, surrender, restorative stillness, intuitive dreamwork, rejuvenation.';
  }

  return {
    name,
    emoji: hemisphere === 'southern' ? southernEmoji : emoji,
    southernEmoji,
    phaseAngle,
    fraction,
    isQuarter,
    quarterName,
    meaning,
  };
}

/**
 * Searches exact primary Moon Quarters (New Moon, First Quarter, Full Moon, Third Quarter)
 * in a UTC date window using Astronomy.SearchMoonQuarter.
 */
export function getQuartersInRange(
  startDateUtc: Date,
  endDateUtc: Date,
  timeZone: string
): AstroRecord[] {
  const records: AstroRecord[] = [];
  const quarterNames: (
    | 'New Moon'
    | 'First Quarter'
    | 'Full Moon'
    | 'Third Quarter'
  )[] = ['New Moon', 'First Quarter', 'Full Moon', 'Third Quarter'];

  try {
    // Search slightly before start to avoid missing boundary event
    let mq = Astronomy.SearchMoonQuarter(
      new Date(startDateUtc.getTime() - 24 * 3600 * 1000)
    );

    while (mq && mq.time.date <= endDateUtc) {
      const qDate = mq.time.date;
      if (qDate >= startDateUtc && qDate <= endDateUtc) {
        const qName = quarterNames[mq.quarter];
        const lon = getMoonEclipticLongitude(qDate);
        const zodiac = getZodiacSignFromLongitude(lon);
        const phase = getMoonPhaseInfo(qDate, 'northern');

        const local = getLocalDateComponents(qDate, timeZone);
        const id = `quarter-${qDate.toISOString().replace(/[:.]/g, '-')}-${mq.quarter}`;

        records.push({
          id,
          eventType: 'quarter',
          utcTime: qDate,
          localDateString: local.dateString,
          formattedLocalTime: local.timeString,
          title: `${phase.emoji} ${qName} in ${zodiac.sign.name}`,
          description: `Exact ${qName} peak at ${local.timeString} (${timeZone}). Astronomical coordinate: ${zodiac.formatted}. Traditional theme: ${phase.meaning}`,
          summary: `${phase.emoji} ${qName} · ${local.timeString}`,
          sign: zodiac.sign,
          phase,
          isAllDay: false,
          metadata: {
            phaseAngle: phase.phaseAngle,
            illuminationFraction: phase.fraction,
            eclipticLongitude: lon,
            quarterType: qName,
          },
        });
      }
      mq = Astronomy.NextMoonQuarter(mq);
    }
  } catch (err) {
    console.error('Error calculating Moon Quarters:', err);
  }

  return records;
}

/**
 * Searches exact solar and lunar eclipses in a UTC date window.
 * Eclipse maximum and exact New/Full Moon are separate instants and not conflated.
 */
export function getEclipsesInRange(
  startDateUtc: Date,
  endDateUtc: Date,
  timeZone: string
): AstroRecord[] {
  const records: AstroRecord[] = [];

  try {
    // 1. Lunar eclipses
    let lTime = new Date(startDateUtc.getTime() - 15 * 86400000);
    while (lTime <= endDateUtc) {
      const e = Astronomy.SearchLunarEclipse(lTime);
      if (!e || !e.peak) break;
      const peakDate = e.peak.date;
      if (peakDate >= startDateUtc && peakDate <= endDateUtc) {
        const kind = (e.kind as 'total' | 'partial' | 'penumbral') || 'partial';
        const lon = getMoonEclipticLongitude(peakDate);
        const zodiac = getZodiacSignFromLongitude(lon);
        const phase = getMoonPhaseInfo(peakDate, 'northern');
        const local = getLocalDateComponents(peakDate, timeZone);
        const name = `${kind.charAt(0).toUpperCase() + kind.slice(1)} Lunar Eclipse`;

        records.push({
          id: `eclipse-lunar-${peakDate.toISOString().replace(/[:.]/g, '-')}`,
          eventType: 'eclipse',
          utcTime: peakDate,
          localDateString: local.dateString,
          formattedLocalTime: local.timeString,
          title: `🌕 ${name} in ${zodiac.sign.name}`,
          description: `Global peak at ${local.timeString} (${timeZone}). Type: ${name}. Moon position: ${zodiac.formatted}. Notice: Global astronomical peak; local visibility requires regional horizon elevation tracking.`,
          summary: `🌕 ${name} Peak · ${local.timeString}`,
          sign: zodiac.sign,
          phase,
          isAllDay: false,
          metadata: {
            eclipseType: 'lunar',
            eclipseKind: kind,
            eclipticLongitude: lon,
          },
        });
      }
      lTime = new Date(e.peak.date.getTime() + 15 * 86400000);
    }

    // 2. Solar eclipses
    let sTime = new Date(startDateUtc.getTime() - 15 * 86400000);
    while (sTime <= endDateUtc) {
      const e = Astronomy.SearchGlobalSolarEclipse(sTime);
      if (!e || !e.peak) break;
      const peakDate = e.peak.date;
      if (peakDate >= startDateUtc && peakDate <= endDateUtc) {
        const kind = (e.kind as 'total' | 'partial' | 'annular') || 'partial';
        const lon = getMoonEclipticLongitude(peakDate);
        const zodiac = getZodiacSignFromLongitude(lon);
        const phase = getMoonPhaseInfo(peakDate, 'northern');
        const local = getLocalDateComponents(peakDate, timeZone);
        const name = `${kind.charAt(0).toUpperCase() + kind.slice(1)} Solar Eclipse`;

        records.push({
          id: `eclipse-solar-${peakDate.toISOString().replace(/[:.]/g, '-')}`,
          eventType: 'eclipse',
          utcTime: peakDate,
          localDateString: local.dateString,
          formattedLocalTime: local.timeString,
          title: `☀️ ${name} in ${zodiac.sign.name}`,
          description: `Global greatest eclipse at ${local.timeString} (${timeZone}). Type: ${name}. Astrological position: ${zodiac.formatted}. Notice: Global peak instant; local visibility path depends on geographic coordinates.`,
          summary: `☀️ ${name} Peak · ${local.timeString}`,
          sign: zodiac.sign,
          phase,
          isAllDay: false,
          metadata: {
            eclipseType: 'solar',
            eclipseKind: kind,
            eclipticLongitude: lon,
          },
        });
      }
      sTime = new Date(e.peak.date.getTime() + 15 * 86400000);
    }
  } catch (err) {
    console.error('Error calculating eclipses:', err);
  }

  return records.sort(
    (a, b) => (a.utcTime?.getTime() || 0) - (b.utcTime?.getTime() || 0)
  );
}

/**
 * Finds exact zodiac sign ingress events in a specified UTC time window.
 *
 * Mathematical Algorithm:
 * - Detects crossings of each 30° sector boundary (0°, 30°, 60°, ..., 330°).
 * - Correctly handles the 360°/0° Pisces (11) -> Aries (0) boundary wraparound.
 * - Refines crossing instant using bisection down to a bracket <= 1 second (<1000 ms).
 * - Returns structured AstroRecord objects.
 */
export function findIngressesInRange(
  startDateUtc: Date,
  endDateUtc: Date,
  timeZone: string
): AstroRecord[] {
  const records: AstroRecord[] = [];

  try {
    // Step forward in 2-hour increments to identify any bracket crossing
    const stepMs = 2 * 3600 * 1000;
    let tCur = startDateUtc.getTime();
    const endMs = endDateUtc.getTime();

    while (tCur < endMs) {
      const tNext = Math.min(tCur + stepMs, endMs);
      const dateCur = new Date(tCur);
      const dateNext = new Date(tNext);

      const lonCur = getMoonEclipticLongitude(dateCur);
      const lonNext = getMoonEclipticLongitude(dateNext);

      const signCur = Math.floor(lonCur / 30);
      const signNext = Math.floor(lonNext / 30);

      // Check if sign boundary was crossed
      if (signCur !== signNext) {
        // Bisection to refine crossing instant to <= 1000 ms bracket
        let left = tCur;
        let right = tNext;

        // Is this a Pisces (11) -> Aries (0) wraparound?
        const isPiscesToAries = signCur === 11 && signNext === 0;

        while (right - left > 1000) {
          const mid = (left + right) / 2;
          const midLon = getMoonEclipticLongitude(new Date(mid));
          const midSign = Math.floor(midLon / 30);

          if (isPiscesToAries) {
            // In Pisces -> Aries, lonCur is near 359° (Pisces, sign 11) and lonNext is near 0° (Aries, sign 0)
            if (midLon >= 330) {
              left = mid; // still in Pisces
            } else {
              right = mid; // crossed into Aries
            }
          } else {
            if (midSign === signCur) {
              left = mid;
            } else {
              right = mid;
            }
          }
        }

        const ingressTime = new Date(right);
        const finalLon = getMoonEclipticLongitude(ingressTime);
        const finalSignIndex = Math.floor(finalLon / 30);
        const toSign = ZODIAC_SIGNS[finalSignIndex] || ZODIAC_SIGNS[0];
        const fromSign = ZODIAC_SIGNS[signCur] || ZODIAC_SIGNS[11];
        const phase = getMoonPhaseInfo(ingressTime, 'northern');

        const local = getLocalDateComponents(ingressTime, timeZone);
        const id = `ingress-${ingressTime.toISOString().replace(/[:.]/g, '-')}-${toSign.index}`;

        records.push({
          id,
          eventType: 'ingress',
          utcTime: ingressTime,
          localDateString: local.dateString,
          formattedLocalTime: local.timeString,
          title: `${toSign.symbol} Moon enters ${toSign.name}`,
          description: `The Moon shifts from ${fromSign.name} into ${toSign.name} at ${local.timeString} (${timeZone}). Traditional energy focus: ${toSign.description}`,
          summary: `${fromSign.name} → ${toSign.symbol} ${toSign.name} · ${local.timeString}`,
          sign: toSign,
          phase,
          isAllDay: false,
          metadata: {
            eclipticLongitude: finalLon,
            fromSign,
            toSign,
            bisectionBracketSeconds: (right - left) / 1000,
          },
        });
      }

      tCur = tNext;
    }
  } catch (err) {
    console.error('Error finding ingresses:', err);
  }

  return records;
}

/**
 * Generates the unified structured astronomical dataset for a given inclusive
 * calendar date range (startDate to endDate, YYYY-MM-DD) in the specified timezone.
 *
 * This dataset is consumed identically by:
 * - Calendar Grid
 * - Timeline Feed
 * - Day Detail Modal
 * - ICS Export
 * - PDF Export
 */
export function generateRangeDataset(
  startDateStr: string, // YYYY-MM-DD
  endDateStr: string, // YYYY-MM-DD
  hemisphere: Hemisphere,
  timeZone: string
): {
  days: DayLunarData[];
  records: AstroRecord[];
  error?: string;
} {
  try {
    const [startYear, startMonth, startDay] = startDateStr
      .split('-')
      .map((n) => parseInt(n, 10));
    const [endYear, endMonth, endDay] = endDateStr
      .split('-')
      .map((n) => parseInt(n, 10));

    if (
      isNaN(startYear) ||
      isNaN(startMonth) ||
      isNaN(startDay) ||
      isNaN(endYear) ||
      isNaN(endMonth) ||
      isNaN(endDay)
    ) {
      return {
        days: [],
        records: [],
        error: 'Invalid start or end date format. Expected YYYY-MM-DD.',
      };
    }

    // Interval: start of first date (00:00:00 local) to start of day after last date (00:00:00 local)
    const rangeStartUtc = getUtcForLocalTime(
      startYear,
      startMonth,
      startDay,
      0,
      0,
      0,
      timeZone
    );

    // Day after last date:
    const tempEndUtc = getUtcForLocalTime(
      endYear,
      endMonth,
      endDay,
      12,
      0,
      0,
      timeZone
    );
    const nextDayUtc = new Date(tempEndUtc.getTime() + 24 * 3600 * 1000);
    const nextDayLocal = getLocalDateComponents(nextDayUtc, timeZone);
    const rangeEndUtc = getUtcForLocalTime(
      nextDayLocal.year,
      nextDayLocal.month,
      nextDayLocal.day,
      0,
      0,
      0,
      timeZone
    );

    // Calculate all timed events in this interval
    const quarterEvents = getQuartersInRange(rangeStartUtc, rangeEndUtc, timeZone);
    const eclipseEvents = getEclipsesInRange(rangeStartUtc, rangeEndUtc, timeZone);
    const ingressEvents = findIngressesInRange(rangeStartUtc, rangeEndUtc, timeZone);

    const timedRecords = [...quarterEvents, ...eclipseEvents, ...ingressEvents];

    // Build day-by-day structured records
    const days: DayLunarData[] = [];
    const allRecords: AstroRecord[] = [...timedRecords];

    const todayComponents = getLocalDateComponents(new Date(), timeZone);
    const todayStr = todayComponents.dateString;

    // Iterate through calendar days from startDateStr to endDateStr
    let curDateComponents = {
      year: startYear,
      month: startMonth,
      day: startDay,
    };

    while (true) {
      const dateString = `${curDateComponents.year}-${String(curDateComponents.month).padStart(2, '0')}-${String(curDateComponents.day).padStart(2, '0')}`;

      // Local noon instant in selected timezone
      const localNoonUtc = getUtcForLocalTime(
        curDateComponents.year,
        curDateComponents.month,
        curDateComponents.day,
        12,
        0,
        0,
        timeZone
      );

      // Daily noon phase & zodiac snapshot
      const noonPhase = getMoonPhaseInfo(localNoonUtc, hemisphere);
      const noonLon = getMoonEclipticLongitude(localNoonUtc);
      const noonZodiac = getZodiacSignFromLongitude(noonLon);

      // Daily summary record (All-day event, does NOT generate an ingress)
      const dailySummaryRecord: AstroRecord = {
        id: `daily-${dateString}-${timeZone.replace(/[\/_]/g, '-')}`,
        eventType: 'daily_summary',
        localDateString: dateString,
        title: `${noonZodiac.sign.symbol} Moon in ${noonZodiac.sign.name} (${noonZodiac.degrees}°${noonZodiac.minutes}')`,
        description: `Daily Moon sign at noon (${timeZone}): ${noonZodiac.formatted}. Phase: ${noonPhase.name} (${Math.round(noonPhase.fraction * 100)}% illuminated). Traditional archetype: ${noonZodiac.sign.theme}.`,
        summary: `${noonZodiac.sign.symbol} ${noonZodiac.sign.name} · ${noonZodiac.degrees}°`,
        sign: noonZodiac.sign,
        phase: noonPhase,
        isAllDay: true,
        metadata: {
          phaseAngle: noonPhase.phaseAngle,
          illuminationFraction: noonPhase.fraction,
          eclipticLongitude: noonLon,
        },
      };
      allRecords.push(dailySummaryRecord);

      // Find timed events falling on this local calendar date
      const dayIngresses = ingressEvents.filter(
        (e) => e.localDateString === dateString
      );
      const dayQuarters = quarterEvents.filter(
        (e) => e.localDateString === dateString
      );
      const dayEclipses = eclipseEvents.filter(
        (e) => e.localDateString === dateString
      );
      const dayAllEvents = [
        dailySummaryRecord,
        ...dayIngresses,
        ...dayQuarters,
        ...dayEclipses,
      ];

      const primaryQuarter = dayQuarters[0];
      const primaryEclipse = dayEclipses[0];

      days.push({
        date: localNoonUtc,
        dateString,
        dayOfMonth: curDateComponents.day,
        isToday: dateString === todayStr,
        isCurrentMonth: true,
        noonPhase,
        noonLongitude: noonLon,
        noonSign: noonZodiac.sign,
        noonSignDegrees: noonZodiac.degrees,
        noonSignMinutes: noonZodiac.minutes,
        events: dayAllEvents,
        ingressEvents: dayIngresses,
        quarterEvents: dayQuarters,
        eclipseEvents: dayEclipses,
        dailySummaryEvent: dailySummaryRecord,
        hasIngress: dayIngresses.length > 0,
        hasMajorQuarter: dayQuarters.length > 0,
        quarterType: primaryQuarter?.metadata?.quarterType,
        quarterExactTime: primaryQuarter?.utcTime,
        hasEclipse: dayEclipses.length > 0,
        eclipseInfo: primaryEclipse
          ? {
              type: primaryEclipse.metadata.eclipseType || 'lunar',
              kind: primaryEclipse.metadata.eclipseKind || 'total',
              peak: primaryEclipse.utcTime || localNoonUtc,
              name: primaryEclipse.title,
            }
          : undefined,
      });

      if (dateString === endDateStr) {
        break;
      }

      // Increment by 1 calendar day in local time
      const nextNoon = new Date(localNoonUtc.getTime() + 24 * 3600 * 1000);
      const nextComp = getLocalDateComponents(nextNoon, timeZone);
      curDateComponents = {
        year: nextComp.year,
        month: nextComp.month,
        day: nextComp.day,
      };
    }

    return { days, records: allRecords };
  } catch (err) {
    console.error('Dataset generation failed:', err);
    return {
      days: [],
      records: [],
      error: 'Failed to calculate astronomical data: ' + (err as Error).message,
    };
  }
}

/**
 * Filter unified astronomical records according to user toggle settings.
 * Single source of truth for Calendar, Timeline, ICS, and PDF.
 */
export function filterAstroRecords(
  records: AstroRecord[],
  filters: FilterSettings
): AstroRecord[] {
  return records.filter((rec) => {
    // 1. Quarters
    if (rec.eventType === 'quarter') {
      return filters.showFullNewMoon;
    }
    // 2. Ingresses
    if (rec.eventType === 'ingress') {
      return filters.showIngresses;
    }
    // 3. Eclipses
    if (rec.eventType === 'eclipse') {
      return filters.showEclipses;
    }
    // 4. Daily summaries
    if (rec.eventType === 'daily_summary') {
      return filters.showDailySigns;
    }
    return true;
  });
}

/**
 * Generate 7-column calendar month grid days (including boundary pad days).
 */
export function generateMonthData(
  year: number,
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  hemisphere: Hemisphere,
  timeZone: string
): DayLunarData[] {
  // First and last day of target month
  const firstDayStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayNum = new Date(year, month + 1, 0).getDate();
  const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

  // Find day of week for the first day in selected timezone
  const firstDayUtc = getUtcForLocalTime(year, month + 1, 1, 12, 0, 0, timeZone);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(firstDayUtc);

  // Map weekday to Monday = 0 .. Sunday = 6
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const shift = weekdayMap[weekday] ?? 0;
  // Calculate exact rectangular cell count needed (28, 35, or 42)
  const totalCells = Math.ceil((shift + lastDayNum) / 7) * 7;

  // Start date for the compact rectangular grid (Monday-aligned)
  const padStartUtc = new Date(firstDayUtc.getTime() - shift * 24 * 3600 * 1000);
  const padStartLocal = getLocalDateComponents(padStartUtc, timeZone);
  const gridStartStr = padStartLocal.dateString;

  const padEndUtc = new Date(padStartUtc.getTime() + (totalCells - 1) * 24 * 3600 * 1000);
  const padEndLocal = getLocalDateComponents(padEndUtc, timeZone);
  const gridEndStr = padEndLocal.dateString;

  const { days } = generateRangeDataset(
    gridStartStr,
    gridEndStr,
    hemisphere,
    timeZone
  );

  // Guarantee exact cell count (no overshoot) and mark isCurrentMonth
  return days.slice(0, totalCells).map((d) => {
    const [y, m] = d.dateString.split('-').map(Number);
    return {
      ...d,
      isCurrentMonth: y === year && m === month + 1,
    };
  });
}
