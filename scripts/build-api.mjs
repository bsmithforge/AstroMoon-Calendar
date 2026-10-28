// Bundles each serverless handler into a self-contained ESM file for Vercel.
// Runs as part of `npm run build` (before Vercel traces api/).
//
// Each entry `name` bundles server/<name>.ts into server/dist/<name>.js, which
// the committed api/<name>.js re-exports. Add new handlers here.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entries = ['calendar', 'ask'];

await build({
  entryPoints: entries.map((name) => path.join(root, `server/${name}.ts`)),
  outdir: path.join(root, 'server/dist'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  legalComments: 'inline',
  logLevel: 'info',
});
