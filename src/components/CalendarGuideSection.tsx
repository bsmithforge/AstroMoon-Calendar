import React, { useState } from 'react';
import {
  HelpCircle,
  Compass,
  Globe2,
  Calendar as CalendarIcon,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';

interface GuideItem {
  id: string;
  question: string;
  shortAnswer: string;
  details: string;
  icon: React.ReactNode;
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'moon-sign',
    question: 'What does a Moon sign mean in this calendar?',
    shortAnswer: 'The tropical zodiac sector (0°–360°) occupied by the Moon at a given time.',
    details:
      'In astronomical calculations, the Moon orbits the Earth and completes a 360° circuit around the celestial sphere approximately every 27.3 days (a sidereal month). In this calendar, each of the 12 tropical zodiac signs represents a 30° ecliptic sector starting from the vernal equinox. The Moon spends roughly 2.25 to 2.5 days in each sign, traditionally associated with emotional climates, instinctive rhythms, and environmental focus. We indicate both the daily noon Moon sign and the exact moments when the Moon crosses into a new sign.',
    icon: <Sparkles className="w-4 h-4 text-[#B89A62]" />,
  },
  {
    id: 'zodiac-conventions',
    question: 'Which zodiac and calculation conventions are used?',
    shortAnswer: 'Tropical zodiac referenced to the true equinox of date, calculated with astronomy-engine 2.1.19.',
    details:
      'Positions are calculated as apparent geocentric ecliptic longitude (λ, 0° to 360°) referenced to the true equinox of date, accounting for precession, nutation, and light-time aberrations using high-precision VSOP87 planetary theory and ELP2000-82 lunar theory. The 0° point is the vernal equinox (0° Aries). Zodiac sign boundaries occur at exact 30° multiples (0° Aries, 30° Taurus, 60° Gemini, etc.), refined using numerical bisection search to an accuracy of 1 second or better. Major lunar quarters are computed from instantaneous solar-lunar elongation (0° New Moon, 90° First Quarter, 180° Full Moon, 270° Third Quarter).',
    icon: <BookOpen className="w-4 h-4 text-[#657367]" />,
  },
  {
    id: 'timezone-effects',
    question: 'How does timezone selection affect dates?',
    shortAnswer: 'Astronomical events occur at an absolute UTC instant; your selected timezone assigns them to your local solar date.',
    details:
      'Celestial alignments (such as an exact Full Moon peak or an ingress into Taurus) happen at a single universal instant worldwide (UTC). Selecting your observer timezone translates that universal instant into your local clock time and calendar day. For example, an astronomical Full Moon occurring at 02:30 UTC on September 15 falls on the evening of September 14 in North American timezones (UTC-4 to UTC-7) and on the morning of September 15 in Europe and Asia. Choosing your local timezone ensures dates match your local calendar.',
    icon: <Globe2 className="w-4 h-4 text-[#657367]" />,
  },
  {
    id: 'export-guide',
    question: 'How to import the ICS and download the PDF?',
    shortAnswer: 'Click "Export (.ics / PDF)" to download an RFC 5545 calendar file or a print-ready calendar or data-table PDF.',
    details:
      'Click the "Export (.ics / PDF)" button in the control header or at the bottom of the page. Choose your desired date range (current month, 3-month season, full year, or custom range) and select which event types to include. The ".ics" option produces a standard RFC 5545 iCalendar payload with descriptive VEVENT entries that you can import into Apple Calendar, Google Calendar, Microsoft Outlook, or any standard calendar app. The "PDF" option offers a desktop-layout calendar with one whole month per A4 page (up to 24 months), or a data table for your exact date range. Calendar PDFs keep the full layout even when downloaded from a phone.',
    icon: <Download className="w-4 h-4 text-[#B44732]" />,
  },
  {
    id: 'hemisphere-toggle',
    question: 'What does the hemisphere toggle change?',
    shortAnswer: 'It updates the visual illumination orientation (waxing right vs. waxing left) to match your local sky.',
    details:
      'The Moon\'s physical phase angle and percentage of illumination are identical anywhere on Earth at a given moment. However, observers in the Northern Hemisphere look southward to view the Moon, seeing a waxing crescent lit on the right side and a waning crescent on the left. Observers in the Southern Hemisphere look northward, which inverts the apparent perspective: a waxing crescent is lit on the left side and waning on the right. Toggling between Northern and Southern hemisphere updates the visual rendering of every lunar icon to reflect your local viewpoint.',
    icon: <Compass className="w-4 h-4 text-[#B89A62]" />,
  },
];

export const CalendarGuideSection: React.FC = () => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'moon-sign': true, // Keep first open by default
  });

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section
      id="calendar-guide"
      aria-labelledby="guide-heading"
      className="mt-8 bg-[#FAF7F0] border border-[#D8D0BF] rounded-lg p-4 sm:p-6 shadow-xs text-[#182421]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D8D0BF] pb-3 mb-4">
        <div>
          <h2
            id="guide-heading"
            className="text-lg sm:text-xl font-serif-almanac font-bold tracking-tight text-[#182421] flex items-center gap-2"
          >
            <HelpCircle className="w-5 h-5 text-[#B89A62]" />
            <span>A guide to your lunar calendar</span>
          </h2>
          <p className="text-xs text-[#657367] mt-0.5 font-sans-almanac">
            Essential guide to astronomical calculations, Moon sign definitions, and calendar exports.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
        {GUIDE_ITEMS.map((item) => {
          const isOpen = !!openItems[item.id];
          return (
            <article
              key={item.id}
              className="bg-[#FAF6EE] border border-[#D8D0BF] rounded-md overflow-hidden transition-all duration-150"
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                aria-expanded={isOpen}
                aria-controls={`guide-content-${item.id}`}
                className="w-full text-left p-3 sm:p-3.5 flex items-start justify-between gap-2.5 hover:bg-[#F2ECE0] transition"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 p-1 rounded bg-[#F0E9DA] border border-[#D8D0BF] shrink-0">
                    {item.icon}
                  </span>
                  <div className="min-w-0 break-words">
                    <h3 className="font-serif-almanac font-bold text-base leading-snug text-[#182421]">
                      {item.question}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#657367] mt-1">
                      {item.shortAnswer}
                    </p>
                  </div>
                </div>
                <span className="text-[#657367] p-1 shrink-0">
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              {isOpen && (
                <div
                  id={`guide-content-${item.id}`}
                  className="px-3 sm:px-3.5 pb-3.5 pt-1 text-sm leading-relaxed break-words text-[#182421]/90 border-t border-[#D8D0BF]/60 bg-[#FAF7F0]/60"
                >
                  <p>{item.details}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Prerendered calculation reference disclosure */}
      <div className="mt-4 pt-3 border-t border-[#D8D0BF] text-[11px] text-[#657367] flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>Calculation Engine:</strong> <code>astronomy-engine@2.1.19</code> (VSOP87 planetary theory / ELP2000-82 lunar theory)
        </span>
        <span>
          <strong>Coordinate Frame:</strong> Geocentric true equinox of date (Tropical Zodiac)
        </span>
      </div>
    </section>
  );
};
