import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  ChevronDown,
  Check,
  Orbit,
  Sparkles,
  Eclipse,
} from 'lucide-react';
import { FilterSettings, ViewMode } from '../types';
import { MoonVisual } from './MoonVisual';

interface ControlPanelProps {
  currentYear: number;
  currentMonth: number; // 0..11
  viewMode: ViewMode;
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
  viewMode,
  filters,
  onFilterChange,
  onMonthChange,
  onRangePresetChange,
  onResetToday,
}) => {
  const isYearView = viewMode === 'year';

  const handlePrevPeriod = () => {
    if (isYearView) {
      onMonthChange(currentYear - 1, currentMonth);
      return;
    }
    if (currentMonth === 0) {
      onMonthChange(currentYear - 1, 11);
    } else {
      onMonthChange(currentYear, currentMonth - 1);
    }
  };

  const handleNextPeriod = () => {
    if (isYearView) {
      onMonthChange(currentYear + 1, currentMonth);
      return;
    }
    if (currentMonth === 11) {
      onMonthChange(currentYear + 1, 0);
    } else {
      onMonthChange(currentYear, currentMonth + 1);
    }
  };

  const handleResetCurrentPeriod = () => {
    if (isYearView) {
      onMonthChange(new Date().getFullYear(), currentMonth);
      return;
    }
    onResetToday();
  };

  const activeRange = filters.rangePreset || 'month';

  const [skySettingsOpen, setSkySettingsOpen] = useState(false);
  const city = filters.timezone.split('/').pop()?.replaceAll('_', ' ') || filters.timezone;
  const eventOptions = [
    { key: 'showFullNewMoon', id: 'toggle-quarters-cb', label: 'Moon phases', description: 'Exact new Moon, full Moon and quarters', color: '#86662E', background: '#ECE1C7', icon: <MoonVisual phaseAngle={90} fraction={0.5} hemisphere={filters.hemisphere} size={24} /> },
    { key: 'showIngresses', id: 'toggle-ingresses-cb', label: 'Sign changes', description: 'Exact zodiac sign ingresses', color: '#4E6859', background: '#E0E8DF', icon: <Orbit size={23} strokeWidth={1.5} /> },
    { key: 'showDailySigns', id: 'toggle-signs-cb', label: 'Noon signs', description: 'Daily Moon sign at local noon', color: '#5C586D', background: '#E8E3EB', icon: <Sparkles size={23} strokeWidth={1.5} /> },
    { key: 'showEclipses', id: 'toggle-eclipses-cb', label: 'Eclipses', description: 'Global solar and lunar eclipse peaks', color: '#B44732', background: '#F0DED4', icon: <Eclipse size={23} strokeWidth={1.5} /> },
  ] as const;

  return (
    <section aria-label="Calendar controls" className="bg-[#F3EDDF] border-b border-[#D8D0BF] text-[#182421]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-6 py-2.5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button id="prev-month-btn" aria-label={isYearView ? 'Previous year' : 'Previous month'} onClick={handlePrevPeriod} className="w-11 h-11 flex items-center justify-center shrink-0 rounded-full border border-[#D8D0BF] hover:bg-[#EAE1CF] hover:border-[#B89A62] transition">
              <ChevronLeft size={18} />
            </button>
            <div className="flex flex-1 min-w-0 items-center justify-center gap-0.5 md:gap-2">
              {!isYearView && (
                <select id="month-select" aria-label="Select calendar month" value={currentMonth}
                  onChange={(e) => onMonthChange(currentYear, Number(e.target.value))}
                  className="min-w-0 max-w-40 min-h-11 bg-transparent text-xl sm:text-2xl font-serif-almanac font-semibold cursor-pointer">
                  {MONTH_NAMES.map((name, idx) => <option key={name} value={idx}>{name}</option>)}
                </select>
              )}
              <select id="year-select" aria-label="Select calendar year" value={currentYear}
                onChange={(e) => onMonthChange(Number(e.target.value), currentMonth)}
                className={`${isYearView ? 'w-[6rem] text-xl sm:text-2xl font-semibold text-[#182421]' : 'w-[4.2rem] text-base text-[#5F6D61]'} min-h-11 bg-transparent font-serif-almanac cursor-pointer`}>
                {Array.from({ length: 201 }, (_, i) => 1900 + i).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <button id="next-month-btn" aria-label={isYearView ? 'Next year' : 'Next month'} onClick={handleNextPeriod} className="w-11 h-11 flex items-center justify-center shrink-0 rounded-full border border-[#D8D0BF] hover:bg-[#EAE1CF] hover:border-[#B89A62] transition">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className={`flex items-center gap-2 md:gap-5 ${isYearView ? 'justify-center md:justify-end' : 'justify-between'}`}>
            <button id="today-btn" aria-label={isYearView ? 'Go to the current year' : 'Reset to the current month and day'} onClick={handleResetCurrentPeriod}
              className="min-h-11 px-2 text-xs text-[#B44732] font-semibold underline decoration-[#B44732]/30 underline-offset-4 hover:decoration-[#B44732]">{isYearView ? 'Current year' : 'Today'}</button>
            {!isYearView && (
              <div role="group" aria-label="Calendar range" className="flex rounded-full border border-[#D8D0BF] bg-[#EDE6D6]/70 p-0.5">
                {([
                  { preset: 'month', id: 'range-month-btn', label: '1 month' },
                  { preset: 'threeMonths', id: 'range-3months-btn', label: '3 months' },
                  { preset: 'year', id: 'range-year-btn', label: 'Full year' },
                ] as const).map(({ preset, id, label }) => (
                  <button key={preset} id={id} aria-pressed={activeRange === preset} onClick={() => onRangePresetChange(preset)}
                    className={`min-h-11 px-2.5 sm:px-3 text-xs rounded-full transition ${activeRange === preset ? 'text-[#182421] font-semibold bg-[#FAF7F0] shadow-sm' : 'text-[#5F6D61] hover:bg-[#FAF7F0]/65'}`}>{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`lg:flex lg:items-center lg:gap-8 border-t border-[#D8D0BF]/70 ${isYearView ? 'py-1 lg:justify-end' : 'lg:justify-between'}`}>
          {!isYearView && (
            <fieldset className="min-w-0 lg:flex-1 py-2 sm:py-2.5">
              <legend className="sr-only">Events shown on your calendar. Select to show or hide.</legend>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-2 lg:max-w-2xl">
                {eventOptions.map(({ key, id, label, description, color, background, icon }) => (
                  <label key={key} htmlFor={id} className="group relative flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-[#EDE6D6]/70 sm:px-2">
                    <input id={id} type="checkbox" aria-describedby={`${id}-description`} checked={filters[key]} onChange={(e) => onFilterChange({ [key]: e.target.checked })} className="peer sr-only" />
                    <span style={{ color: filters[key] ? color : '#5F6D61', backgroundColor: filters[key] ? background : 'transparent' }}
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition group-hover:scale-105 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-[#182421] ${filters[key] ? 'border-transparent' : 'border-[#D8D0BF] opacity-70'}`}>
                      {icon}
                      {filters[key] && <span className="absolute -bottom-0.5 -right-0.5 flex w-3.5 h-3.5 items-center justify-center rounded-full bg-[#FAF7F0] border border-current"><Check size={9} strokeWidth={3} /></span>}
                    </span>
                    <span className={`text-xs leading-tight transition ${filters[key] ? 'font-semibold text-[#182421]' : 'text-[#5F6D61]'}`}>{label}</span>
                    <span id={`${id}-description`} className="sr-only">{description}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <button id="sky-settings-btn" aria-expanded={skySettingsOpen} aria-controls="sky-settings" onClick={() => setSkySettingsOpen(!skySettingsOpen)}
            className={`w-full lg:w-auto flex min-h-12 items-center justify-between gap-3 text-xs text-[#5F6D61] py-2 hover:text-[#182421] transition ${isYearView ? '' : 'border-t lg:border-t-0 border-[#D8D0BF]/70 lg:pl-5 lg:border-l'}`}>
            <span className="flex min-w-0 items-center gap-2.5"><Globe size={17} className="text-[#86662E]" /><span className="min-w-0 text-left"><span className="block text-[11px] font-medium text-[#5F6D61]">Your sky</span><span className="block break-words font-semibold text-[#182421]">{city} · {filters.hemisphere === 'northern' ? 'Northern' : 'Southern'} hemisphere</span></span></span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium">{skySettingsOpen ? 'Done' : 'Change'}<ChevronDown size={13} className={`transition ${skySettingsOpen ? 'rotate-180' : ''}`} /></span>
          </button>
        </div>

        <div id="sky-settings" hidden={!skySettingsOpen} className="pb-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2 rounded-xl bg-[#EDE6D6] p-4">
            <label className="block min-w-0" htmlFor="timezone-select">
              <span className="block text-sm font-serif-almanac font-semibold mb-1.5">Local time</span>
              <select id="timezone-select" value={filters.timezone} onChange={(e) => onFilterChange({ timezone: e.target.value })}
                className="w-full min-w-0 min-h-11 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-2 text-base cursor-pointer">
                {[filters.timezone, ...COMMON_TIMEZONES.filter((tz) => tz !== filters.timezone)].map((tz) => <option key={tz} value={tz}>{tz.replaceAll('_', ' ')}</option>)}
              </select>
              <p className="mt-1.5 text-[11px] text-[#5F6D61]">Moon events follow this timezone.</p>
            </label>
            <fieldset className="min-w-0">
              <legend className="text-sm font-serif-almanac font-semibold mb-1.5">How you see the Moon</legend>
              <div className="flex gap-2">
                {(['northern', 'southern'] as const).map((hemisphere) => (
                  <button key={hemisphere} id={hemisphere === 'northern' ? 'hemi-north-btn' : 'hemi-south-btn'} aria-label={`${hemisphere === 'northern' ? 'Northern' : 'Southern'} hemisphere sky orientation`} aria-pressed={filters.hemisphere === hemisphere} onClick={() => onFilterChange({ hemisphere })}
                    className={`flex flex-1 min-h-11 items-center justify-center gap-2 rounded-full border text-xs transition ${filters.hemisphere === hemisphere ? 'border-[#657367] bg-[#FAF7F0] text-[#182421]' : 'border-transparent text-[#5F6D61] hover:bg-[#FAF7F0]/60'}`}>
                    <MoonVisual phaseAngle={90} fraction={0.5} hemisphere={hemisphere} size={21} />
                    {hemisphere === 'northern' ? 'North' : 'South'}
                    {filters.hemisphere === hemisphere && <Check size={12} />}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-[#5F6D61]">Same events, a different Moon orientation.</p>
            </fieldset>
          </div>
        </div>
      </div>
    </section>
  );
};
