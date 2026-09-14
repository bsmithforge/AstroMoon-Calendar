import React from 'react';
import { DayLunarData, FilterSettings } from '../types';
import { MoonVisual } from './MoonVisual';

interface CalendarGridProps {
  days: DayLunarData[];
  filters: FilterSettings;
  onSelectDay: (day: DayLunarData) => void;
  forExport?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  days,
  filters,
  onSelectDay,
  forExport = false,
}) => {
  return (
    <div className="@container/calendar w-full min-w-0 space-y-1.5">
      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-[#D8D0BF] bg-[#EBE3D0] text-center text-[10px] @min-[36rem]/calendar:text-xs font-serif-almanac font-semibold uppercase tracking-wider @min-[36rem]/calendar:tracking-widest text-[#182421] py-1.5 @min-[36rem]/calendar:py-2 rounded-t-md">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`px-0.5 @min-[36rem]/calendar:px-1 ${idx >= 5 ? 'text-[#B44732]' : ''}`}
          >
            <span className="@min-[36rem]/calendar:hidden">{day.charAt(0)}</span>
            <span className="hidden @min-[36rem]/calendar:inline">{day}</span>
          </div>
        ))}
      </div>

      {/* 7-column Calendar Days Grid with Fine Paper-Edge Rules */}
      <div className="grid grid-cols-7 gap-[1px] bg-[#D8D0BF] border border-[#D8D0BF] rounded-b-md overflow-hidden shadow-xs">
        {days.map((day) => {
          const isDimmed = !day.isCurrentMonth;

          // Only render days that belong to the displayed month. Adjacent-month
          // days become blank slots so the weekday alignment stays intact.
          if (isDimmed) {
            return (
              <div
                key={day.dateString}
                aria-hidden="true"
                className="min-h-[80px] @min-[36rem]/calendar:min-h-[136px] bg-[#EDE6D5]/50"
              />
            );
          }
          const isFullMoon = day.quarterType === 'Full Moon';
          const isNewMoon = day.quarterType === 'New Moon';
          const quarterEmoji =
            day.quarterType === 'Full Moon'
              ? '🌕'
              : day.quarterType === 'New Moon'
              ? '🌑'
              : day.quarterType === 'First Quarter'
              ? '🌓'
              : '🌗';
          const showMajor = day.hasMajorQuarter && filters.showFullNewMoon;
          const showIngress = day.hasIngress && filters.showIngresses;
          const showDailySign = filters.showDailySigns;
          const showEclipse = day.hasEclipse && filters.showEclipses;
          const primaryIngress = day.ingressEvents[0];

          return (
            <div
              key={day.dateString}
              id={forExport ? undefined : `day-card-${day.dateString}`}
              onClick={() => onSelectDay(day)}
              role={forExport ? undefined : "button"}
              tabIndex={forExport ? -1 : 0}
              aria-label={`${day.dateString}: ${day.noonPhase.name}, ${Math.round(day.noonPhase.fraction * 100)}% illuminated, Moon in ${day.noonSign.name}${showMajor && day.quarterType ? `, ${day.quarterType}` : ''}${showEclipse && day.eclipseInfo ? `, Eclipse: ${day.eclipseInfo.name}` : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDay(day);
                }
              }}
              className={`min-h-[80px] @min-[36rem]/calendar:min-h-[136px] p-1 @min-[36rem]/calendar:p-2.5 flex flex-col justify-start gap-0.5 @min-[36rem]/calendar:gap-1 transition-all duration-150 cursor-pointer select-none group relative ${
                isDimmed
                  ? 'bg-[#EAE3D2]/70 text-[#5F6D61]/60 hover:bg-[#E3DCB8]'
                  : day.isToday
                  ? 'bg-[#FFFDF7] text-[#182421] ring-1 ring-inset ring-[#B44732]/50 hover:bg-white'
                  : 'bg-[#FAF7F0] text-[#182421] hover:bg-[#FFFDF9]'
              } ${
                isFullMoon && filters.showFullNewMoon && day.isCurrentMonth
                  ? 'shadow-[inset_0_0_16px_rgba(184,154,98,0.12)]'
                  : ''
              } ${
                isNewMoon && filters.showFullNewMoon && day.isCurrentMonth
                  ? 'shadow-[inset_0_0_16px_rgba(24,36,33,0.08)]'
                  : ''
              }`}
            >
              {/* Top Row: Date numeral, Today badge, Major phase indicator */}
              <div className="flex h-6 @min-[36rem]/calendar:h-7 shrink-0 items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-serif-almanac text-sm @min-[36rem]/calendar:text-lg font-semibold tracking-tight ${
                      day.isToday
                        ? 'w-6 h-6 rounded-full bg-[#B44732] text-white flex items-center justify-center font-bold text-xs shadow-xs font-sans-almanac'
                        : isDimmed
                        ? 'text-[#5F6D61]/60'
                        : 'text-[#182421] group-hover:text-[#B44732]'
                    }`}
                  >
                    {day.dayOfMonth}
                  </span>

                  {day.isToday && (
                    <span className="hidden @min-[72rem]/calendar:inline text-[9px] font-bold uppercase tracking-wider text-[#B44732] font-sans-almanac px-1 py-0.2 rounded bg-[#B44732]/10 border border-[#B44732]/20">
                      Today
                    </span>
                  )}
                </div>

                {/* Mobile-only compact event indicator (emoji marker) */}
                {(showEclipse || showMajor) && (
                  <span
                    aria-hidden="true"
                    className="@min-[36rem]/calendar:hidden text-[11px] leading-none shrink-0"
                  >
                    {showEclipse ? '☀️' : quarterEmoji}
                  </span>
                )}

                {/* Major Quarter badge or Eclipse pill (sm and up) */}
                <div className="hidden @min-[36rem]/calendar:flex items-center gap-1">
                  {showEclipse && (
                    <span
                      title={`${day.eclipseInfo?.name} (Global peak - check local visibility)`}
                      className={`whitespace-nowrap px-1 py-0.5 rounded text-[10px] font-bold font-sans-almanac bg-[#B44732]/15 text-[#B44732] border border-[#B44732]/35 ${forExport ? '' : 'animate-pulse'}`}
                    >
                      ☀️ Eclipse
                    </span>
                  )}

                  {showMajor && !showEclipse && (
                    <span
                      className={`whitespace-nowrap text-[10px] font-medium font-sans-almanac px-1 py-0.5 rounded tracking-tight ${
                        isFullMoon
                          ? 'bg-[#B89A62]/20 text-[#684F22] border border-[#B89A62]/40'
                          : isNewMoon
                          ? 'bg-[#182421]/10 text-[#182421] border border-[#182421]/20'
                          : 'bg-[#EAE2D0] text-[#182421] border border-[#D8D0BF]'
                      }`}
                      title={`${day.quarterType} exact peak`}
                    >
                      {quarterEmoji}{' '}
                      {day.quarterType === 'Full Moon'
                        ? 'Full'
                        : day.quarterType === 'New Moon'
                        ? 'New'
                        : day.quarterType === 'First Quarter'
                        ? '1st Q'
                        : '3rd Q'}
                    </span>
                  )}
                </div>
              </div>

              {/* Center: Calculated SVG Moon Phase Visual & Illumination */}
              <div className="my-1 @min-[36rem]/calendar:my-1.5 flex flex-col @min-[22rem]/calendar:flex-row items-start @min-[22rem]/calendar:items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex @min-[36rem]/calendar:hidden">
                    <MoonVisual
                      phaseAngle={day.noonPhase.phaseAngle}
                      fraction={day.noonPhase.fraction}
                      hemisphere={filters.hemisphere}
                      size={18}
                      className="transition-transform group-hover:scale-105"
                    />
                  </span>
                  <span className="hidden @min-[36rem]/calendar:inline-flex">
                    <MoonVisual
                      phaseAngle={day.noonPhase.phaseAngle}
                      fraction={day.noonPhase.fraction}
                      hemisphere={filters.hemisphere}
                      size={26}
                      className="transition-transform group-hover:scale-105"
                    />
                  </span>
                </div>

                <span
                  className="text-[9px] @min-[36rem]/calendar:text-sm font-sans-almanac font-semibold text-[#182421] tabular-nums shrink-0"
                  title={`${day.noonPhase.name} · ${Math.round(day.noonPhase.fraction * 100)}% illuminated`}
                >
                  {Math.round(day.noonPhase.fraction * 100)}%
                </span>
              </div>

              {/* Moon phase name on its own line (sm and up) so it never truncates */}
              <div
                className="hidden @min-[36rem]/calendar:block text-[10px] font-sans-almanac text-[#5F6D61] leading-tight truncate"
                title={day.noonPhase.name}
              >
                {day.noonPhase.name}
              </div>

              {/* Mobile-only sign marker: ingress (symbol + time) or noon sign (symbol + degree) */}
              {showIngress && primaryIngress ? (
                <div
                  className="@min-[36rem]/calendar:hidden mt-0.5 pt-0.5 border-t border-[#D8D0BF] flex flex-col @min-[22rem]/calendar:flex-row items-start @min-[22rem]/calendar:items-center justify-between gap-1"
                  title={`Moon enters ${primaryIngress.sign.name} at ${primaryIngress.formattedLocalTime}`}
                >
                  <span
                    role="img"
                    aria-label={`Moon enters ${primaryIngress.sign.name}`}
                    className="text-[11px] leading-none text-[#B89A62] font-bold"
                  >
                    {primaryIngress.sign.symbol}
                  </span>
                  <span className="text-[9px] font-mono leading-none text-[#5F6D61]">
                    {primaryIngress.formattedLocalTime}
                  </span>
                </div>
              ) : showDailySign ? (
                <div
                  className="@min-[36rem]/calendar:hidden mt-0.5 pt-0.5 border-t border-[#D8D0BF] flex flex-col @min-[22rem]/calendar:flex-row items-start @min-[22rem]/calendar:items-center justify-between gap-1"
                  title={`Moon in ${day.noonSign.name} (${day.noonSignDegrees}°${day.noonSignMinutes}') at noon`}
                >
                  <span
                    role="img"
                    aria-label={`Moon in ${day.noonSign.name}`}
                    className="text-[11px] leading-none text-[#B89A62] font-bold"
                  >
                    {day.noonSign.symbol}
                  </span>
                  <span className="text-[9px] font-mono leading-none text-[#5F6D61]">
                    {day.noonSignDegrees}°
                  </span>
                </div>
              ) : null}

              {/* Bottom: Ingress Transition or Daily Noon Sign (sm and up) */}
              {((showIngress && primaryIngress) || showDailySign) && (
                <div className="hidden @min-[36rem]/calendar:block pt-1 border-t border-[#D8D0BF] space-y-0.5">
                {showIngress && primaryIngress ? (
                  // Actual Sign Ingress Crossing
                  <div
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#DEE5DF] text-[#182421] border border-[#657367]/40 shadow-xs flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5"
                    title={`Moon enters ${primaryIngress.sign.name} at ${primaryIngress.formattedLocalTime} (${filters.timezone})`}
                  >
                    <div className="flex items-center gap-1 font-semibold">
                      <span role="img" aria-label={`Moon ingress into ${primaryIngress.sign.name}`}>
                        {primaryIngress.sign.symbol}
                      </span>
                      <span>{primaryIngress.sign.name}</span>
                    </div>
                    <span className="text-[9px] font-mono text-[#5F6D61] ml-1">
                      {primaryIngress.formattedLocalTime}
                    </span>
                  </div>
                ) : showDailySign ? (
                  // Standard Daily Noon Snapshot
                  <div
                    className="flex items-center justify-between text-[11px] text-[#182421] group-hover:text-[#B44732] transition-colors"
                    title={`Moon in ${day.noonSign.name} (${day.noonSignDegrees}°${day.noonSignMinutes}') at 12:00 noon`}
                  >
                    <span className="flex items-center gap-1 truncate font-medium">
                      <span role="img" aria-label={`Moon in ${day.noonSign.name}`} className="text-[#B89A62] text-xs font-bold">
                        {day.noonSign.symbol}
                      </span>
                      <span className="truncate font-serif-almanac">{day.noonSign.name}</span>
                    </span>
                    <span className="text-[10px] text-[#5F6D61] font-mono">
                      {day.noonSignDegrees}°
                    </span>
                  </div>
                ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
