import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, ChevronDown, Download, Feather, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { Hemisphere } from '../types';
import { EventView } from '../utils/almanacResults';
import { countMonthsSpanned } from '../utils/dateRange';
import { describeExportEvents, describeExportRange, EXPORT_FORMAT_LABELS, ExportDraft } from '../utils/exportDraft';
import {
  ASK_QUESTION_MAX_LENGTH,
  AskOutcome,
  AskResult,
  askTheAlmanac,
  describeEventTime,
  describeEventTitle,
  describeRetryAfter,
} from '../utils/askClient';

/** The last question and its outcome, kept by App so reopening the dialog shows it. */
export interface AskExchange {
  question: string;
  outcome: AskOutcome;
}

interface AskModalProps {
  isOpen: boolean;
  timezone: string;
  hemisphere: Hemisphere;
  lastExchange: AskExchange | null;
  onExchange: (exchange: AskExchange) => void;
  onOpenEvent: (event: EventView) => void;
  onReviewExport: (draft: ExportDraft) => void;
  /** Opens a calendar date from theme search. */
  onOpenDate: (dateString: string) => void;
  onClose: () => void;
}

// Theme search is its own chunk. It is loaded by hand rather than with
// React.lazy, whose failed import (offline, or after a deploy renames chunks)
// would unmount the whole app without an error boundary.
type ThemePanelComponent = typeof import('./ThemeSearchPanel').default;
const loadThemePanel = () => import('./ThemeSearchPanel').then((module) => module.default);

type AskTab = 'ask' | 'themes';

const EXAMPLE_QUESTIONS = [
  'When is the next full moon?',
  'What sign is the Moon in today?',
  'What eclipses happen next year?',
  'Which full moons next year are in fire signs?',
  'What does a New Moon in Scorpio mean?',
  'Make me a printable calendar of next year’s full and new moons',
];

const TOOL_LABELS: Record<string, string> = {
  find_moon_phases: 'Searched Moon phases',
  find_sign_ingresses: 'Searched sign changes',
  find_eclipses: 'Searched eclipses',
  get_moon_on_date: 'Looked up the Moon on a date',
  get_traditional_meaning: 'Looked up traditional meanings',
  prepare_export: 'Prepared export settings',
};

export const AskModal: React.FC<AskModalProps> = (props) =>
  props.isOpen ? <AskModalContent {...props} /> : null;

// Mount fresh on each open so the dialog starts from the current timezone and hemisphere.
const AskModalContent: React.FC<AskModalProps> = ({
  timezone,
  hemisphere,
  lastExchange,
  onExchange,
  onOpenEvent,
  onReviewExport,
  onOpenDate,
  onClose,
}) => {
  const [tab, setTab] = useState<AskTab>('ask');
  const [ThemePanel, setThemePanel] = useState<ThemePanelComponent | 'failed' | null>(null);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [exchange, setExchange] = useState<AskExchange | null>(lastExchange);
  const visibleArea = useVisibleArea();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focusing the input on a phone opens the keyboard over the examples, so only do it with a mouse.
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
    else dialogRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), summary, a[href]'
      ) || []).filter((el) => el.tabIndex >= 0);
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
      requestRef.current?.abort();
      previousFocus?.focus();
    };
  }, []);

  // Fetch the theme search chunk when the dialog opens (it is small), so the tab
  // opens at once and still works if the connection drops afterwards.
  useEffect(() => {
    if (ThemePanel) return;
    let cancelled = false;
    loadThemePanel()
      .then((component) => { if (!cancelled) setThemePanel(() => component); })
      .catch(() => { if (!cancelled && tab === 'themes') setThemePanel('failed'); });
    return () => {
      cancelled = true;
    };
  }, [ThemePanel, tab]);

  // Grow the input with its text, up to its max height.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }, [question]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(trimmed);
    setQuestion('');
    try {
      const outcome = await askTheAlmanac({ question: trimmed, timezone, hemisphere }, controller.signal);
      const next = { question: trimmed, outcome };
      setExchange(next);
      onExchange(next);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      throw err;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(null);
      }
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(question);
    }
  };

  return (
    <div
      id="ask-modal-overlay"
      style={visibleArea ? { top: visibleArea.top, height: visibleArea.height, bottom: 'auto' } : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-[#182421]/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="ask-modal-card"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="flex h-full max-h-[min(44rem,100%)] w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-lg border border-[#D8D0BF] bg-[#FAF7F0] text-[#182421] shadow-2xl font-sans-almanac animate-fade-in sm:h-auto"
      >
        <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-[#B89A62]/40 bg-[#182421] px-4 py-3 text-[#F3EDDF] sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#B89A62]/60 bg-[#121A18]">
              <Feather size={19} className="text-[#B89A62]" />
            </div>
            <div className="min-w-0">
              <h3 id="ask-modal-title" className="font-serif-almanac text-xl font-bold tracking-tight text-[#F3EDDF]">
                Ask the Almanac
              </h3>
              <p className="mt-0.5 text-xs text-[#D8D0BF]">
                {tab === 'ask' ? 'AI answers, dated by the almanac' : 'Private theme search, on this device'}
              </p>
            </div>
          </div>
          <button
            id="close-ask-modal-btn"
            type="button"
            aria-label="Close Ask the Almanac"
            onClick={onClose}
            className="min-h-11 min-w-11 shrink-0 rounded-md p-1.5 text-[#D8D0BF] transition hover:bg-[#253631] hover:text-[#F3EDDF]"
          >
            <X size={20} className="mx-auto" />
          </button>
        </div>

        <div role="tablist" aria-label="Ask or search themes" className="grid shrink-0 grid-cols-2 border-b border-[#D8D0BF] bg-[#EBE3D0] text-sm">
          {([['ask', 'Ask'], ['themes', 'Theme search']] as const).map(([value, label]) => (
            <button
              key={value}
              id={`ask-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={`ask-panel-${value}`}
              onClick={() => setTab(value)}
              className={`min-h-11 px-3 font-medium transition ${
                tab === value
                  ? 'bg-[#FAF7F0] text-[#182421] shadow-[inset_0_-2px_0_#B89A62]'
                  : 'text-[#5F6D61] hover:bg-[#F3EDDF] hover:text-[#182421]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'themes' ? (
          <div id="ask-panel-themes" role="tabpanel" aria-labelledby="ask-tab-themes" className="flex min-h-0 flex-1 flex-col">
            {ThemePanel === 'failed' ? (
              <div className="flex-1 space-y-3 p-6 text-sm text-[#182421]">
                <p>Theme search couldn’t load. Check your connection.</p>
                <button type="button" onClick={() => setThemePanel(null)} className="min-h-11 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-3 font-medium hover:bg-[#EAE2D0]">
                  Try again
                </button>
              </div>
            ) : ThemePanel ? (
              <ThemePanel timezone={timezone} hemisphere={hemisphere} onOpenDate={onOpenDate} />
            ) : (
              <p className="flex-1 p-6 text-sm text-[#5F6D61]">Loading theme search…</p>
            )}
          </div>
        ) : (
        <div id="ask-panel-ask" role="tabpanel" aria-labelledby="ask-tab-ask" className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div>
            {/* Always mounted so screen readers announce answers; spaced only once it has one. */}
            <div aria-live="polite" aria-busy={!!pending} className={pending || exchange ? 'mb-5' : undefined}>
              {pending ? (
                <div className="space-y-3">
                  <QuestionHeading question={pending} />
                  <p className="flex items-center gap-2 text-sm text-[#5F6D61]">
                    <LoaderCircle size={16} className="shrink-0 animate-spin text-[#B89A62] motion-reduce:animate-none" />
                    Consulting the almanac…
                  </p>
                </div>
              ) : exchange ? (
                <div className="space-y-3">
                  <QuestionHeading question={exchange.question} />
                  {'result' in exchange.outcome ? (
                    <Answer result={exchange.outcome.result} onOpenEvent={onOpenEvent} onReviewExport={onReviewExport} />
                  ) : (
                    <AskError outcome={exchange.outcome} onTryThemes={() => setTab('themes')} />
                  )}
                </div>
              ) : null}
            </div>

            {!pending && (
              <div className="space-y-2">
                <p className="font-serif-almanac text-xs font-semibold uppercase tracking-wider">
                  {exchange ? 'Ask another' : 'Try asking'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(exchange ? EXAMPLE_QUESTIONS.filter((q) => q !== exchange.question).slice(0, 3) : EXAMPLE_QUESTIONS).map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => void ask(example)}
                      className="min-h-11 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-3 py-2 text-left text-sm text-[#182421] transition hover:border-[#B89A62] hover:bg-[#F3EDDF]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-5 flex gap-2 border-t border-[#D8D0BF] pt-4 text-[11px] leading-relaxed text-[#5F6D61]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#B89A62]" />
              <span>
                {/* Providers and their data terms: docs/ai-evals.md */}
                Questions are sent to an AI model: Groq, with Google Gemini as a backup outside the EEA, UK, and Switzerland. Don’t include personal information. The AI chooses what to look up and writes the wording, which can be imperfect; dates, times, and meanings come from AstroMoon.
              </span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#D8D0BF] bg-[#EBE3D0] p-3 sm:p-4">
          <label htmlFor="ask-question" className="sr-only">Your question</label>
          <div className="flex items-end gap-2">
            <textarea
              id="ask-question"
              ref={inputRef}
              rows={1}
              value={question}
              maxLength={ASK_QUESTION_MAX_LENGTH}
              enterKeyHint="send"
              placeholder="Ask about the Moon…"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleInputKeyDown}
              className="max-h-32 min-h-11 w-full min-w-0 flex-1 resize-none rounded-md border border-[#D8D0BF] bg-[#FFFDF9] px-3 py-2.5 text-base leading-snug text-[#182421] placeholder:text-[#7A857C] focus:border-[#182421] focus:outline-none sm:text-sm"
            />
            <button
              type="submit"
              disabled={!!pending || !question.trim()}
              aria-label="Ask"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#B44732] px-3 text-sm font-semibold text-white shadow-xs transition hover:bg-[#9E3D2A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowUp size={18} />
              <span className="hidden min-[400px]:inline">Ask</span>
            </button>
          </div>
          <p className="mt-1.5 flex min-w-0 justify-between gap-3 text-[11px] text-[#5F6D61]">
            <span className="min-w-0 break-words">Times in {timezone} · {hemisphere} hemisphere</span>
            {question.length > ASK_QUESTION_MAX_LENGTH - 100 && (
              <span className="shrink-0">{question.length}/{ASK_QUESTION_MAX_LENGTH}</span>
            )}
          </p>
        </form>
        </div>
        )}
      </div>
    </div>
  );
};

/**
 * The part of the layout viewport that is actually visible, while it is
 * smaller than the window. Phone keyboards (iOS Safari, Android Chrome)
 * shrink only the visual viewport, which would leave the dialog's input
 * under the keyboard; sizing the overlay to this keeps it in view.
 */
function useVisibleArea(): { top: number; height: number } | null {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height > 1;
      setArea(covered ? { top: viewport.offsetTop, height: viewport.height } : null);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return area;
}

const QuestionHeading: React.FC<{ question: string }> = ({ question }) => (
  <p className="border-l-2 border-[#B89A62] pl-3 font-serif-almanac text-lg leading-snug text-[#182421] break-words">
    <span className="sr-only">You asked: </span>
    {question}
  </p>
);

const Answer: React.FC<{
  result: AskResult;
  onOpenEvent: (event: EventView) => void;
  onReviewExport: (draft: ExportDraft) => void;
}> = ({ result, onOpenEvent, onReviewExport }) => {
  const events = new Map(result.events.map((event) => [event.id, event]));
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line break-words text-[15px] leading-7 text-[#182421]">
        {result.segments.map((segment, index) => {
          if (segment.type === 'text') return <React.Fragment key={index}>{segment.text}</React.Fragment>;
          const event = events.get(segment.id);
          return event ? <EventChip key={index} event={event} onOpen={onOpenEvent} /> : null;
        })}
      </p>
      {result.exportDraft && <ExportDraftCard draft={result.exportDraft} onReview={onReviewExport} />}
      {result.events.length > 0 && (
        <p className="text-[11px] text-[#5F6D61]">Tap an event to open that day in the calendar.</p>
      )}
      <HowAnswered result={result} />
    </div>
  );
};

// A link rather than a button: buttons render as inline blocks, so a long chip
// would take a whole line instead of wrapping with the sentence. The href is
// the event's month, so opening it in a new tab still lands somewhere useful.
const EventChip: React.FC<{ event: EventView; onOpen: (event: EventView) => void }> = ({ event, onOpen }) => {
  const title = describeEventTitle(event);
  const time = describeEventTime(event);
  const [year, month] = event.localDateString.split('-').map(Number);
  return (
    <a
      href={`?year=${year}&month=${month}`}
      onClick={(clickEvent) => {
        if (clickEvent.button !== 0 || clickEvent.metaKey || clickEvent.ctrlKey || clickEvent.shiftKey || clickEvent.altKey) return;
        clickEvent.preventDefault();
        onOpen(event);
      }}
      aria-label={`${title}, ${time}. Open this day`}
      className="rounded-sm border border-[#B89A62]/70 bg-[#F6EFE0] px-1 py-0.5 text-[13px] text-[#182421] no-underline box-decoration-clone transition hover:border-[#B44732] hover:bg-[#FFFDF9]"
    >
      <span className="font-semibold">{title}</span>
      <span className="text-[#5F6D61]"> · {time}</span>
    </a>
  );
};

/** What prepare_export set up, shown from the draft itself rather than the model's wording. */
const ExportDraftCard: React.FC<{ draft: ExportDraft; onReview: (draft: ExportDraft) => void }> = ({ draft, onReview }) => {
  const months = countMonthsSpanned(draft.startDate, draft.endDate);
  const rows: [string, string][] = [
    ['Format', draft.format === 'calendar_pdf'
      ? `${EXPORT_FORMAT_LABELS[draft.format]}, ${months} whole month${months === 1 ? '' : 's'}`
      : EXPORT_FORMAT_LABELS[draft.format]],
    ['Dates', describeExportRange(draft)],
    ['Events', describeExportEvents(draft) ?? 'None (month grids only)'],
    ['Timezone', draft.timezone],
    ['Moon', `${draft.hemisphere} hemisphere`],
  ];
  return (
    <div className="rounded-md border border-[#B89A62] bg-[#F6EFE0] p-3 sm:p-4">
      <p className="font-serif-almanac text-xs font-semibold uppercase tracking-wider text-[#182421]">Export ready to review</p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-[#5F6D61]">{label}</dt>
            <dd className="min-w-0 break-words text-[#182421]">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => onReview(draft)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-[#B44732] px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-[#9E3D2A] min-[430px]:w-auto"
      >
        <Download size={16} />
        Review export
      </button>
    </div>
  );
};

const HowAnswered: React.FC<{ result: AskResult }> = ({ result }) => {
  const check =
    result.source === 'fallback'
      ? 'The AI’s wording didn’t pass the server’s checks, so this lists what the almanac found instead.'
      : result.corrections > 0
        ? 'The first draft wrote a date itself, so it was sent back once; the final answer cites only events the almanac returned.'
        : result.events.length > 0
          ? 'Every event above was checked against what the almanac returned, and its date and time are shown from AstroMoon’s calculations.'
          : 'The answer cites no dated events, and was checked for dates the AI wrote itself.';
  const exportNote = result.exportDraft
    ? 'The export card shows the settings exactly as the tool validated them; nothing downloads until you choose in the export dialog.'
    : null;
  return (
    <details className="group rounded-md border border-[#D8D0BF] bg-[#FAF6EE] text-xs text-[#5F6D61]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-medium text-[#182421] [&::-webkit-details-marker]:hidden">
        How this was answered
        <ChevronDown size={14} className="shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-[#D8D0BF] px-3 py-3 leading-relaxed">
        {result.trace.length > 0 ? (
          <ol className="space-y-2">
            {result.trace.map((entry, index) => (
              <li key={index} className="min-w-0">
                <p className="font-medium text-[#182421]">
                  {TOOL_LABELS[entry.tool] ?? entry.tool}
                  {!entry.ok && <span className="font-normal text-[#B44732]"> · returned an error</span>}
                </p>
                <p className="break-words">{entry.detail}</p>
                <code className="mt-0.5 block break-all font-mono text-[11px] text-[#7A857C]">
                  {entry.tool}({typeof entry.arguments === 'string' ? entry.arguments : JSON.stringify(entry.arguments)})
                </code>
              </li>
            ))}
          </ol>
        ) : (
          <p>The AI answered without looking anything up.</p>
        )}
        <p>{check}</p>
        {exportNote && <p>{exportNote}</p>}
        {result.model && <p>Model: <span className="font-mono text-[11px]">{result.model}</span></p>}
      </div>
    </details>
  );
};

// Errors where the question itself is fine, so on-device theme search is a real alternative.
const THEME_FALLBACK_ERRORS = new Set(['not_configured', 'resting', 'timeout', 'unavailable', 'internal', 'network']);

const AskError: React.FC<{ outcome: Extract<AskOutcome, { ok: false }>; onTryThemes: () => void }> = ({ outcome, onTryThemes }) => (
  <div className="flex gap-2.5 rounded-md border border-[#B44732]/40 bg-[#FAF6EE] p-3 text-sm text-[#182421]">
    <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#B44732]" />
    <div className="min-w-0 space-y-1">
      <p>{outcome.message}</p>
      {outcome.error === 'resting' && (
        <p className="text-xs text-[#5F6D61]">
          Try again {outcome.retryAfterSeconds !== undefined ? describeRetryAfter(outcome.retryAfterSeconds) : 'later'}. The calendar, exports, and guides work as usual.
        </p>
      )}
      {THEME_FALLBACK_ERRORS.has(outcome.error) && (
        <button
          type="button"
          onClick={onTryThemes}
          className="mt-1.5 min-h-11 rounded-md border border-[#D8D0BF] bg-[#FAF7F0] px-3 text-sm font-medium text-[#182421] transition hover:bg-[#EAE2D0]"
        >
          Try theme search instead (runs on this device)
        </button>
      )}
    </div>
  </div>
);
