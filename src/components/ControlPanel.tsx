import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe,
} from 'lucide-react';
import { FilterSettings } from '../types';

interface ControlPanelProps {
  currentYear: number;
  currentMonth: number; // 0..11
  filters: FilterSettings;
  onFilterChange: (newFilters: Partial<FilterSettings>) => void;
  onMonthChange: (year: number, month: number) => void;
  onRangePresetChange: (preset: 'month' | 'threeMonths' | 'year') => void;
  onResetToday: () => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/Edmonton', // North American Mountain Time (DST verification test case)
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Zurich',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Athens',
  'Asia/Dubai',
  'Asia/Kolkata', // Fractional offset UTC+05:30 (verification test case)
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland', // Southern hemisphere DST (verification test case)
  'Pacific/Honolulu',
];

const MONTH_NAMES = [
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

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentYear,
  currentMonth,
  filters,
  onFilterChange,
  onMonthChange,
  onRangePresetChange,
  onResetToday,
}) => {
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      onMonthChange(currentYear - 1, 11);
    } else {
      onMonthChange(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      onMonthChange(currentYear + 1, 0);
    } else {
      onMonthChange(currentYear, currentMonth + 1);
    }
  };

  const activeRange = filters.rangePreset || 'month';

  const segmentClass = (selected: boolean) =>
    `min-h-11 min-w-0 flex-1 rounded px-2 py-2 text-sm font-medium transition ${selected
      ? 'bg-[#182421] text-[#F3EDDF] shadow-xs'
      : 'text-[#657367] hover:bg-[#EAE1CF] hover:text-[#182421]'}`;

  const eventOptions = [
    { key: 'showFullNewMoon', id: 'toggle-quarters-cb', label: 'Moon phases', description: 'New, full & quarters' },
    { key: 'showIngresses', id: 'toggle-ingresses-cb', label: 'Sign ingresses', description: 'Exact sign changes' },
    { key: 'showDailySigns', id: 'toggle-signs-cb', label: 'Noon Moon sign', description: 'Daily snapshot' },
    { key: 'showEclipses', id: 'toggle-eclipses-cb', label: 'Eclipses', description: 'Global peaks' },
  ] as const;

  return (
    <section aria-label="Calendar controls" className="bg-[#EFE8D8] border-b border-[#D8D0BF] text-[#182421] px-3 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex min-w-0 flex-1 items-center bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-0.5">
              <button id="prev-month-btn" aria-label="Previous month" onClick={handlePrevMonth} className="w-11 h-11 flex items-center justify-center shrink-0 rounded hover:bg-[#EAE1CF]">
                <ChevronLeft size={18} />
              </button>
              <div className="flex flex-1 min-w-0 items-center gap-1">
                <select id="month-select" aria-label="Select calendar month" value={currentMonth}
                  onChange={(e) => onMonthChange(currentYear, Number(e.target.value))}
                  className="min-w-0 flex-1 min-h-11 bg-transparent text-base font-serif-almanac font-semibold cursor-pointer">
                  {MONTH_NAMES.map((name, idx) => <option key={name} value={idx}>{name}</option>)}
                </select>
                <select id="year-select" aria-label="Select calendar year" value={currentYear}
                  onChange={(e) => onMonthChange(Number(e.target.value), currentMonth)}
                  className="w-[4.5rem] min-h-11 bg-transparent text-base cursor-pointer">
                  {Array.from({ length: 15 }, (_, i) => 2020 + i).map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <button id="next-month-btn" aria-label="Next month" onClick={handleNextMonth} className="w-11 h-11 flex items-center justify-center shrink-0 rounded hover:bg-[#EAE1CF]">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <button id="today-btn" aria-label="Reset to current month and day" onClick={onResetToday}
              className="min-h-11 px-3 text-sm font-medium text-[#B44732] border border-[#B44732] rounded-md hover:bg-[#B44732] hover:text-white">Today</button>
            <div role="group" aria-label="Calendar range" className="flex flex-1 min-w-0 gap-1 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-1">
              <button id="range-month-btn" aria-pressed={activeRange === 'month'} onClick={() => onRangePresetChange('month')} className={segmentClass(activeRange === 'month')}>Month</button>
              <button id="range-3months-btn" aria-pressed={activeRange === 'threeMonths'} onClick={() => onRangePresetChange('threeMonths')} className={segmentClass(activeRange === 'threeMonths')}>3 Months</button>
              <button id="range-year-btn" aria-pressed={activeRange === 'year'} onClick={() => onRangePresetChange('year')} className={segmentClass(activeRange === 'year')}>Full Year</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-t border-[#D8D0BF] pt-4">
          <fieldset className="min-w-0">
            <legend className="text-xs uppercase tracking-wider font-semibold text-[#657367] mb-2">Show on calendar</legend>
            <div className="grid grid-cols-2 gap-2">
              {eventOptions.map(({ key, id, label, description }) => (
                <label key={key} className="flex min-w-0 items-center gap-2.5 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-2.5 cursor-pointer hover:border-[#657367]">
                  <input id={id} type="checkbox" checked={filters[key]} onChange={(e) => onFilterChange({ [key]: e.target.checked })}
                    className="w-4 h-4 shrink-0 accent-[#B44732]" />
                  <span className="min-w-0"><span className="block text-xs sm:text-sm font-medium">{label}</span><span className="block text-[11px] text-[#657367] mt-0.5">{description}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <label className="block min-w-0" htmlFor="timezone-select">
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#657367] mb-2"><Globe size={14} /> Timezone</span>
              <select id="timezone-select" value={filters.timezone} onChange={(e) => onFilterChange({ timezone: e.target.value })}
                className="w-full min-w-0 min-h-12 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-2 text-base cursor-pointer">
                {[filters.timezone, ...COMMON_TIMEZONES.filter((tz) => tz !== filters.timezone)].map((tz) => <option key={tz} value={tz}>{tz.replaceAll('_', ' ')}</option>)}
              </select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#657367]">Event times use this timezone.</p>
            </label>
            <fieldset className="min-w-0">
              <legend className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#657367] mb-2"><Compass size={14} /> Hemisphere</legend>
              <div className="flex gap-1 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-0.5">
                <button id="hemi-north-btn" aria-label="Northern hemisphere sky orientation" aria-pressed={filters.hemisphere === 'northern'} onClick={() => onFilterChange({ hemisphere: 'northern' })} className={segmentClass(filters.hemisphere === 'northern')}>North</button>
                <button id="hemi-south-btn" aria-label="Southern hemisphere sky orientation" aria-pressed={filters.hemisphere === 'southern'} onClick={() => onFilterChange({ hemisphere: 'southern' })} className={segmentClass(filters.hemisphere === 'southern')}>South</button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#657367]">Changes the Moon’s orientation.</p>
            </fieldset>
          </div>
        </div>
      </div>
    </section>
  );
};
