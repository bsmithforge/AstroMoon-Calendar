import React from 'react';
import { AstroRecord, DayLunarData, FilterSettings } from '../types';
import { MoonVisual } from './MoonVisual';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

interface TimelineViewProps {
  days: DayLunarData[];
  records: AstroRecord[];
  filters: FilterSettings;
  onSelectDay: (day: DayLunarData) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  days,
  records,
  filters,
  onSelectDay,
}) => {
  // Filter records based on user's active filter settings
  const activeRecords = records.filter((rec) => {
    if (rec.eventType === 'quarter') return filters.showFullNewMoon;
    if (rec.eventType === 'ingress') return filters.showIngresses;
    if (rec.eventType === 'eclipse') return filters.showEclipses;
    if (rec.eventType === 'daily_summary') return filters.showDailySigns;
    return true;
  });

  return (
    <div className="bg-[#FAF7F0] border border-[#D8D0BF] rounded-md overflow-hidden shadow-xs">
      <div className="p-4 bg-[#EBE3D0] border-b border-[#D8D0BF] flex items-center justify-between">
        <h3 className="text-sm font-serif-almanac font-semibold text-[#182421] flex items-center gap-2">
          <CalendarIcon size={16} strokeWidth={2} className="w-4 h-4 text-[#B89A62] shrink-0" />
          <span>Astronomical Lunar &amp; Zodiac Timeline</span>
        </h3>
        <span className="text-xs text-[#5F6D61] font-sans-almanac font-medium">
          {activeRecords.length} events in active range ({filters.timezone})
        </span>
      </div>

      <div className="divide-y divide-[#D8D0BF] max-h-[720px] overflow-y-auto">
        {activeRecords.length === 0 ? (
          <div className="p-8 text-center text-[#5F6D61] text-sm">
            No events match the active display toggles. Enable "Phases", "Ingresses", "Noon Sign", or "Eclipses" in the control panel.
          </div>
        ) : (
          activeRecords.map((rec) => {
            const associatedDay = days.find((d) => d.dateString === rec.localDateString);

            return (
              <div
                key={rec.id}
                onClick={() => associatedDay && onSelectDay(associatedDay)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FFFDF9] transition cursor-pointer group"
              >
                {/* Left: Date & Moon Phase */}
                <div className="flex items-center gap-3">
                  <MoonVisual
                    phaseAngle={rec.phase.phaseAngle}
                    fraction={rec.phase.fraction}
                    hemisphere={filters.hemisphere}
                    size={34}
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-serif-almanac font-semibold text-[#182421]">
                        {rec.localDateString}
                      </span>
                      {associatedDay?.isToday && (
                        <span className="text-[10px] font-sans-almanac font-bold px-1.5 py-0.5 rounded bg-[#B44732]/15 text-[#B44732] border border-[#B44732]/30">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#5F6D61] font-sans-almanac">
                      {rec.phase.name} ({Math.round(rec.phase.fraction * 100)}%)
                    </span>
                  </div>
                </div>

                {/* Center: Event Description & Time */}
                <div className="flex-1 sm:px-4 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif-almanac font-semibold text-[#182421] text-sm">
                      {rec.title}
                    </span>

                    {rec.formattedLocalTime && (
                      <span className="text-xs text-[#182421] flex items-center gap-1 font-mono bg-[#EAE2D0] px-2 py-0.5 rounded border border-[#D8D0BF]">
                        <Clock className="w-3 h-3 text-[#B89A62]" />
                        {rec.formattedLocalTime} ({filters.timezone})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5F6D61] line-clamp-1 font-sans-almanac">
                    {rec.description}
                  </p>
                </div>

                {/* Right: Badge Indicator */}
                <div className="shrink-0 flex items-center gap-2">
                  {rec.eventType === 'quarter' && (
                    <span className="text-[10px] font-medium font-sans-almanac px-2 py-0.5 rounded-md bg-[#B89A62]/20 text-[#684F22] border border-[#B89A62]/40">
                      Exact Phase
                    </span>
                  )}
                  {rec.eventType === 'ingress' && (
                    <span className="text-[10px] font-medium font-sans-almanac px-2 py-0.5 rounded-md bg-[#DEE5DF] text-[#182421] border border-[#657367]/40">
                      Zodiac Ingress
                    </span>
                  )}
                  {rec.eventType === 'eclipse' && (
                    <span className="text-[10px] font-bold font-sans-almanac px-2 py-0.5 rounded-md bg-[#B44732]/15 text-[#B44732] border border-[#B44732]/30">
                      Global Eclipse
                    </span>
                  )}
                  {rec.eventType === 'daily_summary' && (
                    <span className="text-[10px] font-medium font-sans-almanac px-2 py-0.5 rounded-md bg-[#FAF6EE] text-[#5F6D61] border border-[#D8D0BF]">
                      Noon Snapshot
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
