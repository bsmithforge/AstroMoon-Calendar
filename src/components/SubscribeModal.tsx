import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  Copy,
  ExternalLink,
  Info,
  Rss,
  X,
} from 'lucide-react';
import { FilterSettings } from '../types';
import {
  SUBSCRIPTION_MONTHS_AHEAD,
  SUBSCRIPTION_MONTHS_BACK,
  buildAddToCalendarLinks,
  buildSubscriptionUrl,
  toWebcalUrl,
} from '../utils/subscription';

interface SubscribeModalProps {
  isOpen: boolean;
  filters: FilterSettings;
  onClose: () => void;
}

export const SubscribeModal: React.FC<SubscribeModalProps> = (props) =>
  props.isOpen ? <SubscribeModalContent {...props} /> : null;

// Mount a fresh form on each open so it starts from the current calendar settings.
const SubscribeModalContent: React.FC<SubscribeModalProps> = ({
  filters,
  onClose,
}) => {
  const [includeMajorPhases, setIncludeMajorPhases] = useState(filters.showFullNewMoon);
  const [includeIngresses, setIncludeIngresses] = useState(filters.showIngresses);
  const [includeDailySigns, setIncludeDailySigns] = useState(filters.showDailySigns);
  const [includeEclipses, setIncludeEclipses] = useState(filters.showEclipses);
  const [copiedFeedUrl, setCopiedFeedUrl] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href]'
      ) || []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const anyEventEnabled = includeMajorPhases || includeIngresses || includeDailySigns || includeEclipses;
  const feedUrl = useMemo(
    () =>
      buildSubscriptionUrl(window.location.origin, {
        timezone: filters.timezone,
        hemisphere: filters.hemisphere,
        showFullNewMoon: includeMajorPhases,
        showIngresses: includeIngresses,
        showDailySigns: includeDailySigns,
        showEclipses: includeEclipses,
      }),
    [
      filters.timezone,
      filters.hemisphere,
      includeMajorPhases,
      includeIngresses,
      includeDailySigns,
      includeEclipses,
    ]
  );
  const webcalUrl = toWebcalUrl(feedUrl);
  const addLinks = buildAddToCalendarLinks(feedUrl);

  const handleCopyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopiedFeedUrl(true);
      window.setTimeout(() => setCopiedFeedUrl(false), 2500);
    } catch {
      window.prompt('Copy this subscription URL:', feedUrl);
    }
  };

  return (
    <div
      id="subscribe-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#182421]/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="subscribe-modal-card"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscribe-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-lg border border-[#D8D0BF] bg-[#FAF7F0] text-[#182421] shadow-2xl font-sans-almanac animate-fade-in"
      >
        <div className="relative flex shrink-0 items-start justify-between overflow-hidden border-b border-[#B89A62]/40 bg-[#182421] p-4 text-[#F3EDDF] sm:p-6">
          <div className="relative z-10 flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#B89A62]/60 bg-[#121A18]">
              <Rss size={19} className="text-[#B89A62]" />
            </div>
            <div className="min-w-0">
              <h3 id="subscribe-modal-title" className="font-serif-almanac text-xl font-bold tracking-tight text-[#F3EDDF]">
                Subscribe to AstroMoon
              </h3>
              <p className="mt-0.5 text-xs text-[#D8D0BF]">
                Add a live calendar that refreshes automatically
              </p>
            </div>
          </div>
          <button
            id="close-subscribe-modal-btn"
            aria-label="Close subscription dialog"
            onClick={onClose}
            className="relative z-10 min-h-11 min-w-11 shrink-0 rounded-md p-1.5 text-[#D8D0BF] transition hover:bg-[#253631] hover:text-[#F3EDDF]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="space-y-5">
            <div className="flex min-w-0 items-start gap-2.5 rounded-md border border-[#D8D0BF] bg-[#EBE3D0] p-3.5 text-xs">
              <Info size={16} className="mt-0.5 text-[#B89A62]" />
              <p className="min-w-0 leading-relaxed">
                This is not a one-time download. Your calendar app chooses when to refresh the feed, which always covers {SUBSCRIPTION_MONTHS_BACK} month back through {SUBSCRIPTION_MONTHS_AHEAD} months ahead.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-serif-almanac text-xs font-semibold uppercase tracking-wider">
                Events in your live calendar
              </p>
              <div className="grid min-w-0 grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-2.5 hover:border-[#182421]">
                  <input
                    type="checkbox"
                    checked={includeMajorPhases}
                    onChange={(event) => setIncludeMajorPhases(event.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#D8D0BF] bg-white text-[#B44732] focus:ring-0"
                  />
                  <span className="min-w-0">Exact Moon Phases (New, Full, Quarters)</span>
                </label>
                <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-2.5 hover:border-[#182421]">
                  <input
                    type="checkbox"
                    checked={includeIngresses}
                    onChange={(event) => setIncludeIngresses(event.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#D8D0BF] bg-white text-[#657367] focus:ring-0"
                  />
                  <span className="min-w-0">Zodiac Ingress Transitions</span>
                </label>
                <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-2.5 hover:border-[#182421]">
                  <input
                    type="checkbox"
                    checked={includeDailySigns}
                    onChange={(event) => setIncludeDailySigns(event.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#D8D0BF] bg-white text-[#182421] focus:ring-0"
                  />
                  <span className="min-w-0">Daily Noon Sign Snapshot</span>
                </label>
                <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-2.5 hover:border-[#182421]">
                  <input
                    type="checkbox"
                    checked={includeEclipses}
                    onChange={(event) => setIncludeEclipses(event.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#D8D0BF] bg-white text-[#B44732] focus:ring-0"
                  />
                  <span className="min-w-0">Global Solar &amp; Lunar Eclipses</span>
                </label>
              </div>
            </div>

            <div className="rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-3 text-xs leading-relaxed text-[#657367]">
              <p className="break-words"><span className="font-semibold text-[#182421]">Timezone:</span> {filters.timezone}</p>
              <p className="mt-1"><span className="font-semibold text-[#182421]">Moon orientation:</span> {filters.hemisphere} hemisphere</p>
              <p className="mt-2 text-[11px]">To change these, close this dialog and use <strong>Your sky</strong>.</p>
            </div>

            {!anyEventEnabled ? (
              <p role="alert" className="rounded-md border border-[#B44732]/40 p-3 text-sm text-[#B44732]">
                Check at least one event type to build a subscription.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid min-w-0 grid-cols-1 gap-2 text-xs min-[430px]:grid-cols-3 [&>a]:min-h-11 [&>a]:min-w-0">
                  <a
                    id="subscribe-webcal-link"
                    href={webcalUrl}
                    className="flex items-center justify-center gap-1.5 rounded-md bg-[#182421] px-3 py-2 text-center font-semibold text-[#F3EDDF] transition hover:bg-[#253631]"
                  >
                    <CalendarIcon size={14} />
                    Apple / Outlook app
                  </a>
                  <a
                    id="subscribe-google-link"
                    href={addLinks.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-3 py-2 text-center font-medium text-[#182421] transition hover:bg-[#EAE2D0]"
                  >
                    <ExternalLink size={14} />
                    Google Calendar
                  </a>
                  <a
                    id="subscribe-outlook-link"
                    href={addLinks.outlook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-3 py-2 text-center font-medium text-[#182421] transition hover:bg-[#EAE2D0]"
                  >
                    <ExternalLink size={14} />
                    Outlook.com
                  </a>
                </div>

                <div className="flex min-w-0 flex-col gap-2 min-[430px]:flex-row">
                  <label htmlFor="subscribe-feed-url" className="sr-only">Subscription URL</label>
                  <input
                    id="subscribe-feed-url"
                    type="text"
                    readOnly
                    value={feedUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-h-11 w-full min-w-0 flex-1 rounded-md border border-[#D8D0BF] bg-[#FFFDF9] px-3 py-2 font-mono text-base text-[#182421] focus:border-[#182421] focus:outline-none min-[430px]:text-xs"
                  />
                  <button
                    type="button"
                    id="subscribe-copy-url-btn"
                    onClick={handleCopyFeedUrl}
                    className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-3 py-2 text-xs font-medium text-[#182421] transition hover:bg-[#EAE2D0]"
                  >
                    {copiedFeedUrl ? <Check size={14} className="text-[#657367]" /> : <Copy size={14} />}
                    {copiedFeedUrl ? 'Copied' : 'Copy URL'}
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-[#657367]">
                  Copy the URL for Fastmail, Proton, Thunderbird, Outlook desktop, or another app that supports calendar subscriptions. Google Calendar and Outlook.com open in a new tab.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#D8D0BF] bg-[#EBE3D0] p-4 text-xs">
          <span className="min-w-0 text-[#657367]">Live feed · no date range needed</span>
          <button
            onClick={onClose}
            className="min-h-11 shrink-0 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-4 py-1.5 font-medium text-[#182421] transition hover:bg-[#D8D0BF]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
