import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateRangeDataset, MOON_PHASE_MEANINGS } from '../src/utils/astronomy';
import { THEME_CORPUS, ThemeEntry, themeTargetKey } from '../src/utils/themeCorpus';
import { createThemeIndex, Embedder, findUpcomingRuns, rankThemes, THEME_MIN_SCORE } from '../src/utils/themeSearch';
import { ZODIAC_SIGNS } from '../src/utils/zodiac';

/**
 * Theme search with fixed vectors: no model download, so this runs in CI.
 * The real model is checked by hand with `npm run eval:themes`.
 */

test('the corpus covers every sign and phase with the app’s own copy', () => {
  const ids = THEME_CORPUS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.ok(THEME_CORPUS.every((entry) => entry.text.trim().length > 0));
  assert.ok(THEME_CORPUS.every((entry) => !entry.text.startsWith('The Moon shifts into')), 'boilerplate is stripped');

  for (const sign of ZODIAC_SIGNS) {
    const entries = THEME_CORPUS.filter((entry) => entry.target.kind === 'sign' && entry.target.name === sign.name);
    assert.equal(entries.length, 1 + sign.activities.length, sign.name);
    assert.ok(entries[0].text.startsWith(sign.theme));
    assert.deepEqual(entries.slice(1).map((entry) => entry.text), sign.activities);
  }
  for (const [name, meaning] of Object.entries(MOON_PHASE_MEANINGS)) {
    assert.ok(THEME_CORPUS.some((entry) => entry.target.kind === 'phase' && entry.target.name === name && entry.text === meaning), name);
  }
  // Cancer's description reads "The Moon shifts into Cancer (domicile). Energy focus: …".
  assert.match(THEME_CORPUS.find((entry) => entry.id === 'sign-Cancer-theme')!.text, /^Nurturance, Intuition & Sanctuary\. Nurturing/);
});

const tiny: ThemeEntry[] = [
  { id: 'a1', target: { kind: 'sign', name: 'Aries' }, text: 'a1' },
  { id: 'a2', target: { kind: 'sign', name: 'Aries' }, text: 'a2' },
  { id: 't1', target: { kind: 'sign', name: 'Taurus' }, text: 't1' },
  { id: 'n1', target: { kind: 'phase', name: 'New Moon' }, text: 'n1' },
  { id: 'f1', target: { kind: 'phase', name: 'Full Moon' }, text: 'f1' },
];

test('ranking keeps each sign or phase’s best entry, above the floor, strongest first', () => {
  const query = [1, 0];
  const vectors = [[0.5, 0.87], [0.9, 0.44], [0.7, 0.71], [0.31, 0.95], [0.2, 0.98]];
  const ranked = rankThemes(query, vectors, tiny);
  assert.deepEqual(ranked.map((match) => [match.target.name, match.entry.id]), [
    ['Aries', 'a2'],
    ['Taurus', 't1'],
    ['New Moon', 'n1'],
  ]);
  assert.ok(ranked.every((match, index) => index === 0 || ranked[index - 1].score >= match.score));
  assert.equal(rankThemes(query, vectors, tiny, { limit: 1 }).length, 1);
  assert.deepEqual(rankThemes(query, vectors, tiny, { minScore: 0.8 }).map((match) => match.target.name), ['Aries']);
  assert.deepEqual(rankThemes([0, 0], vectors, tiny), [], 'nothing clears the floor');
  assert.ok(THEME_MIN_SCORE > 0.2 && THEME_MIN_SCORE < 0.5);
});

test('upcoming days come as runs of consecutive matching days', () => {
  const { days } = generateRangeDataset('2026-11-01', '2027-01-29', 'northern', 'America/Halifax');
  const taurus = findUpcomingRuns(days, { kind: 'sign', name: 'Taurus' });
  assert.equal(taurus.length, 3);
  for (const run of taurus) {
    const inRun = days.filter((day) => day.dateString >= run.startDate && day.dateString <= run.endDate);
    assert.ok(inRun.length >= 1 && inRun.length <= 3, `${run.startDate}–${run.endDate}`);
    assert.ok(inRun.every((day) => day.noonSign.name === 'Taurus'));
    assert.equal(run.firstDay.dateString, run.startDate);
    const before = days[days.indexOf(inRun[0]) - 1];
    const after = days[days.indexOf(inRun[inRun.length - 1]) + 1];
    assert.ok(!before || before.noonSign.name !== 'Taurus');
    assert.ok(!after || after.noonSign.name !== 'Taurus');
  }
  assert.ok(taurus[0].startDate < taurus[1].startDate && taurus[1].startDate < taurus[2].startDate);

  // Phase names follow the exact quarter, so each Full Moon is a single day.
  const full = findUpcomingRuns(days, { kind: 'phase', name: 'Full Moon' });
  assert.deepEqual(full.map((run) => run.startDate), days.filter((day) => day.quarterType === 'Full Moon').map((day) => day.dateString));
  assert.ok(full.every((run) => run.startDate === run.endDate));
  assert.deepEqual(findUpcomingRuns(days.slice(0, 1), { kind: 'phase', name: 'Full Moon' }), []);
});

/** Bag-of-words vectors: deterministic stand-in for the model. */
function bagOfWords(): { embed: Embedder; calls: string[][] } {
  const vocabulary = new Map<string, number>();
  const calls: string[][] = [];
  const embed: Embedder = async (texts) => {
    calls.push(texts);
    const words = texts.map((text) => text.toLowerCase().match(/[a-z]+/g) ?? []);
    words.flat().forEach((word) => vocabulary.has(word) || vocabulary.set(word, vocabulary.size));
    return words.map((list) => {
      const vector = new Array(4096).fill(0);
      list.forEach((word) => (vector[vocabulary.get(word)!] += 1));
      const norm = Math.hypot(...vector) || 1;
      return vector.map((value) => value / norm);
    });
  };
  return { embed, calls };
}

test('the index embeds the corpus once and each query once', async () => {
  const { embed, calls } = bagOfWords();
  const index = await createThemeIndex(embed);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, THEME_CORPUS.length);

  const garden = await index.search('gardening and nature');
  assert.equal(themeTargetKey(garden[0].target), 'sign:Taurus');
  assert.equal(garden[0].entry.text, 'Gardening and nature grounding');
  assert.equal(calls.length, 2);

  assert.deepEqual(await index.search('   '), []);
  assert.equal(calls.length, 2, 'blank queries are not embedded');
});
