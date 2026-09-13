import React, { useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  Grid2X2,
  BookOpen,
  ChevronDown,
  Sparkles,
  List,
  ShieldCheck,
  Rss,
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
  onOpenSubscribeModal: () => void;
  onOpenInfoModal: () => void;
  onOpenMethodologyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hemisphere,
  viewMode,
  onViewModeChange,
  onOpenExportModal,
  onOpenSubscribeModal,
  onOpenInfoModal,
  onOpenMethodologyModal,
}) => {
  const learnMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const dismissLearnMenu = (event: Event) => {
      const menu = learnMenuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    };

    // Touch activation can blur the summary without focusing the tapped button.
    // Wait for an actual outside target instead of closing on that blur.
    document.addEventListener('pointerdown', dismissLearnMenu);
    document.addEventListener('focusin', dismissLearnMenu);
    return () => {
      document.removeEventListener('pointerdown', dismissLearnMenu);
      document.removeEventListener('focusin', dismissLearnMenu);
    };
  }, []);

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

  const views = [
    { mode: 'calendar', label: 'Month', icon: CalendarIcon },
    { mode: 'timeline', label: 'Timeline', icon: List },
    { mode: 'year', label: 'Year', icon: Grid2X2 },
  ] as const;

  const openLearnItem = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    const menu = event.currentTarget.closest('details');
    menu?.removeAttribute('open');
    menu?.querySelector('summary')?.focus();
    action();
  };

  return (
    <header className="relative z-30 bg-[#182421] text-[#F3EDDF] border-b border-[#B89A62]/40">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src="/masthead_banner.jpg" alt="" className="absolute right-0 top-0 w-full sm:w-2/3 h-full object-cover object-right opacity-20 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#182421] via-[#182421]/80 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-3 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 pt-4 pb-3 sm:pt-5 sm:pb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/moon_engraving.jpg" alt="" className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-[#B89A62]/60 p-0.5 mix-blend-screen shrink-0" />
            <div className="min-w-0">
              <h1 className="font-serif-almanac text-2xl sm:text-3xl font-semibold leading-none tracking-tight" aria-label="AstroMoon Cal — Moon Phase & Zodiac Calendar">AstroMoon<span aria-hidden="true" className="text-[#B89A62] text-xs align-top ml-1">✦</span></h1>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-[#D8D0BF] mt-1.5">A lunar almanac</p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-self-end lg:col-start-3 lg:row-start-1">
            <button id="open-subscribe-btn" aria-label="Subscribe to the live AstroMoon calendar" onClick={onOpenSubscribeModal}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-[#B89A62]/70 bg-[#182421]/70 px-3 text-xs font-semibold text-[#F3EDDF] transition hover:bg-[#253631] active:scale-95 sm:text-sm">
              <Rss size={16} /><span>Subscribe</span>
            </button>
            <button id="open-export-btn" aria-label="Export Calendar as ICS or PDF" onClick={onOpenExportModal}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-[#B44732] px-4 text-xs font-semibold text-white transition hover:bg-[#9E3D2A] active:scale-95 sm:text-sm">
              <Download size={16} /><span>Export</span>
            </button>
          </div>

          <div className="sm:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[11px] text-[#D8D0BF]"
            title={`Current Moon: ${Math.round(liveMoon.phase.fraction * 100)}% illuminated. Geocentric longitude ${liveMoon.lon.toFixed(2)}°.`}>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[#B89A62] text-[9px] uppercase tracking-wider mr-0.5">Now</span>
              <MoonVisual phaseAngle={liveMoon.phase.phaseAngle} fraction={liveMoon.phase.fraction} hemisphere={hemisphere} size={20} />
              <span>{liveMoon.phase.name}</span>
              <span className="text-[#B89A62]">{Math.round(liveMoon.phase.fraction * 100)}%</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="text-[#B89A62]">{liveMoon.sign.symbol}</span>
              <span>{liveMoon.sign.name} {liveMoon.degrees}°{liveMoon.minutes}'</span>
            </span>
          </div>
        </div>

        <div className="flex items-stretch justify-between gap-2 border-t border-[#B89A62]/20">
          <nav aria-label="Calendar view modes" className="flex flex-1 sm:flex-none sm:gap-4">
            {views.map(({ mode, label, icon: Icon }) => (
              <button key={mode} id={`view-${mode}-btn`} aria-pressed={viewMode === mode} aria-label={`Switch to ${label} view`} onClick={() => onViewModeChange(mode)}
                className={`relative flex flex-1 sm:flex-none min-h-12 items-center justify-center gap-1.5 px-1.5 sm:px-4 text-xs sm:text-sm transition ${viewMode === mode ? 'text-[#F3EDDF]' : 'text-[#D8D0BF]/75 hover:text-[#F3EDDF]'}`}>
                <Icon size={15} className={viewMode === mode ? 'text-[#B89A62]' : ''} />
                <span>{label}</span>
                {viewMode === mode && <span aria-hidden="true" className="absolute bottom-0 inset-x-2 sm:inset-x-4 h-0.5 rounded-full bg-[#B89A62]" />}
              </button>
            ))}
          </nav>

          <details ref={learnMenuRef} className="relative group self-center"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.removeAttribute('open');
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}>
            <summary className="list-none [&::-webkit-details-marker]:hidden min-h-11 flex items-center gap-1.5 px-2 sm:px-3 text-xs text-[#D8D0BF] cursor-pointer rounded hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#B89A62]">
              <BookOpen size={15} className="text-[#B89A62]" /><span>Learn</span><ChevronDown size={12} className="group-open:rotate-180 transition" />
            </summary>
            <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-1.5 rounded-lg border border-[#D8D0BF] bg-[#FAF7F0] text-[#182421] shadow-xl">
              <button id="desktop-info-btn" onClick={(event) => openLearnItem(event, onOpenInfoModal)}
                className="flex w-full min-h-12 items-center gap-3 rounded-md p-3 text-left text-sm hover:bg-[#EAE2D0]">
                <Sparkles size={18} className="text-[#B89A62]" /><span>Zodiac guide</span>
              </button>
              <button id="desktop-methodology-btn" onClick={(event) => openLearnItem(event, onOpenMethodologyModal)}
                className="flex w-full min-h-12 items-center gap-3 rounded-md p-3 text-left text-sm hover:bg-[#EAE2D0]">
                <ShieldCheck size={18} className="text-[#657367]" /><span>How we calculate</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
};
