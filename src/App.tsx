import { useState, useMemo, useEffect } from 'react';
import {
  CalendarViewMode,
  DayLunarData,
  FilterSettings,
  ViewMode,
} from './types';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { CalendarGrid } from './components/CalendarGrid';
import { TimelineView } from './components/TimelineView';
import { YearOverview } from './components/YearOverview';
import { CalendarGuideSection } from './components/CalendarGuideSection';
import { DayDetailModal } from './components/DayDetailModal';
import { ExportModal } from './components/ExportModal';
import { ZodiacGuideModal } from './components/ZodiacGuideModal';
import { MethodologyModal } from './components/MethodologyModal';
import { generateMonthData, generateRangeDataset } from './utils/astronomy';
import { ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';

export function App() {
  const initialDate = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const y = parseInt(params.get('year') || '', 10);
    const m = parseInt(params.get('month') || '', 10);
    const now = new Date();
    const validY = !isNaN(y) && y >= 1900 && y <= 2100 ? y : now.getFullYear();
    const validM = !isNaN(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();
    return { year: validY, month: validM };
  }, []);

  const [currentYear, setCurrentYear] = useState<number>(initialDate.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.month); // 0..11
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // Synchronize document title and URL query parameters for discovery without reload
  useEffect(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    document.title = `${monthNames[currentMonth]} ${currentYear} | Moon Phase & Zodiac Calendar | AstroMoon`;

    const url = new URL(window.location.href);
    url.searchParams.set('year', String(currentYear));
    url.searchParams.set('month', String(currentMonth + 1));
    window.history.replaceState(null, '', url.toString());
  }, [currentYear, currentMonth]);

  // Interactive filter & configuration state
  const [filters, setFilters] = useState<FilterSettings>({
    hemisphere: 'northern',
    showFullNewMoon: true,
    showIngresses: true,
    showDailySigns: true,
    showEclipses: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    rangePreset: 'month',
  });

  // Modals state
  const [selectedDay, setSelectedDay] = useState<DayLunarData | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isZodiacGuideOpen, setIsZodiacGuideOpen] = useState<boolean>(false);
  const [isMethodologyModalOpen, setIsMethodologyModalOpen] = useState<boolean>(false);

  // Synchronized filter updater
  const handleFilterChange = (newFilters: Partial<FilterSettings>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Month navigation updater
  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Reset to today
  const handleResetToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setFilters((prev) => ({
      ...prev,
      rangePreset: 'month',
      startDate: undefined,
      endDate: undefined,
    }));
  };

  // Range preset changer
  const handleRangePresetChange = (preset: CalendarViewMode) => {
    const y = currentYear;
    const m = currentMonth;
    let start = '';
    let end = '';

    if (preset === 'month') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'threeMonths') {
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const endM = (m + 2) % 12;
      const endY = m + 2 >= 12 ? y + 1 : y;
      const lastDay = new Date(endY, endM + 1, 0).getDate();
      end = `${endY}-${String(endM + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'year') {
      start = `${y}-01-01`;
      end = `${y}-12-31`;
    }

    setFilters((prev) => ({
      ...prev,
      rangePreset: preset,
      startDate: start,
      endDate: end,
    }));
  };

  // Switch views
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // Monthly calendar dataset computed with astronomy-engine
  const calendarMonths = useMemo(() => {
    const preset = filters.rangePreset || 'month';
    const slots: { year: number; month: number }[] = [];
    if (preset === 'year') {
      for (let mo = 0; mo < 12; mo++) {
        slots.push({ year: currentYear, month: mo });
      }
    } else if (preset === 'threeMonths') {
      for (let k = 0; k < 3; k++) {
        const abs = currentMonth + k;
        slots.push({ year: currentYear + Math.floor(abs / 12), month: abs % 12 });
      }
    } else {
      slots.push({ year: currentYear, month: currentMonth });
    }
    return slots.map(({ year, month }) => ({
      key: `${year}-${month}`,
      label: new Date(year, month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
      days: generateMonthData(year, month, filters.hemisphere, filters.timezone),
    }));
  }, [
    currentYear,
    currentMonth,
    filters.rangePreset,
    filters.hemisphere,
    filters.timezone,
  ]);

  const snapshotRangeLabel = useMemo(() => {
    const first = calendarMonths[0].days.find((day) => day.isCurrentMonth)!;
    const last = [...calendarMonths[calendarMonths.length - 1].days]
      .reverse().find((day) => day.isCurrentMonth)!;
    return new Intl.DateTimeFormat('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: filters.timezone,
    }).formatRange(first.date, last.date);
  }, [calendarMonths, filters.timezone]);

  // Timeline / Multi-month dataset
  const timelineDataset = useMemo(() => {
    let start = filters.startDate;
    let end = filters.endDate;

    if (!start || !end) {
      if (filters.rangePreset === 'year') {
        start = `${currentYear}-01-01`;
        end = `${currentYear}-12-31`;
      } else if (filters.rangePreset === 'threeMonths') {
        const y = currentYear;
        const m = currentMonth;
        start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const endM = (m + 2) % 12;
        const endY = m + 2 >= 12 ? y + 1 : y;
        const lastDay = new Date(endY, endM + 1, 0).getDate();
        end = `${endY}-${String(endM + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        end = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      }
    }

    return generateRangeDataset(
      start,
      end,
      filters.hemisphere,
      filters.timezone
    );
  }, [currentYear, currentMonth, filters.startDate, filters.endDate, filters.rangePreset, filters.hemisphere, filters.timezone]);

  return (
    <div className="min-h-screen bg-[#F3EDDF] text-[#182421] flex flex-col font-sans-almanac selection:bg-[#B44732] selection:text-white">
      {/* Top Header Masthead with Live Moon Pill, Methodology Verification & Quick Actions */}
      <Header
        hemisphere={filters.hemisphere}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenInfoModal={() => setIsZodiacGuideOpen(true)}
        onOpenMethodologyModal={() => setIsMethodologyModalOpen(true)}
      />

      {/* Control Panel: Navigation, Filters, Hemisphere, Display Toggles, Timezone */}
      <ControlPanel
        currentYear={currentYear}
        currentMonth={currentMonth}
        filters={filters}
        onFilterChange={handleFilterChange}
        onMonthChange={handleMonthChange}
        onRangePresetChange={handleRangePresetChange}
        onResetToday={handleResetToday}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-6">
        {/* Active View Rendering */}
        {viewMode === 'calendar' && (
          <div className="space-y-4">
            {/* Quick Month Title Banner */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-1 border-b border-[#D8D0BF]">
              <div>
                <h2 className="text-2xl sm:text-3xl font-normal text-[#182421] font-serif-almanac tracking-tight">
                  {calendarMonths.length === 1
                    ? calendarMonths[0].label
                    : `${calendarMonths[0].label} – ${calendarMonths[calendarMonths.length - 1].label}`}
                </h2>
                <p className="text-xs text-[#657367] mt-0.5">
                  Select any date to view astronomical coordinates, zodiac ingresses, and traditional interpretations.
                </p>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-3 text-xs text-[#657367] flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-sm leading-none">🌕</span>
                  <span className="font-serif-almanac">Full Moon</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-sm leading-none">🌑</span>
                  <span className="font-serif-almanac">New Moon</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[#657367] font-bold">♈</span>
                  <span className="font-serif-almanac">Sign Ingress</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[#B44732] font-bold">☀️</span>
                  <span className="font-serif-almanac">Eclipse</span>
                </span>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[#657367] break-words">
              Daily Moon sign &amp; phase snapshots: <strong className="font-medium text-[#182421]">{snapshotRangeLabel}, at 12:00:00 noon each day</strong>
              {' '}· {filters.timezone}.
            </p>

            {/* One 7-column grid per month in the selected range */}
            <div className="space-y-6">
              {calendarMonths.map((cm) => (
                <div key={cm.key} className="space-y-2">
                  {calendarMonths.length > 1 && (
                    <h3 className="text-lg sm:text-xl font-normal text-[#182421] font-serif-almanac tracking-tight pt-1">
                      {cm.label}
                    </h3>
                  )}
                  <CalendarGrid
                    days={cm.days}
                    filters={filters}
                    onSelectDay={setSelectedDay}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'timeline' && (
          <TimelineView
            days={timelineDataset.days}
            records={timelineDataset.records}
            filters={filters}
            onSelectDay={setSelectedDay}
          />
        )}

        {viewMode === 'year' && (
          <YearOverview
            year={currentYear}
            hemisphere={filters.hemisphere}
            timezone={filters.timezone}
            onSelectMonth={(m) => {
              setCurrentMonth(m);
              setViewMode('calendar');
            }}
          />
        )}

        {/* Semantic Guide & Explanation Section */}
        <CalendarGuideSection />

        {/* Informative Footer Card: Ephemeris Specs & Transparency */}
        <div className="mt-8 border border-[#D8D0BF] bg-[#FAF7F0] rounded-md p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs text-[#657367] shadow-xs">
          <div className="space-y-1 min-w-0 max-w-2xl">
            <div className="flex items-center gap-2 text-[#182421] font-serif-almanac text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-[#B89A62]" />
              <span>Astronomical Accuracy &amp; Ephemeris Specifications</span>
            </div>
            <p className="leading-relaxed">
              Calculates apparent geocentric ecliptic longitude (&lambda;, 0°–360°) referenced to the true equinox of date, mapped into the 12 tropical zodiac signs. Zodiac ingresses are refined via bisection search to &le; 1 second. Eclipses and lunar quarters are derived from instantaneous solar-lunar elongation angles.
            </p>
          </div>

          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 lg:w-64 lg:shrink-0 lg:grid-cols-1 [&>button]:min-h-11 [&>button]:justify-center">
            <button
              onClick={() => setIsMethodologyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF6EE] hover:bg-[#EAE2D0] text-[#182421] rounded-md border border-[#D8D0BF] transition font-sans-almanac shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#B89A62]" />
              <span>Methodology &amp; Verification</span>
            </button>
            <button
              onClick={() => setIsZodiacGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF6EE] hover:bg-[#EAE2D0] text-[#182421] rounded-md border border-[#D8D0BF] transition font-sans-almanac shadow-xs"
            >
              <span>Zodiac Map (0°–360°)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#657367]" />
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#B44732] hover:bg-[#9E3D2A] text-white rounded-md transition font-sans-almanac font-medium shadow-xs"
            >
              <span>Export (.ics / PDF)</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D8D0BF] bg-[#EFE8D8] px-4 sm:px-6 py-6 text-sm text-[#657367]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-serif-almanac text-lg font-semibold text-[#182421]">AstroMoon</p>
            <p className="mt-1 text-xs leading-relaxed">Your lunar calendar &amp; almanac. Explore, download, and print.</p>
          </div>
          <a href="https://smiths-forge.ai.studio/" target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 self-start items-center gap-2 rounded-md border border-[#D8D0BF] bg-[#FAF7F0] px-4 py-2 text-[#182421] hover:border-[#B89A62] hover:bg-[#FFFDF9] transition"
            aria-label="Visit Smith’s Forge (opens in a new tab)">
            Made by Smith’s Forge <ArrowUpRight className="w-4 h-4 text-[#B44732]" />
          </a>
        </div>
      </footer>

      {/* Modals */}
      <DayDetailModal
        day={selectedDay}
        hemisphere={filters.hemisphere}
        timezone={filters.timezone}
        onClose={() => setSelectedDay(null)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        filters={filters}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onClose={() => setIsExportModalOpen(false)}
      />

      <ZodiacGuideModal
        isOpen={isZodiacGuideOpen}
        onClose={() => setIsZodiacGuideOpen(false)}
      />

      <MethodologyModal
        isOpen={isMethodologyModalOpen}
        onClose={() => setIsMethodologyModalOpen(false)}
      />
    </div>
  );
}

export default App;
