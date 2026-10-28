/**
 * Texts for on-device theme search, built from the app's own traditional
 * interpretations (the zodiac guide's sign copy and the phase meanings), so
 * search can only point to themes AstroMoon already presents.
 *
 * Each entry points to one sign or phase. Activities get their own entries so
 * a specific query ("plant a garden") can match a specific line.
 */

import { MOON_PHASE_MEANINGS, MoonPhaseName } from './astronomy';
import { ZODIAC_SIGNS } from './zodiac';

export type ThemeTarget = { kind: 'sign'; name: string } | { kind: 'phase'; name: MoonPhaseName };

export interface ThemeEntry {
  id: string;
  target: ThemeTarget;
  /** The text that is embedded and shown as the match. */
  text: string;
}

export function themeTargetKey(target: ThemeTarget): string {
  return `${target.kind}:${target.name}`;
}

/** Sign descriptions open with "The Moon shifts into X. Energy focus:", which says nothing about the theme. */
function signDescriptionBody(description: string): string {
  return description.replace(/^The Moon shifts into \w+\.\s*(Energy focus:\s*)?/, '');
}

export const THEME_CORPUS: ThemeEntry[] = [
  ...ZODIAC_SIGNS.flatMap((sign): ThemeEntry[] => {
    const target: ThemeTarget = { kind: 'sign', name: sign.name };
    return [
      { id: `sign-${sign.name}-theme`, target, text: `${sign.theme}. ${signDescriptionBody(sign.description)}` },
      ...sign.activities.map((activity, index) => ({ id: `sign-${sign.name}-activity-${index}`, target, text: activity })),
    ];
  }),
  ...(Object.entries(MOON_PHASE_MEANINGS) as [MoonPhaseName, string][]).map(([name, meaning]): ThemeEntry => ({
    id: `phase-${name.replace(/\s+/g, '-')}`,
    target: { kind: 'phase', name },
    text: meaning,
  })),
];
