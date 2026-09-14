import React from 'react';
import { Hemisphere } from '../types';
import {
  getQuartersInRange,
  getEclipsesInRange,
  getUtcForLocalTime,
} from '../utils/astronomy';

interface YearOverviewProps {
  year: number;
  hemisphere: Hemisphere;
  timezone: string;
  onSelectMonth: (month: number) => void;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const YearOverview: React.FC<YearOverviewProps> = ({
  year,
  timezone,
  onSelectMonth,
}) => {
  // Start and end of year in local time converted to UTC
  const startOfYearUtc = getUtcForLocalTime(year, 1, 1, 0, 0, 0, timezone);
  const endOfYearUtc = getUtcForLocalTime(year + 1, 1, 1, 0, 0, 0, timezone);

  const quarters = getQuartersInRange(startOfYearUtc, endOfYearUtc, timezone);
  const eclipses = getEclipsesInRange(startOfYearUtc, endOfYearUtc, timezone);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-[#D8D0BF]">
        <div>
          <h2 className="text-2xl font-serif-almanac font-normal text-[#182421] tracking-tight">
            {year} Lunar Ephemeris &amp; Eclipse Almanac
          </h2>
          <p className="text-xs text-[#5F6D61] font-sans-almanac">
            Annual overview of all Full Moons, New Moons, and Eclipses across {year} ({timezone}). Click any month to view full daily calendar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MONTHS.map((monthName, mIdx) => {
          // Find quarters and eclipses falling in this local calendar month
          const monthQuarters = quarters.filter((q) => {
            const [yStr, mStr] = q.localDateString.split('-');
            return parseInt(yStr, 10) === year && parseInt(mStr, 10) === mIdx + 1;
          });

          const monthEclipses = eclipses.filter((e) => {
            const [yStr, mStr] = e.localDateString.split('-');
            return parseInt(yStr, 10) === year && parseInt(mStr, 10) === mIdx + 1;
          });

          const newMoons = monthQuarters.filter(
            (q) => q.metadata.quarterType === 'New Moon'
          );
          const fullMoons = monthQuarters.filter(
            (q) => q.metadata.quarterType === 'Full Moon'
          );

          return (
            <div
              key={monthName}
              onClick={() => onSelectMonth(mIdx)}
              className="bg-[#FAF7F0] border border-[#D8D0BF] hover:border-[#182421] rounded-md p-4 transition-all duration-150 cursor-pointer group hover:bg-[#FFFDF9] shadow-xs"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#D8D0BF]">
                <span className="font-serif-almanac text-base font-semibold text-[#182421] group-hover:text-[#B44732] transition">
                  {monthName} {year}
                </span>
                <span className="text-[11px] text-[#5F6D61] group-hover:text-[#182421] flex items-center gap-1 font-medium font-sans-almanac">
                  Open Grid →
                </span>
              </div>

              {/* Month Highlights */}
              <div className="mt-3 space-y-2 text-xs">
                {/* Full Moons */}
                {fullMoons.map((fm) => (
                  <div
                    key={fm.id}
                    className="flex items-center justify-between bg-[#F4EEDF] border border-[#B89A62]/35 rounded p-2 text-[#182421]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌕</span>
                      <div>
                        <span className="font-serif-almanac font-semibold block">Full Moon</span>
                        <span className="text-[10px] text-[#5F6D61] font-sans-almanac">
                          {fm.localDateString} · {fm.formattedLocalTime}
                        </span>
                      </div>
                    </div>
                    <span className="font-medium text-[#7A602B]">
                      {fm.sign.symbol} {fm.sign.name}
                    </span>
                  </div>
                ))}

                {/* New Moons */}
                {newMoons.map((nm) => (
                  <div
                    key={nm.id}
                    className="flex items-center justify-between bg-[#EFECE3] border border-[#D8D0BF] rounded p-2 text-[#182421]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌑</span>
                      <div>
                        <span className="font-serif-almanac font-semibold block">New Moon</span>
                        <span className="text-[10px] text-[#5F6D61] font-sans-almanac">
                          {nm.localDateString} · {nm.formattedLocalTime}
                        </span>
                      </div>
                    </div>
                    <span className="font-medium text-[#182421]">
                      {nm.sign.symbol} {nm.sign.name}
                    </span>
                  </div>
                ))}

                {/* Eclipses */}
                {monthEclipses.map((ec) => (
                  <div
                    key={ec.id}
                    className="flex items-center justify-between bg-[#FBEFEF] border border-[#B44732]/30 rounded p-2 text-[#B44732]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">☀️</span>
                      <div>
                        <span className="font-serif-almanac font-semibold block">{ec.title}</span>
                        <span className="text-[10px] text-[#B44732]/80 font-sans-almanac">
                          {ec.localDateString} · Peak {ec.formattedLocalTime}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase font-sans-almanac">
                      {ec.metadata.eclipseKind}
                    </span>
                  </div>
                ))}

                {monthQuarters.length === 0 && monthEclipses.length === 0 && (
                  <div className="text-[#5F6D61] text-center py-2 font-sans-almanac">
                    Standard lunar transitions
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
