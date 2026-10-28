/**
 * On-device theme search: rank the app's traditional themes against a query
 * by embedding similarity, then find the coming days whose noon sign or day
 * phase carries each theme.
 *
 * Everything here is pure and model-agnostic; themeModel.ts supplies the real
 * embedder in the browser, and tests supply fixed vectors.
 */

import { DayLunarData } from '../types';
import { THEME_CORPUS, ThemeEntry, ThemeTarget, themeTargetKey } from './themeCorpus';

/** Embeds texts as unit-length vectors (so a dot product is cosine similarity). */
export type Embedder = (texts: string[]) => Promise<number[][]>;

/**
 * Below this, a match is noise. Measured with all-MiniLM-L6-v2: related
 * short texts score about 0.4-0.6 and unrelated ones under 0.2.
 */
export const THEME_MIN_SCORE = 0.3;
export const THEME_RESULT_LIMIT = 3;
/** How far ahead to look for matching days. */
export const THEME_WINDOW_DAYS = 90;

export interface ThemeMatch {
  target: ThemeTarget;
  score: number;
  /** The corpus text that matched best, shown as the reason. */
  entry: ThemeEntry;
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Best entry per sign or phase, strongest first, keeping only real matches. */
export function rankThemes(
  queryVector: ArrayLike<number>,
  entryVectors: ArrayLike<number>[],
  corpus: ThemeEntry[] = THEME_CORPUS,
  { limit = THEME_RESULT_LIMIT, minScore = THEME_MIN_SCORE } = {}
): ThemeMatch[] {
  const best = new Map<string, ThemeMatch>();
  corpus.forEach((entry, index) => {
    const score = dot(queryVector, entryVectors[index]);
    const key = themeTargetKey(entry.target);
    const current = best.get(key);
    if (!current || score > current.score) best.set(key, { target: entry.target, score, entry });
  });
  return [...best.values()]
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface DayRun {
  /** First and last local dates of a stretch of consecutive matching days. */
  startDate: string;
  endDate: string;
  firstDay: DayLunarData;
}

export function dayMatchesTarget(day: DayLunarData, target: ThemeTarget): boolean {
  return target.kind === 'sign' ? day.noonSign.name === target.name : day.noonPhase.name === target.name;
}

/** Consecutive matching days grouped into runs (a sign lasts 2-3 days), soonest first. */
export function findUpcomingRuns(days: DayLunarData[], target: ThemeTarget, maxRuns = 3): DayRun[] {
  const runs: DayRun[] = [];
  let previous: DayLunarData | null = null;
  for (const day of days) {
    if (dayMatchesTarget(day, target)) {
      const last = runs[runs.length - 1];
      if (last && previous && last.endDate === previous.dateString && dayMatchesTarget(previous, target)) {
        last.endDate = day.dateString;
      } else {
        if (runs.length === maxRuns) break;
        runs.push({ startDate: day.dateString, endDate: day.dateString, firstDay: day });
      }
    }
    previous = day;
  }
  return runs;
}

export interface ThemeIndex {
  search(query: string): Promise<ThemeMatch[]>;
}

/** Embeds the corpus once, then ranks each query against it. */
export async function createThemeIndex(embed: Embedder, corpus: ThemeEntry[] = THEME_CORPUS): Promise<ThemeIndex> {
  const entryVectors = await embed(corpus.map((entry) => entry.text));
  return {
    async search(query) {
      const trimmed = query.trim();
      if (!trimmed) return [];
      const [queryVector] = await embed([trimmed]);
      return rankThemes(queryVector, entryVectors, corpus);
    },
  };
}
