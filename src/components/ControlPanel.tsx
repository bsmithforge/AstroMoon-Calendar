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

  return (
    <div className="bg-[#EFE8D8] border-b border-[#D8D0BF] text-[#182421] px-3 sm:px-6 py-2.5 sm:py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
        {/* Month Navigation Controls & Quick Presets */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Month / Year Navigator */}
          <div className="flex items-center bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-0.5 shadow-xs shrink-0">
            <button
              id="prev-month-btn"
              aria-label="Previous month"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-[#EAE1CF] rounded text-[#182421] transition shrink-0"
              title="Previous Month"
            >
              <ChevronLeft size={16} strokeWidth={2} className="w-4 h-4 shrink-0" />
            </button>

            <div className="flex items-center gap-1.5 px-2 shrink-0">
              <select
                id="month-select"
                aria-label="Select calendar month"
                value={currentMonth}
                onChange={(e) =>
                  onMonthChange(currentYear, parseInt(e.target.value, 10))
                }
                className="bg-transparent text-sm font-serif-almanac font-semibold text-[#182421] cursor-pointer focus:outline-none"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx} className="bg-[#FAF6EE] text-[#182421] font-serif-almanac">
                    {name}
                  </option>
                ))}
              </select>

              <span className="text-[#B89A62] font-serif-almanac text-xs">·</span>

              <select
                id="year-select"
                aria-label="Select calendar year"
                value={currentYear}
                onChange={(e) =>
                  onMonthChange(parseInt(e.target.value, 10), currentMonth)
                }
                className="bg-transparent text-sm font-sans-almanac font-semibold text-[#657367] cursor-pointer focus:outline-none"
              >
                {Array.from({ length: 15 }, (_, i) => 2020 + i).map((year) => (
                  <option key={year} value={year} className="bg-[#FAF6EE] text-[#182421]">
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="next-month-btn"
              aria-label="Next month"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-[#EAE1CF] rounded text-[#182421] transition shrink-0"
              title="Next Month"
            >
              <ChevronRight size={16} strokeWidth={2} className="w-4 h-4 shrink-0" />
            </button>
          </div>

          {/* Today Button */}
          <button
            id="today-btn"
            aria-label="Reset to current month and day"
            onClick={onResetToday}
            className="px-2.5 py-1 text-xs font-sans-almanac font-medium text-[#B44732] hover:text-white bg-[#FAF6EE] hover:bg-[#B44732] border border-[#B44732] rounded-md transition shadow-xs shrink-0"
          >
            Today
          </button>

          {/* Quick Range Presets */}
          <div className="flex items-center gap-0.5 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-0.5 text-xs shadow-xs shrink-0">
            <span className="text-[#657367] text-[11px] font-sans-almanac px-1.5 shrink-0">Range:</span>
            <button
              id="range-month-btn"
              aria-label="View month calendar"
              onClick={() => onRangePresetChange('month')}
              className={`px-2.5 py-0.5 rounded font-medium font-sans-almanac transition shrink-0 ${
                activeRange === 'month'
                  ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                  : 'text-[#657367] hover:text-[#182421] hover:bg-[#EAE1CF]'
              }`}
              title="View single month"
            >
              Month
            </button>
            <button
              id="range-3months-btn"
              aria-label="View a 3-month calendar"
              onClick={() => onRangePresetChange('threeMonths')}
              className={`px-2.5 py-0.5 rounded font-medium font-sans-almanac transition shrink-0 ${
                activeRange === 'threeMonths'
                  ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                  : 'text-[#657367] hover:text-[#182421] hover:bg-[#EAE1CF]'
              }`}
              title="View a 3-month calendar"
            >
              3 Months
            </button>
            <button
              id="range-year-btn"
              aria-label="View a full-year calendar"
              onClick={() => onRangePresetChange('year')}
              className={`px-2.5 py-0.5 rounded font-medium font-sans-almanac transition shrink-0 ${
                activeRange === 'year'
                  ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                  : 'text-[#657367] hover:text-[#182421] hover:bg-[#EAE1CF]'
              }`}
              title="View a full-year calendar"
            >
              Full Year
            </button>
          </div>
        </div>

        {/* Right side: Filters, Hemisphere & Timezone */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
          {/* Hemisphere Toggle */}
          <div
            className="flex items-center gap-1 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-0.5 shrink-0 shadow-xs"
            title="Simplified sky view orientation. Does not alter astrological signs or event times."
          >
            <Compass size={13} strokeWidth={2} className="w-3.5 h-3.5 text-[#B89A62] ml-1 shrink-0" />
            <button
              id="hemi-north-btn"
              aria-label="Northern hemisphere sky orientation"
              onClick={() => onFilterChange({ hemisphere: 'northern' })}
              className={`px-2 py-0.5 rounded transition font-sans-almanac font-medium shrink-0 ${
                filters.hemisphere === 'northern'
                  ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                  : 'text-[#657367] hover:text-[#182421]'
              }`}
            >
              North
            </button>
            <button
              id="hemi-south-btn"
              aria-label="Southern hemisphere sky orientation"
              onClick={() => onFilterChange({ hemisphere: 'southern' })}
              className={`px-2 py-0.5 rounded transition font-sans-almanac font-medium shrink-0 ${
                filters.hemisphere === 'southern'
                  ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                  : 'text-[#657367] hover:text-[#182421]'
              }`}
            >
              South
            </button>
          </div>

          {/* Display Checkbox Toggles: Exactly 4 distinct filters */}
          <div className="flex items-center gap-2.5 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md px-2.5 py-1 shrink-0 flex-wrap sm:flex-nowrap shadow-xs">
            <label
              className="flex items-center gap-1.5 cursor-pointer select-none text-[#182421] hover:text-[#B44732] transition shrink-0"
              title="Exact New Moon, Full Moon, and Quarters"
            >
              <input
                id="toggle-quarters-cb"
                aria-label="Show major phases: New Moon, Full Moon, and Quarters"
                type="checkbox"
                checked={filters.showFullNewMoon}
                onChange={(e) =>
                  onFilterChange({ showFullNewMoon: e.target.checked })
                }
                className="rounded border-[#D8D0BF] text-[#B44732] focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer w-3.5 h-3.5 shrink-0"
              />
              <span className="flex items-center gap-1 font-sans-almanac text-xs">
                <span>🌕</span>
                <span>Phases</span>
              </span>
            </label>

            <label
              className="flex items-center gap-1.5 cursor-pointer select-none text-[#182421] hover:text-[#B44732] transition shrink-0"
              title="Exact Zodiac Sign Ingresses (30° boundaries, refined to <=1s)"
            >
              <input
                id="toggle-ingresses-cb"
                aria-label="Show exact zodiac sign ingresses"
                type="checkbox"
                checked={filters.showIngresses}
                onChange={(e) =>
                  onFilterChange({ showIngresses: e.target.checked })
                }
                className="rounded border-[#D8D0BF] text-[#657367] focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer w-3.5 h-3.5 shrink-0"
              />
              <span className="flex items-center gap-1 font-sans-almanac text-xs">
                <span className="text-[#657367] font-bold">♈</span>
                <span>Ingresses</span>
              </span>
            </label>

            <label
              className="flex items-center gap-1.5 cursor-pointer select-none text-[#182421] hover:text-[#B44732] transition shrink-0"
              title="Daily Moon Zodiac Sign snapshot at local noon (12:00:00)"
            >
              <input
                id="toggle-signs-cb"
                aria-label="Show daily local noon Moon sign"
                type="checkbox"
                checked={filters.showDailySigns}
                onChange={(e) =>
                  onFilterChange({ showDailySigns: e.target.checked })
                }
                className="rounded border-[#D8D0BF] text-[#182421] focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer w-3.5 h-3.5 shrink-0"
              />
              <span className="flex items-center gap-1 font-sans-almanac text-xs">
                <span>Noon Sign</span>
              </span>
            </label>

            <label
              className="flex items-center gap-1.5 cursor-pointer select-none text-[#182421] hover:text-[#B44732] transition shrink-0"
              title="Global Solar and Lunar Eclipses"
            >
              <input
                id="toggle-eclipses-cb"
                aria-label="Show solar and lunar eclipses"
                type="checkbox"
                checked={filters.showEclipses}
                onChange={(e) =>
                  onFilterChange({ showEclipses: e.target.checked })
                }
                className="rounded border-[#D8D0BF] text-[#B44732] focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer w-3.5 h-3.5 shrink-0"
              />
              <span className="flex items-center gap-1 font-sans-almanac text-xs">
                <span className="text-[#B44732]">☀️</span>
                <span>Eclipses</span>
              </span>
            </label>
          </div>

          {/* Timezone Selector */}
          <div
            className="flex items-center gap-1.5 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md px-2.5 py-1 shrink-0 shadow-xs"
            title="Active IANA Timezone. Changing timezone shifts local calendar day mapping without changing underlying UTC instants."
          >
            <Globe size={13} strokeWidth={2} className="w-3.5 h-3.5 text-[#657367] shrink-0" />
            <select
              id="timezone-select"
              aria-label="Observer timezone selection"
              value={filters.timezone}
              onChange={(e) => onFilterChange({ timezone: e.target.value })}
              className="bg-transparent text-xs font-sans-almanac font-medium text-[#182421] cursor-pointer focus:outline-none max-w-[130px] sm:max-w-[170px] truncate"
            >
              <option value={filters.timezone} className="bg-[#FAF6EE] text-[#182421]">
                {filters.timezone.replace('_', ' ')}
              </option>
              {COMMON_TIMEZONES.filter((tz) => tz !== filters.timezone).map(
                (tz) => (
                  <option key={tz} value={tz} className="bg-[#FAF6EE] text-[#182421]">
                    {tz.replace('_', ' ')}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
