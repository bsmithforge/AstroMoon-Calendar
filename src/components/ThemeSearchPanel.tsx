import React, { useEffect, useRef, useState } from 'react';
import { Flourish, MoonLoader, ScrollPrompt, Whispers } from './AlmanacScroll';
import { DayLunarData, Hemisphere } from '../types';
import { generateRangeDataset, getLocalDateComponents, getPhaseEmoji } from '../utils/astronomy';
import { ThemeTarget, themeTargetKey } from '../utils/themeCorpus';
import { isThemeModelCached, loadThemeEmbedder, THEME_MODEL_DOWNLOAD_MB, THEME_MODEL_ID } from '../utils/themeModel';
import {
  createThemeIndex,
  DayRun,
  findUpcomingRuns,
  THEME_WINDOW_DAYS,
  ThemeIndex,
  ThemeMatch,
} from '../utils/themeSearch';
import { ZODIAC_SIGNS } from '../utils/zodiac';

interface ThemeSearchPanelProps {
  timezone: string;
  hemisphere: Hemisphere;
  onOpenDate: (dateString: string) => void;
}

const EXAMPLES = ['Starting something new', 'Planting a garden', 'A hard conversation', 'Rest and recharge'];

// One index per page: reopening the dialog reuses the loaded model and embedded corpus.
let indexPromise: Promise<ThemeIndex> | null = null;

function getThemeIndex(onProgress: (fraction: number | null) => void): Promise<ThemeIndex> {
  // Always register for progress: a panel reopened mid-download joins the same load.
  const embedder = loadThemeEmbedder(onProgress);
  indexPromise ??= embedder
    .then((embed) => createThemeIndex(embed))
    .catch((err) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
}

type Status = 'checking' | 'idle' | 'loading' | 'ready' | 'error';

export const ThemeSearchPanel: React.FC<ThemeSearchPanelProps> = ({ timezone, hemisphere, onOpenDate }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ query: string; matches: ThemeMatch[] } | null>(null);
  const [days, setDays] = useState<DayLunarData[] | null>(null);
  /** A search made before the model was ready: it starts the download and runs once loaded. */
  const [queued, setQueued] = useState<string | null>(null);
  const indexRef = useRef<ThemeIndex | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const start = () => {
    setStatus('loading');
    setError(null);
    getThemeIndex(setProgress)
      .then((index) => {
        indexRef.current = index;
        setStatus('ready');
        if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
      })
      .catch((err: Error) => {
        setError(err.message);
        setStatus('error');
      });
  };

  // Load straight away when the model is already on this device: it costs no download.
  useEffect(() => {
    let cancelled = false;
    isThemeModelCached().then((cached) => {
      if (cancelled) return;
      if (cached || indexPromise) start();
      else setStatus('idle');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute the coming days once the model is ready, after paint, rather than in a tap.
  useEffect(() => {
    if (status !== 'ready' || days) return;
    const timer = window.setTimeout(() => {
      const today = getLocalDateComponents(new Date(), timezone).dateString;
      const end = new Date(Date.parse(`${today}T12:00:00Z`) + (THEME_WINDOW_DAYS - 1) * 86400000).toISOString().slice(0, 10);
      setDays(generateRangeDataset(today, end, hemisphere, timezone).days);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [status, days, timezone, hemisphere]);

  const search = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || searching) return;
    // The first search is the go-ahead for the one-time download (the caption says so).
    if (!indexRef.current) {
      setQueued(trimmed);
      setQuery('');
      if (status === 'idle' || status === 'error') start();
      return;
    }
    setSearching(true);
    try {
      const matches = await indexRef.current.search(trimmed);
      setResult({ query: trimmed, matches });
      setQuery('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (status !== 'ready' || !queued) return;
    setQueued(null);
    void search(queued);
    // search reads the index, which is set before status becomes ready.
  }, [status, queued]);

  const busy = status === 'checking' || status === 'loading';
  const needsDownload = status === 'idle' || status === 'error';

  return (
    <div className="almanac-reveal flex min-h-0 flex-1 flex-col pt-1">
      <ScrollPrompt
        id="theme-query"
        label="Describe an intention or feeling"
        value={query}
        placeholder={result ? 'Seek another…' : 'What do you hope to do?'}
        maxLength={200}
        disabled={busy}
        caption={
          needsDownload
            ? `First search downloads ≈${THEME_MODEL_DOWNLOAD_MB} MB once, then runs on this device`
            : `Runs on this device · next ${THEME_WINDOW_DAYS} days · ${timezone}`
        }
        submitLabel="Seek a theme"
        inputRef={inputRef}
        onChange={setQuery}
        onSubmit={() => void search(query)}
      />

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-8">
        {(status === 'loading' || (status === 'checking' && queued)) && (
          <div aria-live="polite">
            {queued && (
              <p className="break-words text-center font-serif-almanac text-[15px] italic text-[#7A7461]">“{queued}”</p>
            )}
            <MoonLoader
              hemisphere={hemisphere}
              label={progress !== null ? `Fetching the almanac’s model… ${Math.round(progress * 100)}%` : 'Reading the old themes…'}
            />
            {status === 'loading' && progress !== null && (
              <div
                role="progressbar"
                aria-label="Model download"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className="mx-auto -mt-4 h-px max-w-48 bg-[#B89A62]/25"
              >
                <div className="h-px bg-[#B44732] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="almanac-reveal space-y-1 text-center">
            <p className="break-words font-serif-almanac text-lg italic text-[#B44732]">{error ?? 'The on-device model could not load.'}</p>
            <button type="button" onClick={start} className="min-h-11 font-serif-almanac text-[17px] italic text-[#182421] underline decoration-[#B89A62] underline-offset-4">
              Try again
            </button>
          </div>
        )}

        <div aria-live="polite" aria-busy={searching}>
          {result && (
            <div key={result.query} className="space-y-1">
              <p className="break-words text-center font-serif-almanac text-[15px] italic text-[#7A7461]">
                <span className="sr-only">You searched for: </span>“{result.query}”
              </p>
              {result.matches.length === 0 ? (
                <p className="almanac-ink pt-3 text-center font-serif-almanac text-[17px] italic text-[#4F5A51]">
                  The almanac finds no strong match. Try an activity or a feeling, like “planting a garden” or “a hard conversation”.
                </p>
              ) : (
                <ol>
                  {result.matches.map((match, index) => (
                    <ThemeResult
                      key={themeTargetKey(match.target)}
                      index={index}
                      match={match}
                      hemisphere={hemisphere}
                      runs={days ? findUpcomingRuns(days, match.target) : null}
                      onOpenDate={onOpenDate}
                    />
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {(status === 'ready' || status === 'idle') && !searching && !queued && (
          <div className={result ? 'mt-2' : ''}>
            {result && <Flourish />}
            <Whispers
              label={result ? 'Or seek' : 'Perhaps'}
              items={EXAMPLES.filter((example) => example !== result?.query)}
              onPick={(example) => void search(example)}
            />
          </div>
        )}

        <p className="mt-6 text-center text-[10.5px] leading-relaxed text-[#8A8471]">
          Private: what you type never leaves this device. Uses the open-source {THEME_MODEL_ID} model from Hugging Face, kept by your
          browser. Matches come from AstroMoon’s traditional interpretations.
        </p>
      </div>
    </div>
  );
};

function targetLabel(target: ThemeTarget, hemisphere: Hemisphere): string {
  if (target.kind === 'phase') return `${getPhaseEmoji(target.name, hemisphere)} ${target.name}`;
  const sign = ZODIAC_SIGNS.find((s) => s.name === target.name);
  return `${sign?.symbol ?? ''} Moon in ${target.name}`.trim();
}

const runFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const toUtcNoon = (date: string) => new Date(`${date}T12:00:00Z`);

function describeRun(run: DayRun): string {
  return run.startDate === run.endDate
    ? runFormat.format(toUtcNoon(run.startDate))
    : runFormat.formatRange(toUtcNoon(run.startDate), toUtcNoon(run.endDate));
}

const ThemeResult: React.FC<{
  index: number;
  match: ThemeMatch;
  hemisphere: Hemisphere;
  runs: DayRun[] | null;
  onOpenDate: (dateString: string) => void;
}> = ({ index, match, hemisphere, runs, onOpenDate }) => (
  <li className="almanac-reveal border-b border-[#B89A62]/25 py-4 last:border-b-0" style={{ animationDelay: `${index * 140}ms` }}>
    <p className="font-serif-almanac text-xl text-[#182421]">{targetLabel(match.target, hemisphere)}</p>
    <p className="mt-1 font-serif-almanac text-[17px] italic leading-relaxed text-[#4F5A51]">
      “{match.entry.text}”
      <span className="ml-1.5 whitespace-nowrap font-sans-almanac text-[10.5px] not-italic tracking-wide text-[#8A8471]">traditional</span>
    </p>
    <div className="mt-1">
      {runs === null ? (
        <p className="text-[12px] italic text-[#8A8471]">Finding upcoming days…</p>
      ) : runs.length === 0 ? (
        <p className="text-[12px] italic text-[#8A8471]">None in the next {THEME_WINDOW_DAYS} days.</p>
      ) : (
        <ul className="flex flex-wrap items-center gap-x-4">
          {runs.map((run) => (
            <li key={run.startDate}>
              <button
                type="button"
                onClick={() => onOpenDate(run.startDate)}
                aria-label={`${describeRun(run)}: open ${run.startDate}`}
                className="min-h-11 rounded-sm text-[14px] font-medium text-[#182421] underline decoration-[#B89A62] decoration-2 underline-offset-[5px] transition hover:text-[#B44732] hover:decoration-[#B44732]"
              >
                {describeRun(run)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </li>
);

export default ThemeSearchPanel;
