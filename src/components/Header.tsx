import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  Globe2,
  Sparkles,
  List,
  ShieldCheck,
} from 'lucide-react';
import { Hemisphere, ViewMode } from '../types';
import { MoonVisual } from './MoonVisual';
import { getMoonEclipticLongitude, getMoonPhaseInfo } from '../utils/astronomy';
import { getZodiacSignFromLongitude } from '../utils/zodiac';

interface HeaderProps {
  hemisphere: Hemisphere;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenExportModal: () => void;
  onOpenInfoModal: () => void;
  onOpenMethodologyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hemisphere,
  viewMode,
  onViewModeChange,
  onOpenExportModal,
  onOpenInfoModal,
  onOpenMethodologyModal,
}) => {
  // Calculate real-time instantaneous Moon at the current instant
  const liveMoon = useMemo(() => {
    const now = new Date();
    const phase = getMoonPhaseInfo(now, hemisphere);
    const lon = getMoonEclipticLongitude(now);
    const zodiac = getZodiacSignFromLongitude(lon);
    return {
      phase,
      lon,
      sign: zodiac.sign,
      degrees: zodiac.degrees,
      minutes: zodiac.minutes,
    };
  }, [hemisphere]);

  return (
    <header className="relative bg-[#182421] text-[#F3EDDF] border-b border-[#B89A62]/40 shadow-lg overflow-hidden z-30">
      {/* Right-aligned Masthead Lunar Artwork: wide illustration on desktop */}
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-2/3 md:w-1/2 pointer-events-none select-none overflow-hidden hidden sm:block">
        <img
          src="/masthead_banner.jpg"
          alt="Astronomical lunar engraving masthead"
          referrerPolicy="no-referrer"
          className="absolute right-0 top-0 h-full w-full object-cover object-right opacity-80 mix-blend-screen"
        />
        {/* Subtle gradient vignette to ensure high contrast for controls and text */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#182421] via-[#182421]/60 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand Identity & Wordmark */}
        <div className="flex items-center gap-3 shrink-0 z-10">
          {/* Circular Moon Engraving Medallion (Mobile / Brand Icon) */}
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border border-[#B89A62]/60 bg-[#121A18] shadow-inner shrink-0 flex items-center justify-center p-0.5">
            <img
              src="/moon_engraving.jpg"
              alt="Moon engraving medallion"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full mix-blend-screen"
            />
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h1
                className="text-xl sm:text-2xl font-serif-almanac font-bold tracking-tight text-[#F3EDDF] drop-shadow-sm flex items-center gap-1.5"
                aria-label="AstroMoon Cal — Moon Phase & Zodiac Calendar"
              >
                <span>AstroMoon Cal</span>
                <span className="text-[#B89A62] text-xs leading-none" title="Midnight Almanac">✦</span>
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs font-sans-almanac text-[#D8D0BF]/90 tracking-wide">
              Moon Phase &amp; Zodiac Calendar
            </p>
          </div>
        </div>

        {/* Center: Live Instantaneous Moon Snapshot */}
        <div
          className="flex items-center gap-2 bg-[#121A18]/90 border border-[#B89A62]/35 rounded-full px-3 py-1 text-xs text-[#D8D0BF] shadow-sm shrink-0 order-3 lg:order-2 mx-auto lg:mx-0 z-10"
          title={`Live geocentric ecliptic longitude: ${liveMoon.lon.toFixed(2)}° (True Equinox of Date)`}
        >
          <span className="text-[#B89A62] font-medium flex items-center gap-1.5 shrink-0 text-[11px] uppercase tracking-wider">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B89A62] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B89A62]"></span>
            </span>
            Live:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <MoonVisual
              phaseAngle={liveMoon.phase.phaseAngle}
              fraction={liveMoon.phase.fraction}
              hemisphere={hemisphere}
              size={18}
            />
            <span className="font-serif-almanac text-[#F3EDDF] text-xs sm:text-sm">
              {liveMoon.phase.name} ({Math.round(liveMoon.phase.fraction * 100)}%)
            </span>
          </div>
          <span className="text-[#657367] shrink-0">•</span>
          <div className="flex items-center gap-1 text-[#F3EDDF] shrink-0 font-medium">
            <span className="text-sm leading-none">{liveMoon.sign.symbol}</span>
            <span className="font-serif-almanac text-xs sm:text-sm">{liveMoon.sign.name}</span>
            <span className="text-[#D8D0BF] text-[11px] font-mono">
              {liveMoon.degrees}°{liveMoon.minutes}'
            </span>
          </div>
        </div>

        {/* Right: View Switcher, Accuracy, Guide & Primary Vermilion Export Button */}
        <div className="flex items-center gap-2 flex-wrap justify-end order-2 lg:order-3 w-full lg:w-auto lg:ml-0 z-10">
          {/* View Mode Switcher */}
          <nav aria-label="Calendar view modes" className="inline-flex rounded-md bg-[#121A18] border border-[#2C3E39] p-0.5 text-xs font-medium text-[#D8D0BF] shrink-0 shadow-inner">
            <button
              id="view-calendar-btn"
              aria-label="Switch to Month Calendar View"
              onClick={() => onViewModeChange('calendar')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition shrink-0 ${
                viewMode === 'calendar'
                  ? 'bg-[#F3EDDF] text-[#182421] font-semibold shadow-sm'
                  : 'hover:text-[#F3EDDF] hover:bg-[#1E2E2A]'
              }`}
            >
              <CalendarIcon size={13} strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
              <span>Month</span>
            </button>
            <button
              id="view-timeline-btn"
              aria-label="Switch to Timeline Ephemeris View"
              onClick={() => onViewModeChange('timeline')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition shrink-0 ${
                viewMode === 'timeline'
                  ? 'bg-[#F3EDDF] text-[#182421] font-semibold shadow-sm'
                  : 'hover:text-[#F3EDDF] hover:bg-[#1E2E2A]'
              }`}
            >
              <List size={13} strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
              <span>Timeline</span>
            </button>
            <button
              id="view-year-btn"
              aria-label="Switch to Full Year Overview"
              onClick={() => onViewModeChange('year')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition shrink-0 ${
                viewMode === 'year'
                  ? 'bg-[#F3EDDF] text-[#182421] font-semibold shadow-sm'
                  : 'hover:text-[#F3EDDF] hover:bg-[#1E2E2A]'
              }`}
            >
              <Globe2 size={13} strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
              <span>Year</span>
            </button>
          </nav>

          {/* Accuracy & Methodology Modal Trigger */}
          <button
            id="desktop-methodology-btn"
            aria-label="Astronomical Accuracy & Methodology Verification"
            onClick={onOpenMethodologyModal}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-[#121A18] border border-[#2C3E39] text-[#D8D0BF] hover:text-[#F3EDDF] hover:border-[#B89A62]/60 transition shadow-sm shrink-0"
            title="Independent verification against USNO and NASA data"
          >
            <ShieldCheck size={13} strokeWidth={2} className="w-3.5 h-3.5 text-[#B89A62] shrink-0" />
            <span className="hidden sm:inline">Accuracy</span>
          </button>

          {/* Astrological Guide button */}
          <button
            id="desktop-info-btn"
            aria-label="Astrological Zodiac Degree Map & Guide"
            onClick={onOpenInfoModal}
            className="p-1.5 text-[#B89A62] hover:text-[#F3EDDF] hover:bg-[#1E2E2A] rounded-md transition shrink-0"
            title="Astrological Zodiac Degree Map & Almanac Guide"
          >
            <Sparkles size={15} strokeWidth={2} className="w-4 h-4 shrink-0" />
          </button>

          {/* Export Action Button in Vermilion */}
          <button
            id="open-export-btn"
            aria-label="Export Calendar as ICS or PDF"
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 bg-[#B44732] hover:bg-[#9E3D2A] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-sm shadow-[#B44732]/30 transition active:scale-95 shrink-0"
          >
            <Download size={13} strokeWidth={2.5} className="w-3.5 h-3.5 shrink-0" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
