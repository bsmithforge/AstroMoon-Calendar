/**
 * AstroMoon Cal Types
 * Clean, structured types for astronomical lunar ephemeris and astrological calendar.
 */

export type Hemisphere = 'northern' | 'southern';
export type ViewMode = 'calendar' | 'timeline' | 'year';

export type AstroEventType = 'quarter' | 'ingress' | 'eclipse' | 'daily_summary';

export interface ZodiacSignInfo {
  index: number; // 0 to 11 (0 = Aries, 11 = Pisces)
  name: string;
  symbol: string;
  glyph: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  ruler: string;
  startDeg: number;
  endDeg: number;
  colorClass: string;
  theme: string;
  description: string;
  activities: string[];
}

export interface MoonPhaseInfo {
  name: string;
  emoji: string;
  southernEmoji: string;
  phaseAngle: number; // 0..360°
  fraction: number; // 0..1 illumination
  isQuarter: boolean;
  quarterName?: 'New Moon' | 'First Quarter' | 'Full Moon' | 'Third Quarter';
  meaning: string;
}

export interface AstroRecord {
  id: string; // Stable unique ID
  eventType: AstroEventType;
  utcTime?: Date; // Exact UTC instant for timed events (quarters, ingresses, eclipses)
  localDateString: string; // YYYY-MM-DD in the selected timezone
  formattedLocalTime?: string; // HH:mm in the selected timezone
  title: string;
  description: string;
  summary: string;
  sign: ZodiacSignInfo;
  phase: MoonPhaseInfo;
  isAllDay: boolean;
  metadata: {
    phaseAngle?: number;
    illuminationFraction?: number;
    eclipticLongitude?: number;
    quarterType?: 'New Moon' | 'First Quarter' | 'Full Moon' | 'Third Quarter';
    eclipseKind?: 'total' | 'partial' | 'annular' | 'penumbral';
    eclipseType?: 'solar' | 'lunar';
    fromSign?: ZodiacSignInfo;
    toSign?: ZodiacSignInfo;
    bisectionBracketSeconds?: number;
  };
}

export interface DayLunarData {
  date: Date; // Reference instant: local noon (12:00:00) in selected timezone
  dateString: string; // YYYY-MM-DD
  dayOfMonth: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  
  // Noon snapshot in selected timezone
  noonPhase: MoonPhaseInfo;
  noonLongitude: number; // 0..360°
  noonSign: ZodiacSignInfo;
  noonSignDegrees: number; // 0..30°
  noonSignMinutes: number; // 0..60'
  
  // Events falling on this calendar date in the selected timezone
  events: AstroRecord[];
  ingressEvents: AstroRecord[];
  quarterEvents: AstroRecord[];
  eclipseEvents: AstroRecord[];
  dailySummaryEvent?: AstroRecord;

  // Convenience flags
  hasIngress: boolean;
  hasMajorQuarter: boolean;
  quarterType?: 'New Moon' | 'First Quarter' | 'Full Moon' | 'Third Quarter';
  quarterExactTime?: Date;
  hasEclipse: boolean;
  eclipseInfo?: {
    type: 'solar' | 'lunar';
    kind: 'total' | 'partial' | 'annular' | 'penumbral';
    peak: Date;
    name: string;
  };
}

export type CalendarViewMode = 'month' | 'threeMonths' | 'year';

export interface FilterSettings {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  rangePreset?: CalendarViewMode;
  hemisphere: Hemisphere;
  showFullNewMoon: boolean; // Exact primary phases
  showIngresses: boolean; // Exact zodiac sign transitions
  showDailySigns: boolean; // Noon daily sign snapshot
  showEclipses: boolean; // Solar & Lunar eclipses
  timezone: string; // IANA timezone (e.g. 'America/New_York')
}

export interface VerificationBenchmark {
  id: string;
  name: string;
  category: 'phase' | 'eclipse' | 'ingress';
  source: string;
  sourceUrl: string;
  timeScale: 'UTC' | 'UT' | 'TD / TT';
  referenceTimeStr: string;
  referenceUtc: string;
  computedUtc: string;
  differenceSeconds: number;
  differenceMinutes: number;
  withinTolerance: boolean;
  notes?: string;
}
