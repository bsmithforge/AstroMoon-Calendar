import React, { useState } from 'react';
import {
  HelpCircle,
  Compass,
  Globe2,
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
    question: 'What does the Moon sign on each day tell me?',
    shortAnswer: 'It shows the Moon’s tropical zodiac sign at noon in your selected timezone.',
    details:
      'The daily sign and phase are calculated for 12:00 noon on that date. The Moon can change signs during the day; an ingress marks the time it enters the next sign. Select a date to see its noon position, timed events, and traditional interpretations. Those interpretations are astrological traditions, not scientific predictions.',
    icon: <Sparkles className="w-4 h-4 text-[#B89A62]" />,
  },
  {
    id: 'zodiac-conventions',
    question: 'Which zodiac does this calendar use?',
    shortAnswer: 'The tropical zodiac: twelve equal 30° signs, starting with Aries at the March equinox.',
    details:
      'Moon positions are calculated from Earth’s center using astronomy-engine. The calendar maps those positions to tropical signs rather than constellation boundaries. Daily phase illustrations show the noon snapshot; New Moon, First Quarter, Full Moon, and Third Quarter events have their own calculated times. Open Methodology & Verification in the Learn menu for calculation details.',
    icon: <BookOpen className="w-4 h-4 text-[#657367]" />,
  },
  {
    id: 'timezone-effects',
    question: 'Why can an event appear on a different date?',
    shortAnswer: 'The same event can fall on different calendar days in different timezones.',
    details:
      'Choose your timezone under Your sky to display events on the dates and at the times used by your local clock, including daylight saving changes. Changing the timezone also recalculates each daily snapshot for noon in that zone. Eclipse entries mark global peak times; an entry does not mean the eclipse is visible from your location.',
    icon: <Globe2 className="w-4 h-4 text-[#657367]" />,
  },
  {
    id: 'export-guide',
    question: 'How do I save or print my calendar?',
    shortAnswer: 'Open Export to subscribe to a live calendar feed, download an ICS file, or print a PDF.',
    details:
      'Subscribing adds an auto-updating calendar with no download: tap the Apple/Outlook button to open your calendar app’s subscribe dialog, use the Google Calendar or Outlook.com links, or copy the feed URL into any app that supports calendar subscriptions. Importing a downloaded ICS file instead gives a one-time copy that will not update. For printing, choose a calendar PDF with one whole month per A4 page (up to 24 months), or a data table for your exact date range. Calendar PDFs include every month touched by your range. Export settings apply to the download, so you can adjust them without changing the calendar on screen.',
    icon: <Download className="w-4 h-4 text-[#B44732]" />,
  },
  {
    id: 'hemisphere-toggle',
    question: 'What does the hemisphere setting change?',
    shortAnswer: 'It flips the Moon illustrations to show the orientation convention for your hemisphere.',
    details:
      'Choose Northern or Southern under Your sky. Waxing Moons are drawn with the lit side on the right for the Northern Hemisphere and on the left for the Southern Hemisphere. This setting changes the presentation; event times, zodiac positions, and illumination percentages stay the same. The Moon’s actual tilt in the sky also depends on your location and the time you observe it.',
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
            <span>Frequently asked questions</span>
          </h2>
          <p className="text-xs text-[#657367] mt-0.5 font-sans-almanac">
            Reading the calendar, choosing your settings, and saving your dates.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
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
                  <p className="max-w-prose">{item.details}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Prerendered calculation reference disclosure */}
      <div className="mt-4 pt-3 border-t border-[#D8D0BF] text-[11px] text-[#657367] flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>Calculation Engine:</strong> <code>astronomy-engine@2.1.19</code>
        </span>
        <span>
          <strong>Coordinate Frame:</strong> Geocentric true equinox of date (Tropical Zodiac)
        </span>
      </div>
    </section>
  );
};
