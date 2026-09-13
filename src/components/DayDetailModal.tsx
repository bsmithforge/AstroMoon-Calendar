import React from 'react';
import {
  Calendar as CalendarIcon,
  Compass,
  Download,
  Flame,
  Globe,
  Sun,
  X,
  Clock,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { DayLunarData, Hemisphere } from '../types';
import { MoonVisual } from './MoonVisual';
import { downloadIcsFile, generateIcsPayload } from '../utils/icsExport';

interface DayDetailModalProps {
  day: DayLunarData | null;
  hemisphere: Hemisphere;
  timezone: string;
  onClose: () => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  day,
  hemisphere,
  timezone,
  onClose,
}) => {
  if (!day) return null;

  // Single day ICS export
  const handleExportSingleDay = () => {
    // Collect all events belonging to this calendar date
    const eventsToExport =
      day.events && day.events.length > 0
        ? day.events
        : day.dailySummaryEvent
        ? [day.dailySummaryEvent]
        : [];
    const singlePayload = generateIcsPayload(
      eventsToExport,
      `AstroMoon - ${day.dateString}`,
      timezone,
      hemisphere
    );
    downloadIcsFile(`astromoon-${day.dateString}`, singlePayload);
  };

  const primaryIngress =
    day.ingressEvents && day.ingressEvents.length > 0
      ? day.ingressEvents[0]
      : undefined;
  const primarySign = primaryIngress ? primaryIngress.sign : day.noonSign;

  let dateFormatted = day.dateString;
  try {
    if (day.date) {
      dateFormatted = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone,
      }).format(day.date);
    }
  } catch {
    dateFormatted = day.dateString;
  }

  const fractionPct = Math.round((day.noonPhase?.fraction ?? 0) * 100);
  const phaseAngleVal = (day.noonPhase?.phaseAngle ?? 0).toFixed(1);
  const longitudeVal = (day.noonLongitude ?? 0).toFixed(2);
  const degreesVal = day.noonSignDegrees ?? 0;
  const minutesVal = day.noonSignMinutes ?? 0;

  return (
    <div
      id="day-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#182421]/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="day-detail-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF7F0] border border-[#D8D0BF] rounded-lg w-full max-w-lg overflow-hidden shadow-2xl text-[#182421] max-h-[90vh] flex flex-col animate-fade-in"
      >
        {/* Modal Header Masthead in Observatory Ink */}
        <div className="relative p-5 sm:p-6 bg-[#182421] text-[#F3EDDF] border-b border-[#B89A62]/40 flex items-start justify-between overflow-hidden">
          {/* Subtle lunar engraving background watermark */}
          <div className="absolute right-0 top-0 bottom-0 w-36 pointer-events-none opacity-20 overflow-hidden mix-blend-screen hidden sm:block">
            <img
              src="/moon_engraving.jpg"
              alt="Lunar watermark"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 flex items-center gap-3.5">
            <MoonVisual
              phaseAngle={day.noonPhase?.phaseAngle ?? 0}
              fraction={day.noonPhase?.fraction ?? 0}
              hemisphere={hemisphere}
              size={48}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-[#F3EDDF] tracking-tight font-serif-almanac">
                  {primarySign ? `${primarySign.symbol} ${primarySign.name}` : 'Moon'} Moon
                </h3>
                {day.hasMajorQuarter && day.quarterType && (
                  <span className="text-[10px] font-sans-almanac font-medium px-2 py-0.5 rounded-full bg-[#B89A62]/25 text-[#E6D4B2] border border-[#B89A62]/40">
                    {day.quarterType}
                  </span>
                )}
                {day.hasEclipse && day.eclipseInfo && (
                  <span className="text-[10px] font-sans-almanac font-bold px-2 py-0.5 rounded-full bg-[#B44732]/30 text-[#F5B2A6] border border-[#B44732]/50">
                    ☀️ {day.eclipseInfo.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#D8D0BF] font-sans-almanac mt-0.5">
                {dateFormatted} • <span className="font-mono text-[#D8D0BF]">{timezone}</span>
              </p>
            </div>
          </div>

          <button
            id="close-modal-btn"
            onClick={onClose}
            className="relative z-10 p-1.5 rounded-md text-[#D8D0BF] hover:text-[#F3EDDF] hover:bg-[#253631] transition shrink-0"
          >
            <X size={20} strokeWidth={2} className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Modal Scrollable Content in Warm Parchment */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto font-sans-almanac bg-[#FAF7F0]">
          {/* Ingress Notification if today */}
          {day.hasIngress && primaryIngress && (
            <div className="bg-[#E4ECE5] border border-[#657367]/40 rounded-md p-3 text-xs flex items-center gap-3">
              <Clock size={16} strokeWidth={2} className="w-4 h-4 text-[#182421] shrink-0" />
              <div>
                <span className="font-serif-almanac font-semibold text-[#182421]">
                  Exact Zodiac Sign Ingress Today
                </span>
                <p className="text-[#182421] mt-0.5">
                  The Moon crosses the 30° sector boundary
                  {primaryIngress.metadata?.fromSign ? (
                    <>
                      {' '}from <strong className="text-[#182421]">{primaryIngress.metadata.fromSign.name}</strong>
                    </>
                  ) : null}
                  {' '}into <strong className="text-[#182421]">{primaryIngress.sign?.name}</strong>
                  {primaryIngress.formattedLocalTime ? (
                    <>
                      {' '}at <strong className="text-[#B44732] font-mono">{primaryIngress.formattedLocalTime}</strong> ({timezone})
                    </>
                  ) : null}
                  . Refined via bisection search to &le; 1 second.
                </p>
              </div>
            </div>
          )}

          {/* Eclipse Global Notice if today */}
          {day.hasEclipse && day.eclipseInfo && (
            <div className="bg-[#FBEFEF] border border-[#B44732]/35 rounded-md p-3 text-xs flex items-start gap-3">
              <Info size={16} strokeWidth={2} className="w-4 h-4 text-[#B44732] shrink-0 mt-0.5" />
              <div>
                <span className="font-serif-almanac font-semibold text-[#B44732]">
                  Global Eclipse Peak: {day.eclipseInfo.name}
                </span>
                <p className="text-[#182421] mt-0.5">
                  Global maximum occurs on this date
                  {day.eclipseEvents?.[0]?.formattedLocalTime ? (
                    <>
                      {' '}at <strong className="font-mono text-[#B44732]">{day.eclipseEvents[0].formattedLocalTime}</strong> ({timezone})
                    </>
                  ) : null}
                  . Note that actual visual observability depends on geographical location, local night-sky altitude, and weather conditions.
                </p>
              </div>
            </div>
          )}

          {/* Astronomical Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-[#F0E9DA] border border-[#D8D0BF] rounded-md p-2.5 text-center">
              <span className="text-[10px] uppercase font-sans-almanac tracking-wider text-[#657367] block">
                Illumination
              </span>
              <span className="text-sm font-semibold font-serif-almanac text-[#182421]">
                {fractionPct}%
              </span>
            </div>

            <div className="bg-[#F0E9DA] border border-[#D8D0BF] rounded-md p-2.5 text-center">
              <span className="text-[10px] uppercase font-sans-almanac tracking-wider text-[#657367] block">
                Phase Angle
              </span>
              <span className="text-sm font-semibold font-serif-almanac text-[#182421]">
                {phaseAngleVal}°
              </span>
            </div>

            <div className="bg-[#F0E9DA] border border-[#D8D0BF] rounded-md p-2.5 text-center">
              <span className="text-[10px] uppercase font-sans-almanac tracking-wider text-[#657367] block">
                Ecliptic Longitude
              </span>
              <span className="text-sm font-semibold font-serif-almanac text-[#182421]">
                {longitudeVal}°
              </span>
            </div>

            <div className="bg-[#F0E9DA] border border-[#D8D0BF] rounded-md p-2.5 text-center">
              <span className="text-[10px] uppercase font-sans-almanac tracking-wider text-[#657367] block">
                Zodiac Position
              </span>
              <span className="text-sm font-semibold font-serif-almanac text-[#182421]">
                {degreesVal}°{minutesVal}' {primarySign?.symbol || day.noonSign?.symbol}
              </span>
            </div>
          </div>

          {/* Sign Attributes & Elemental Alignment */}
          {primarySign && (
            <div className="bg-[#F0E9DA] border border-[#D8D0BF] rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#D8D0BF] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none">{primarySign.symbol}</span>
                  <div>
                    <span className="text-sm font-serif-almanac font-semibold text-[#182421] block">
                      Moon in {primarySign.name}
                    </span>
                    <span className="text-[11px] text-[#657367]">
                      Traditional Sign Attributes
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#E4ECE5] text-[#182421] border border-[#657367]/40">
                    {primarySign.element}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#EAE2D0] text-[#182421] border border-[#D8D0BF]">
                    {primarySign.modality}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#182421] leading-relaxed">
                {primarySign.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-[#657367]">
                <div>
                  <span className="block font-medium text-[#182421]">Ruling Planet:</span>
                  <span>{primarySign.ruler}</span>
                </div>
                <div>
                  <span className="block font-medium text-[#182421]">Degree Span:</span>
                  <span>{primarySign.startDeg}° – {primarySign.endDeg}°</span>
                </div>
                <div>
                  <span className="block font-medium text-[#182421]">Theme:</span>
                  <span>{primarySign.theme || '—'}</span>
                </div>
                <div>
                  <span className="block font-medium text-[#182421]">Nature:</span>
                  <span>{primarySign.element} / {primarySign.modality}</span>
                </div>
              </div>
            </div>
          )}

          {/* Phase Guidance Theme */}
          {day.noonPhase && (
            <div className="bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-3.5 text-xs">
              <span className="text-[#657367] font-medium font-serif-almanac block mb-1">
                Phase Meaning ({day.noonPhase.emoji} {day.noonPhase.name})
              </span>
              <p className="text-[#182421] italic font-serif-almanac">
                "{day.noonPhase.meaning}"
              </p>
            </div>
          )}

          {/* Recommended Focus Areas */}
          {primarySign?.activities && primarySign.activities.length > 0 && (
            <div>
              <span className="text-xs font-serif-almanac font-semibold text-[#182421] uppercase tracking-wider block mb-2">
                Traditional Recommended Focus
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {primarySign.activities.map((act, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md px-3 py-2 text-xs text-[#182421]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#657367] shrink-0" />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-[#EBE3D0] border-t border-[#D8D0BF] flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#657367]">
            Sky View: {hemisphere === 'northern' ? 'Northern' : 'Southern'} Hemisphere
          </span>

          <div className="flex items-center gap-2">
            <button
              id="export-single-day-btn"
              onClick={handleExportSingleDay}
              className="flex items-center gap-1.5 bg-[#B44732] hover:bg-[#9E3D2A] text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition shadow-xs"
              title="Download .ics for this single calendar date"
            >
              <Download size={13} strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
              <span>Export Day (.ics)</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-[#182421] hover:bg-[#D8D0BF] bg-[#FAF6EE] border border-[#D8D0BF] rounded-md transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
