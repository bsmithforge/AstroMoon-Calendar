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
    { mode: 'calendar', label: 'Calendar', shortLabel: 'Calendar', icon: CalendarIcon },
    { mode: 'timeline', label: 'Timeline', shortLabel: 'Timeline', icon: List },
    { mode: 'year', label: 'Year overview', shortLabel: 'Year', icon: Grid2X2 },
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
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(18rem,auto)_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 py-3 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/moon_engraving.jpg" alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#B89A62]/60 p-0.5 mix-blend-screen shrink-0" />
            <div className="min-w-0">
              <h1 className="font-serif-almanac text-2xl sm:text-[1.7rem] font-semibold leading-none tracking-tight" aria-label="AstroMoon Cal — Moon Phase & Zodiac Calendar">AstroMoon<span aria-hidden="true" className="text-[#B89A62] text-xs align-top ml-1">✦</span></h1>
              <p className="text-xs uppercase tracking-[0.16em] text-[#D8D0BF] mt-1">A lunar almanac</p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-self-end lg:col-start-3 lg:row-start-1">
            <button id="open-subscribe-btn" aria-label="Subscribe to the live AstroMoon calendar" onClick={onOpenSubscribeModal}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-[#B89A62]/70 bg-[#182421]/70 px-3 text-sm font-semibold text-[#F3EDDF] transition hover:bg-[#253631] active:scale-[0.98]">
              <Rss size={16} /><span>Subscribe</span>
            </button>
            <button id="open-export-btn" aria-label="Export Calendar as ICS or PDF" onClick={onOpenExportModal}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-[#B44732] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9E3D2A] active:scale-[0.98]">
              <Download size={16} /><span>Export</span>
            </button>
          </div>

          <div
            className="sm:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 flex min-h-10 min-w-0 flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-full border border-[#B89A62]/35 bg-[#101C19]/55 px-3 py-1.5 text-[13px] text-[#D8D0BF]"
          >
            <span className="sr-only">Current Moon: {liveMoon.phase.name}, {Math.round(liveMoon.phase.fraction * 100)} percent illuminated, Moon in {liveMoon.sign.name} at {liveMoon.degrees} degrees {liveMoon.minutes} minutes. Geocentric longitude {liveMoon.lon.toFixed(2)} degrees.</span>
            <span aria-hidden="true" className="text-[#B89A62] text-[10px] font-semibold uppercase tracking-[0.16em]">Now</span>
            <span aria-hidden="true" className="inline-flex items-center gap-1.5">
              <MoonVisual phaseAngle={liveMoon.phase.phaseAngle} fraction={liveMoon.phase.fraction} hemisphere={hemisphere} size={20} />
              <span className="text-[#F3EDDF]">{liveMoon.phase.name}</span>
              <span className="font-semibold text-[#B89A62]">{Math.round(liveMoon.phase.fraction * 100)}%</span>
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-[#B89A62]/45" />
            <span aria-hidden="true" className="inline-flex items-center gap-1.5">
              <span className="text-[#B89A62]">{liveMoon.sign.symbol}</span>
              <span>{liveMoon.sign.name} {liveMoon.degrees}°{liveMoon.minutes}'</span>
            </span>
          </div>
        </div>

        <div className="flex items-end border-t border-[#B89A62]/25">
          <nav aria-label="Calendar views" className="flex min-w-0 flex-1 sm:flex-none">
            {views.map(({ mode, label, shortLabel, icon: Icon }) => (
              <button key={mode} id={`view-${mode}-btn`} aria-pressed={viewMode === mode} onClick={() => onViewModeChange(mode)}
                className={`relative flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-t-md border-x border-t px-1 text-[11px] font-medium transition sm:flex-none sm:gap-1.5 sm:px-4 sm:text-sm ${viewMode === mode ? 'translate-y-px border-[#B89A62]/45 bg-[#F3EDDF] text-[#182421] shadow-[inset_0_2px_0_#B89A62]' : 'border-transparent text-[#D8D0BF] hover:bg-white/5 hover:text-[#F3EDDF]'}`}>
                <Icon size={16} className={viewMode === mode ? 'text-[#86662E]' : 'text-[#B89A62]'} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
              </button>
            ))}
          </nav>

          <details ref={learnMenuRef} className="relative group border-l border-[#B89A62]/25"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.removeAttribute('open');
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}>
            <summary className="list-none [&::-webkit-details-marker]:hidden min-h-12 flex items-center gap-1 px-2 sm:gap-1.5 sm:px-4 text-[11px] sm:text-sm text-[#D8D0BF] cursor-pointer rounded-t-md hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#B89A62]">
              <BookOpen size={15} className="hidden text-[#B89A62] sm:inline-block" /><span>Learn</span><ChevronDown size={12} className="group-open:rotate-180 transition" />
            </summary>
            <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-1.5 rounded-lg border border-[#D8D0BF] bg-[#FAF7F0] text-[#182421] shadow-xl">
              <button id="desktop-info-btn" onClick={(event) => openLearnItem(event, onOpenInfoModal)}
                className="flex w-full min-h-12 items-center gap-3 rounded-md p-3 text-left text-sm hover:bg-[#EAE2D0]">
                <Sparkles size={18} className="text-[#B89A62]" /><span>Zodiac guide</span>
              </button>
              <button id="desktop-methodology-btn" onClick={(event) => openLearnItem(event, onOpenMethodologyModal)}
                className="flex w-full min-h-12 items-center gap-3 rounded-md p-3 text-left text-sm hover:bg-[#EAE2D0]">
                <ShieldCheck size={18} className="text-[#5F6D61]" /><span>How we calculate</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
};
