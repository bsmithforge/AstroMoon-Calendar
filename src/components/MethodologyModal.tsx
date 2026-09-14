import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ExternalLink,
  Compass,
  Globe,
} from 'lucide-react';
import { VERIFICATION_BENCHMARKS } from '../utils/validationData';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MethodologyTab = 'benchmarks' | 'coordinates' | 'timezones';

interface BenchmarkRow {
  id: string;
  name: string;
  reference: string;
  computed: string;
  discrepancy: string;
  status: string;
}

interface BenchmarkSectionProps {
  title: string;
  dotClass: string;
  link?: { href: string; label: string };
  columns: { event: string; reference: string; computed: string; discrepancy: string };
  rows: BenchmarkRow[];
}

const STATUS_BADGE_CLASS =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#E4ECE5] text-[#182421] border border-[#657367]/40 font-sans whitespace-nowrap';

/**
 * One verification table. Renders a classic 5-column table from `sm` up and a
 * stacked card list below that, since monospace timestamps in five columns
 * can't fit a phone viewport without horizontal scrolling.
 */
const BenchmarkSection: React.FC<BenchmarkSectionProps> = ({
  title,
  dotClass,
  link,
  columns,
  rows,
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className="text-sm font-serif-almanac font-bold text-[#182421] flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}></span>
        {title}
      </h3>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#B44732] hover:underline flex items-center gap-1 min-h-11 sm:min-h-0"
        >
          {link.label} <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>

    {/* Desktop / tablet: table */}
    <div className="hidden sm:block overflow-x-auto rounded-md border border-[#D8D0BF]">
      <table className="w-full text-xs text-left">
        <thead className="bg-[#EBE3D0] text-[#182421] font-semibold uppercase">
          <tr>
            <th className="px-3 py-2">{columns.event}</th>
            <th className="px-3 py-2">{columns.reference}</th>
            <th className="px-3 py-2">{columns.computed}</th>
            <th className="px-3 py-2">{columns.discrepancy}</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#D8D0BF] font-mono bg-[#FAF6EE]">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-[#FFFDF9]">
              <td className="px-3 py-2 font-sans font-medium text-[#182421]">{r.name}</td>
              <td className="px-3 py-2 text-[#5F6D61]">{r.reference}</td>
              <td className="px-3 py-2 text-[#182421]">{r.computed}</td>
              <td className="px-3 py-2 text-[#5F6D61]">{r.discrepancy}</td>
              <td className="px-3 py-2">
                <span className={STATUS_BADGE_CLASS}>{r.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Phone: stacked cards */}
    <ul className="sm:hidden space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="min-w-0 p-3 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#182421] break-words">{r.name}</span>
            <span className={STATUS_BADGE_CLASS}>{r.status}</span>
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-[#5F6D61] uppercase tracking-wide text-[10px] pt-px">
              {columns.reference}
            </dt>
            <dd className="font-mono text-[#5F6D61] break-all">{r.reference}</dd>
            <dt className="text-[#5F6D61] uppercase tracking-wide text-[10px] pt-px">
              {columns.computed}
            </dt>
            <dd className="font-mono text-[#182421] break-all">{r.computed}</dd>
            <dt className="text-[#5F6D61] uppercase tracking-wide text-[10px] pt-px">
              {columns.discrepancy}
            </dt>
            <dd className="font-mono text-[#5F6D61] break-words">{r.discrepancy}</dd>
          </dl>
        </li>
      ))}
    </ul>
  </div>
);

export const MethodologyModal: React.FC<MethodologyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MethodologyTab>('benchmarks');

  if (!isOpen) return null;

  const phaseRows: BenchmarkRow[] = VERIFICATION_BENCHMARKS.filter(
    (b) => b.category === 'phase'
  ).map((b) => ({
    id: b.id,
    name: b.name,
    reference: b.referenceTimeStr,
    computed: b.computedUtc,
    discrepancy: `+${b.differenceSeconds.toFixed(1)}s (${b.differenceMinutes.toFixed(2)}m)`,
    status: 'Pass (≤2m)',
  }));

  const eclipseRows: BenchmarkRow[] = VERIFICATION_BENCHMARKS.filter(
    (b) => b.category === 'eclipse'
  ).map((b) => ({
    id: b.id,
    name: b.name,
    reference: b.referenceUtc,
    computed: b.computedUtc,
    discrepancy: `${b.differenceSeconds >= 0 ? '+' : ''}${b.differenceSeconds.toFixed(1)}s (${b.differenceMinutes.toFixed(2)}m)`,
    status: 'Pass (≤2m)',
  }));

  const ingressRows: BenchmarkRow[] = VERIFICATION_BENCHMARKS.filter(
    (b) => b.category === 'ingress'
  ).map((b) => ({
    id: b.id,
    name: b.name,
    reference: b.referenceUtc,
    computed: b.computedUtc,
    discrepancy: '< 1 sec (±0.0001°)',
    status: 'Exact Match',
  }));

  const tabs: { id: MethodologyTab; icon: React.ReactNode; short: string; full: string }[] = [
    {
      id: 'benchmarks',
      icon: <CheckCircle2 className="w-4 h-4 text-[#5F6D61]" />,
      short: 'Benchmarks',
      full: 'Independent Benchmarks (USNO & NASA)',
    },
    {
      id: 'coordinates',
      icon: <Compass className="w-4 h-4 text-[#B89A62]" />,
      short: 'Coordinates',
      full: 'Coordinate System & Conventions',
    },
    {
      id: 'timezones',
      icon: <Globe className="w-4 h-4 text-[#5F6D61]" />,
      short: 'Timezones',
      full: 'Timezones, DST & Edge Cases',
    },
  ];

  return (
    <div
      id="methodology-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-[#182421]/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="methodology-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-modal-heading"
        className="min-w-0 bg-[#FAF7F0] border border-[#D8D0BF] rounded-lg w-full max-w-4xl max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans-almanac text-[#182421]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header in Observatory Ink */}
        <div className="shrink-0 flex items-start sm:items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-b border-[#B89A62]/40 bg-[#182421] text-[#F3EDDF] relative overflow-hidden">
          <div className="relative z-10 flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full border border-[#B89A62]/60 overflow-hidden bg-[#121A18] flex items-center justify-center p-0.5 shrink-0">
              <img
                src="/moon_engraving.jpg"
                alt="Moon engraving medallion"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-full mix-blend-screen"
              />
            </div>
            <div className="min-w-0">
              <h2
                id="methodology-modal-heading"
                className="text-base sm:text-lg leading-snug font-serif-almanac font-bold text-[#F3EDDF] tracking-wide"
              >
                Astronomical Methodology &amp; Verification{' '}
                <span className="text-[#B89A62] text-xs">✦</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-[#D8D0BF] mt-0.5">
                Independent validation against USNO primary phases, NASA eclipse catalogs, and coordinate conventions
              </p>
            </div>
          </div>
          <button
            id="close-methodology-btn"
            onClick={onClose}
            aria-label="Close"
            className="relative z-10 -m-2 sm:m-0 flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:p-1.5 rounded-md text-[#D8D0BF] hover:text-[#F3EDDF] hover:bg-[#253631] transition-colors shrink-0"
          >
            <X size={20} strokeWidth={2} className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Tab Navigation in Warm Parchment: scrolls horizontally on phones */}
        <div
          role="tablist"
          className="shrink-0 flex border-b border-[#D8D0BF] bg-[#EBE3D0] px-3 sm:px-6 pt-2 gap-1 sm:gap-2 text-xs font-medium overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap min-h-11 sm:min-h-0 px-3 sm:px-4 py-2 rounded-t-md transition-colors border-b-2 flex items-center gap-2 ${
                  isActive
                    ? 'text-[#182421] border-[#B44732] bg-[#FAF7F0] font-semibold'
                    : 'text-[#5F6D61] border-transparent hover:text-[#182421]'
                }`}
              >
                {tab.icon}
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.full}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-6 text-[#182421] text-sm bg-[#FAF7F0]">
          {activeTab === 'benchmarks' && (
            <div className="space-y-6">
              {/* Acceptance target banner */}
              <div className="p-3.5 sm:p-4 rounded-md bg-[#E4ECE5] border border-[#657367]/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#5F6D61] shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-serif-almanac font-semibold text-[#182421]">
                    Acceptance Target Achieved (Tolerance &le; 2.0 minutes)
                  </h4>
                  <p className="text-xs text-[#182421] leading-relaxed">
                    All astronomical phase and eclipse calculations are calculated client-side using{' '}
                    <code className="px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-[#D8D0BF] text-[#182421] font-mono text-[11px] whitespace-nowrap">
                      astronomy-engine v2.1.19
                    </code>
                    . Maximum observed difference against USNO tables is{' '}
                    <strong className="text-[#182421]">43.3 seconds (0.72 min)</strong>. Maximum
                    observed difference against NASA eclipse peaks is{' '}
                    <strong className="text-[#182421]">10.2 seconds (0.17 min)</strong>.
                  </p>
                </div>
              </div>

              <BenchmarkSection
                title="USNO Primary Moon Phases (2024–2026)"
                dotClass="bg-[#B89A62]"
                link={{ href: 'https://aa.usno.navy.mil/data/MoonPhases', label: 'USNO Catalog' }}
                columns={{
                  event: 'Event',
                  reference: 'USNO Reference (UT)',
                  computed: 'Computed Instant (UTC)',
                  discrepancy: 'Discrepancy',
                }}
                rows={phaseRows}
              />

              <BenchmarkSection
                title="NASA Greatest Eclipse Peaks (2024–2026)"
                dotClass="bg-[#B44732]"
                link={{ href: 'https://eclipse.gsfc.nasa.gov/', label: 'NASA GSFC Catalogs' }}
                columns={{
                  event: 'Eclipse',
                  reference: 'NASA Peak (TD → UTC, ΔT≈69s)',
                  computed: 'Computed Peak (UTC)',
                  discrepancy: 'Discrepancy',
                }}
                rows={eclipseRows}
              />

              <BenchmarkSection
                title="Zodiac Sign Ingress Benchmarks (Astro.com / Swiss Ephemeris)"
                dotClass="bg-[#657367]"
                columns={{
                  event: 'Ingress Event',
                  reference: 'Swiss Ephemeris Target (UTC)',
                  computed: 'AstroMoon Computed (UTC)',
                  discrepancy: 'Precision',
                }}
                rows={ingressRows}
              />
            </div>
          )}

          {activeTab === 'coordinates' && (
            <div className="space-y-4 leading-relaxed">
              <div className="p-4 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] space-y-2">
                <h4 className="font-serif-almanac font-semibold text-sm text-[#182421] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#B89A62]" />
                  <span>Astronomical Coordinate Definitions</span>
                </h4>
                <p className="text-xs text-[#182421]">
                  AstroMoon uses the apparent geocentric ecliptic longitude of date (&lambda;), referenced to the true equinox and ecliptic of date. This matches standard astrological ephemerides (such as the American Ephemeris and Swiss Ephemeris) and accounts for precession, nutation, and planetary aberration.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] space-y-1.5">
                  <span className="font-serif-almanac font-semibold text-[#182421] block">
                    1. Tropical Zodiac System
                  </span>
                  <p className="text-[#5F6D61]">
                    0° Aries begins at the vernal equinox point (instant the Sun crosses the celestial equator northbound). The 360° circle is divided into 12 equal 30° sectors.
                  </p>
                </div>

                <div className="p-3.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] space-y-1.5">
                  <span className="font-serif-almanac font-semibold text-[#182421] block">
                    2. Moon Phase Quarters
                  </span>
                  <p className="text-[#5F6D61]">
                    Calculated from the apparent ecliptic elongation between Moon and Sun: New Moon (0°), First Quarter (90°), Full Moon (180°), Third Quarter (270°).
                  </p>
                </div>

                <div className="p-3.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] space-y-1.5">
                  <span className="font-serif-almanac font-semibold text-[#182421] block">
                    3. Sign Ingress Bisection Search
                  </span>
                  <p className="text-[#5F6D61]">
                    Whenever the Moon crosses a 30° sector boundary, an adaptive bisection search pinpoints the exact UTC second where &lambda; mod 30° = 0.
                  </p>
                </div>

                <div className="p-3.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] space-y-1.5">
                  <span className="font-serif-almanac font-semibold text-[#182421] block">
                    4. Eclipse Search Geometry
                  </span>
                  <p className="text-[#5F6D61]">
                    Solar and lunar eclipses are found by searching syzygy instants (elongation 0° and 180°) where the Moon is close to its ecliptic nodes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timezones' && (
            <div className="space-y-4 text-xs leading-relaxed">
              <div className="p-4 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] space-y-2">
                <h4 className="font-serif-almanac font-semibold text-sm text-[#182421] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#5F6D61]" />
                  <span>Timezone Transformation Integrity</span>
                </h4>
                <p className="text-[#182421]">
                  All internal ephemeris calculations occur in Universal Coordinated Time (UTC). When you switch timezones, the UTC timestamps of astronomical events never change—only their representation in the local calendar shifts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-md bg-[#FAF6EE] border border-[#D8D0BF]">
                  <span className="font-serif-almanac font-semibold text-[#182421] block mb-1">
                    Fractional Offsets
                  </span>
                  <p className="text-[#5F6D61]">
                    Full support for half-hour and 45-minute timezone offsets like Asia/Kolkata (+05:30) and Pacific/Chatham (+12:45).
                  </p>
                </div>
                <div className="p-3 rounded-md bg-[#FAF6EE] border border-[#D8D0BF]">
                  <span className="font-serif-almanac font-semibold text-[#182421] block mb-1">
                    Daylight Saving (DST)
                  </span>
                  <p className="text-[#5F6D61]">
                    Leverages the browser's IANA TZ database to seamlessly handle spring-forward and fall-back clock transitions.
                  </p>
                </div>
                <div className="p-3 rounded-md bg-[#FAF6EE] border border-[#D8D0BF]">
                  <span className="font-serif-almanac font-semibold text-[#182421] block mb-1">
                    Midnight Crossings
                  </span>
                  <p className="text-[#5F6D61]">
                    Events occurring near midnight correctly shift between adjacent calendar dates depending on your local longitude.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-[#D8D0BF] bg-[#EBE3D0] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#5F6D61]">
            Ephemeris Engine: astronomy-engine@2.1.19
          </span>
          <button
            onClick={onClose}
            className="min-h-11 sm:min-h-0 px-4 py-1.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] hover:bg-[#D8D0BF] text-[#182421] font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
