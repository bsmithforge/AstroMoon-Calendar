// Bundles the subscription feed handler into a single self-contained ESM file
// for Vercel. Runs as part of `npm run build` (before Vercel traces api/).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(root, 'server/calendar.ts')],
  outfile: path.join(root, 'server/dist/calendar.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  legalComments: 'inline',
  logLevel: 'info',
});
