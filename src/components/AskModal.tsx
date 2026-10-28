import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, X } from 'lucide-react';
import { Flourish, MoonLoader, ScrollPrompt, ScrollRod, useUnroll, Whispers } from './AlmanacScroll';
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
  'A printable calendar of next year’s full and new moons',
  'What does a New Moon in Scorpio mean?',
  'What eclipses happen next year?',
  'Which full moons next year are in fire signs?',
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
  const paperRef = useRef<HTMLDivElement>(null);
  useUnroll(paperRef);
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

  const examples = EXAMPLE_QUESTIONS.filter((q) => q !== exchange?.question).slice(0, exchange ? 3 : 4);

  return (
    <div
      id="ask-modal-overlay"
      style={visibleArea ? { top: visibleArea.top, height: visibleArea.height, bottom: 'auto' } : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1614]/85 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6"
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
        className="flex max-h-[min(46rem,100%)] w-full min-w-0 max-w-xl flex-col font-sans-almanac text-[#182421] drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)] focus:outline-none"
      >
        <ScrollRod />
        {/* The paper unrolls from the top rod and pushes the bottom rod down. */}
        <div ref={paperRef} className="-my-1 mx-2 flex min-h-0 flex-col sm:mx-3">
          <div className="almanac-paper flex min-h-0 flex-col overflow-hidden">
            <div className="almanac-reveal flex shrink-0 items-center justify-between gap-2 px-3 pt-2.5 sm:px-6" style={{ animationDelay: '460ms' }}>
              <h2 id="ask-modal-title" className="sr-only">Ask the Almanac</h2>
              <div role="tablist" aria-label="Ask a question or seek a theme" className="flex min-w-0 items-center">
                {([['ask', 'Ask'], ['themes', 'Seek a theme']] as const).map(([value, label], index) => (
                  <React.Fragment key={value}>
                    {index > 0 && <span aria-hidden="true" className="text-[#B89A62]">·</span>}
                    <button
                      id={`ask-tab-${value}`}
                      type="button"
                      role="tab"
                      aria-selected={tab === value}
                      aria-controls={`ask-panel-${value}`}
                      onClick={() => setTab(value)}
                      className={`min-h-11 px-2 font-cinzel text-[11px] tracking-[0.2em] transition ${
                        tab === value
                          ? 'text-[#182421] underline decoration-[#B89A62] decoration-2 underline-offset-[6px]'
                          : 'text-[#8A8471] hover:text-[#182421]'
                      }`}
                    >
                      {label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <button
                id="close-ask-modal-btn"
                type="button"
                aria-label="Close Ask the Almanac"
                onClick={onClose}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-[#7A7461] transition hover:bg-[#B89A62]/15 hover:text-[#182421]"
              >
                <X size={18} />
              </button>
            </div>

            {tab === 'themes' ? (
              <div id="ask-panel-themes" role="tabpanel" aria-labelledby="ask-tab-themes" className="flex min-h-0 flex-1 flex-col">
                {ThemePanel === 'failed' ? (
                  <div className="space-y-2 px-5 pb-6 pt-2 sm:px-8">
                    <p className="font-serif-almanac text-lg italic text-[#B44732]">Theme search couldn’t load. Check your connection.</p>
                    <button type="button" onClick={() => setThemePanel(null)} className="min-h-11 font-serif-almanac text-[17px] italic text-[#182421] underline decoration-[#B89A62] underline-offset-4">
                      Try again
                    </button>
                  </div>
                ) : ThemePanel ? (
                  <ThemePanel timezone={timezone} hemisphere={hemisphere} onOpenDate={onOpenDate} />
                ) : (
                  <MoonLoader label="Opening the pages…" hemisphere={hemisphere} />
                )}
              </div>
            ) : (
              <div id="ask-panel-ask" role="tabpanel" aria-labelledby="ask-tab-ask" className="almanac-reveal flex min-h-0 flex-1 flex-col pt-1" style={{ animationDelay: '540ms' }}>
                <ScrollPrompt
                  id="ask-question"
                  label="Your question"
                  value={question}
                  placeholder={exchange ? 'Ask another…' : 'What would you ask?'}
                  maxLength={ASK_QUESTION_MAX_LENGTH}
                  caption={
                    <>
                      Times in {timezone} · {hemisphere} sky
                      {question.length > ASK_QUESTION_MAX_LENGTH - 100 && ` · ${question.length}/${ASK_QUESTION_MAX_LENGTH}`}
                    </>
                  }
                  submitLabel="Ask"
                  inputRef={inputRef}
                  onChange={setQuestion}
                  onSubmit={() => void ask(question)}
                />
                <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-8">
                  {/* Always mounted so screen readers announce answers. */}
                  <div aria-live="polite" aria-busy={!!pending}>
                    {pending ? (
                      <>
                        <QuestionEcho question={pending} />
                        <MoonLoader label="Consulting the almanac…" hemisphere={hemisphere} />
                      </>
                    ) : exchange ? (
                      <div key={exchange.question} className="space-y-3">
                        <QuestionEcho question={exchange.question} />
                        {'result' in exchange.outcome ? (
                          <Answer result={exchange.outcome.result} onOpenEvent={onOpenEvent} onReviewExport={onReviewExport} />
                        ) : (
                          <AskError outcome={exchange.outcome} onTryThemes={() => setTab('themes')} />
                        )}
                      </div>
                    ) : null}
                  </div>

                  {!pending && (
                    <div className={exchange ? 'mt-2' : ''}>
                      {exchange && <Flourish />}
                      <Whispers label={exchange ? 'Or perhaps' : 'Perhaps ask'} items={examples} onPick={(item) => void ask(item)} />
                    </div>
                  )}

                  <p className="mt-6 text-center text-[10.5px] leading-relaxed text-[#8A8471]">
                    {/* Providers and their data terms: docs/ai-evals.md */}
                    Answers are written by an AI (Groq, with Google Gemini as a backup outside the EEA, UK, and Switzerland) and can be imperfect;
                    every date, time, and meaning comes from AstroMoon. Please don’t include personal information.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <ScrollRod />
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

const QuestionEcho: React.FC<{ question: string }> = ({ question }) => (
  <p className="break-words text-center font-serif-almanac text-[15px] italic text-[#7A7461]">
    <span className="sr-only">You asked: </span>“{question}”
  </p>
);

const Answer: React.FC<{
  result: AskResult;
  onOpenEvent: (event: EventView) => void;
  onReviewExport: (draft: ExportDraft) => void;
}> = ({ result, onOpenEvent, onReviewExport }) => {
  const events = new Map(result.events.map((event) => [event.id, event]));
  return (
    <div className="space-y-4">
      {/* Inked onto the page, with a drop capital. */}
      <p className="almanac-ink whitespace-pre-line break-words font-serif-almanac text-[18px] leading-8 text-[#182421] first-letter:float-left first-letter:mr-1.5 first-letter:mt-1.5 first-letter:font-cinzel first-letter:text-[2.7rem] first-letter:leading-[0.8] first-letter:text-[#B44732]">
        {result.segments.map((segment, index) => {
          if (segment.type === 'text') return <React.Fragment key={index}>{segment.text}</React.Fragment>;
          const event = events.get(segment.id);
          return event ? <EventChip key={index} event={event} onOpen={onOpenEvent} /> : null;
        })}
      </p>
      {result.exportDraft && <ExportDraftCard draft={result.exportDraft} onReview={onReviewExport} />}
      <div className="almanac-reveal flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" style={{ animationDelay: '700ms' }}>
        {result.events.length > 0 && (
          <p className="font-serif-almanac text-[13px] italic text-[#7A7461]">Tap an underlined event to open its day.</p>
        )}
        <HowAnswered result={result} />
      </div>
    </div>
  );
};

// A link rather than a button: buttons render as inline blocks, so a long event
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
      className="border-b-2 border-[#B89A62]/70 font-semibold text-[#182421] no-underline transition hover:border-[#B44732] hover:text-[#B44732]"
    >
      {title}
      <span className="font-sans-almanac text-[0.74em] font-medium tracking-wide text-[#6B6656]"> · {time}</span>
    </a>
  );
};

/** What prepare_export set up, as a sealed note, shown from the draft itself rather than the model's wording. */
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
    <div className="almanac-reveal relative mt-5 rounded-sm border border-[#B89A62]/50 bg-[#FBF7EE]/80 px-4 pb-2 pt-4" style={{ animationDelay: '500ms' }}>
      {/* Wax seal */}
      <span aria-hidden="true" className="absolute -top-3.5 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#B44732] text-[#F3EDDF] shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_0_0_3px_rgba(255,255,255,0.15)]">
        <Download size={14} />
      </span>
      <p className="font-cinzel text-[10px] tracking-[0.22em] text-[#86662E]">Your export, ready to review</p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px]">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-[#7A7461]">{label}</dt>
            <dd className="min-w-0 break-words text-[#182421]">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => onReview(draft)}
        className="mt-1 inline-flex min-h-11 items-center font-serif-almanac text-[17px] italic text-[#B44732] underline decoration-[#B44732]/40 underline-offset-4 transition hover:decoration-[#B44732]"
      >
        Review export →
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
    ? 'The export note shows the settings exactly as the tool validated them; nothing downloads until you choose in the export dialog.'
    : null;
  return (
    <details className="group min-w-0 basis-full text-[12px] text-[#6B6656] sm:basis-auto [&[open]]:basis-full">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-[#182421] [&::-webkit-details-marker]:hidden">
        How this was answered
        <ChevronDown size={13} className="transition group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-l-2 border-[#B89A62]/50 pb-1 pl-3 leading-relaxed">
        {result.trace.length > 0 ? (
          <ol className="space-y-1.5">
            {result.trace.map((entry, index) => (
              <li key={index} className="min-w-0">
                <span className="font-medium text-[#182421]">{TOOL_LABELS[entry.tool] ?? entry.tool}</span>
                {!entry.ok && <span className="text-[#B44732]"> · returned an error</span>}
                <span className="block break-words">{entry.detail}</span>
                <code className="block break-all font-mono text-[10.5px] text-[#8A8471]">
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
        {result.model && <p>Model: <span className="font-mono text-[10.5px]">{result.model}</span></p>}
      </div>
    </details>
  );
};

// Errors where the question itself is fine, so on-device theme search is a real alternative.
const THEME_FALLBACK_ERRORS = new Set(['not_configured', 'resting', 'timeout', 'unavailable', 'internal', 'network']);

const AskError: React.FC<{ outcome: Extract<AskOutcome, { ok: false }>; onTryThemes: () => void }> = ({ outcome, onTryThemes }) => (
  <div className="almanac-reveal space-y-1 text-center">
    <p className="font-serif-almanac text-lg italic text-[#B44732]">{outcome.message}</p>
    {outcome.error === 'resting' && (
      <p className="text-[13px] text-[#6B6656]">
        Try again {outcome.retryAfterSeconds !== undefined ? describeRetryAfter(outcome.retryAfterSeconds) : 'later'}. The calendar, exports, and guides work as usual.
      </p>
    )}
    {THEME_FALLBACK_ERRORS.has(outcome.error) && (
      <button
        type="button"
        onClick={onTryThemes}
        className="min-h-11 font-serif-almanac text-[17px] italic text-[#182421] underline decoration-[#B89A62] underline-offset-4 hover:decoration-[#B44732]"
      >
        Seek a theme instead — it runs on this device
      </button>
    )}
  </div>
);
