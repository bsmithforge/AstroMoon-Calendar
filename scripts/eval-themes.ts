/**
 * Manual eval for on-device theme search: runs evals/theme-queries.json
 * through the same corpus, ranking, and model as the browser, in Node.
 *
 * transformers.js is not an npm dependency (see src/utils/themeModel.ts), so
 * install it somewhere outside the project and point the script at it:
 *
 *   npm install --prefix /tmp/tjs @huggingface/transformers@4.3.1
 *   TRANSFORMERS_MODULE=/tmp/tjs/node_modules/@huggingface/transformers npm run eval:themes
 *
 * Node runs the model with onnxruntime-node instead of WebAssembly; scores
 * can differ from the browser in the last decimal places.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { THEME_MODEL_ID } from '../src/utils/themeModel';
import { createThemeIndex, Embedder, THEME_MIN_SCORE } from '../src/utils/themeSearch';

interface ThemeQuery {
  query: string;
  expect: string[];
}

const root = path.resolve(import.meta.dirname, '..');
const modulePath = process.env.TRANSFORMERS_MODULE;
if (!modulePath) {
  console.error('Set TRANSFORMERS_MODULE to an installed @huggingface/transformers@4.3.1 (see the comment at the top of this script).');
  process.exit(1);
}
const entry = createRequire(path.join(path.resolve(modulePath), 'noop.js')).resolve(path.resolve(modulePath));
const { pipeline } = await import(pathToFileURL(entry).href);

const extractor = await pipeline('feature-extraction', THEME_MODEL_ID, { dtype: 'q8' });
const embed: Embedder = async (texts) => (await extractor(texts, { pooling: 'mean', normalize: true })).tolist();

const started = Date.now();
const index = await createThemeIndex(embed);
const indexMs = Date.now() - started;

const { queries }: { queries: ThemeQuery[] } = JSON.parse(readFileSync(path.join(root, 'evals/theme-queries.json'), 'utf8'));
const rows: string[] = [];
let passed = 0;
for (const { query, expect } of queries) {
  const matches = await index.search(query);
  const names = matches.map((match) => match.target.name);
  const ok = expect.length === 0 ? matches.length === 0 : names.some((name) => expect.includes(name));
  if (ok) passed++;
  const shown = matches.map((match) => `${match.target.name} ${match.score.toFixed(2)}`).join(', ') || 'no match';
  rows.push(`| ${query} | ${expect.join(', ') || 'no match'} | ${shown} | ${ok ? '✓' : '✗'} |`);
  console.log(`${ok ? '✓' : '✗'} ${query} → ${shown}`);
}

const report = [
  `## Theme search: ${THEME_MODEL_ID} (q8)`,
  '',
  `Run ${new Date().toISOString().slice(0, 10)} in Node · score floor ${THEME_MIN_SCORE} · corpus indexed in ${indexMs} ms · **${passed}/${queries.length} passed**`,
  '',
  '| Query | Expected (any, top 3) | Matches | Pass |',
  '| --- | --- | --- | --- |',
  ...rows,
  '',
].join('\n');
console.log(`\n${report}`);
const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6);
if (out) writeFileSync(path.resolve(out), report);
