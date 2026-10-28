import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Cpu, Download, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
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
  const indexRef = useRef<ThemeIndex | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!trimmed || !indexRef.current || searching) return;
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

  return (
    <>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-[#182421]">
            Describe something you want to do or feel, and find the coming days whose Moon sign or phase traditionally suits it.
          </p>

          {status === 'idle' && (
            <div className="space-y-3 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-4">
              <p className="flex gap-2 text-xs leading-relaxed text-[#5F6D61]">
                <Cpu size={15} className="mt-0.5 shrink-0 text-[#B89A62]" />
                <span>
                  Theme search runs entirely on this device. It needs a one-time download of an open-source language model
                  ({THEME_MODEL_ID}, about {THEME_MODEL_DOWNLOAD_MB} MB) from Hugging Face and jsDelivr. Your browser keeps it, so it
                  won’t download again, and searches keep working if your connection drops.
                </span>
              </p>
              <button
                type="button"
                onClick={start}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-[#182421] px-4 text-sm font-semibold text-[#F3EDDF] transition hover:bg-[#253631] min-[430px]:w-auto"
              >
                <Download size={16} />
                Download on-device model (≈{THEME_MODEL_DOWNLOAD_MB} MB)
              </button>
            </div>
          )}

          {(status === 'checking' || status === 'loading') && (
            <div className="space-y-2" aria-live="polite">
              <p className="flex items-center gap-2 text-sm text-[#5F6D61]">
                <LoaderCircle size={16} className="shrink-0 animate-spin text-[#B89A62] motion-reduce:animate-none" />
                {status === 'checking'
                  ? 'Checking for the on-device model…'
                  : progress !== null
                    ? `Downloading the model… ${Math.round(progress * 100)}%`
                    : 'Preparing themes…'}
              </p>
              {status === 'loading' && progress !== null && (
                <div
                  role="progressbar"
                  aria-label="Model download"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  className="h-2 overflow-hidden rounded-sm bg-[#EAE2D0]"
                >
                  <div className="h-full bg-[#B89A62] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="flex gap-2.5 rounded-md border border-[#B44732]/40 bg-[#FAF6EE] p-3 text-sm text-[#182421]">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#B44732]" />
              <div className="min-w-0 space-y-2">
                <p className="break-words">{error ?? 'The on-device model could not load.'}</p>
                <button type="button" onClick={start} className="min-h-11 rounded-md border border-[#D8D0BF] bg-[#FAF7F0] px-3 text-sm font-medium hover:bg-[#EAE2D0]">
                  Try again
                </button>
              </div>
            </div>
          )}

          <div aria-live="polite" aria-busy={searching}>
            {result && (
              <div className="space-y-3">
                <p className="border-l-2 border-[#B89A62] pl-3 font-serif-almanac text-lg leading-snug text-[#182421] break-words">
                  <span className="sr-only">You searched for: </span>
                  {result.query}
                </p>
                {result.matches.length === 0 ? (
                  <p className="text-sm text-[#5F6D61]">
                    No strong match. Try describing an activity or a feeling, like “planting a garden” or “a hard conversation”.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {result.matches.map((match) => (
                      <ThemeResult
                        key={themeTargetKey(match.target)}
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

          {status === 'ready' && !searching && (
            <div className="space-y-2">
              <p className="font-serif-almanac text-xs font-semibold uppercase tracking-wider">{result ? 'Search another' : 'Try'}</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.filter((example) => example !== result?.query).map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => void search(example)}
                    className="min-h-11 rounded-md border border-[#D8D0BF] bg-[#FAF6EE] px-3 py-2 text-left text-sm text-[#182421] transition hover:border-[#B89A62] hover:bg-[#F3EDDF]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="flex gap-2 border-t border-[#D8D0BF] pt-4 text-[11px] leading-relaxed text-[#5F6D61]">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#B89A62]" />
            <span>
              What you type here never leaves this device. Matches come from AstroMoon’s traditional interpretations, and days use
              the noon sign and phase in {timezone}.
            </span>
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search(query);
        }}
        className="shrink-0 border-t border-[#D8D0BF] bg-[#EBE3D0] p-3 sm:p-4"
      >
        <label htmlFor="theme-query" className="sr-only">Describe an intention or feeling</label>
        <div className="flex items-end gap-2">
          <input
            id="theme-query"
            ref={inputRef}
            type="search"
            value={query}
            maxLength={200}
            enterKeyHint="search"
            disabled={status !== 'ready'}
            placeholder={status === 'ready' ? 'Describe an intention…' : 'Load the model to search'}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-full min-w-0 flex-1 rounded-md border border-[#D8D0BF] bg-[#FFFDF9] px-3 py-2.5 text-base text-[#182421] placeholder:text-[#7A857C] focus:border-[#182421] focus:outline-none disabled:opacity-60 sm:text-sm"
          />
          <button
            type="submit"
            disabled={status !== 'ready' || searching || !query.trim()}
            aria-label="Search themes"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#B44732] px-3 text-sm font-semibold text-white shadow-xs transition hover:bg-[#9E3D2A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={17} />
            <span className="hidden min-[400px]:inline">Search</span>
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-[#5F6D61]">On-device · next {THEME_WINDOW_DAYS} days</p>
      </form>
    </>
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
  match: ThemeMatch;
  hemisphere: Hemisphere;
  runs: DayRun[] | null;
  onOpenDate: (dateString: string) => void;
}> = ({ match, hemisphere, runs, onOpenDate }) => (
  <li className="rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-3">
    <p className="font-serif-almanac text-base font-semibold text-[#182421]">{targetLabel(match.target, hemisphere)}</p>
    <p className="mt-1 text-sm leading-relaxed text-[#182421]">“{match.entry.text}”</p>
    <p className="mt-0.5 text-[11px] text-[#5F6D61]">Traditional interpretation</p>
    <div className="mt-2.5">
      {runs === null ? (
        <p className="text-xs text-[#5F6D61]">Finding upcoming days…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-[#5F6D61]">None in the next {THEME_WINDOW_DAYS} days.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {runs.map((run) => (
            <button
              key={run.startDate}
              type="button"
              onClick={() => onOpenDate(run.startDate)}
              aria-label={`${describeRun(run)}: open ${run.startDate}`}
              className="min-h-11 rounded-md border border-[#B89A62]/70 bg-[#F6EFE0] px-3 text-sm text-[#182421] transition hover:border-[#B44732] hover:bg-[#FFFDF9]"
            >
              {describeRun(run)}
            </button>
          ))}
        </div>
      )}
    </div>
  </li>
);

export default ThemeSearchPanel;
