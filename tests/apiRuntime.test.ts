import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

/**
 * Vercel runs each `api/<name>.js` as native Node ESM with no bundler in front
 * of it, so the bundle it re-exports must be self-contained. This runs the
 * real build step and then each real entry file in a fresh Node process,
 * exactly as the Lambda does. (A previous version of the feed function
 * imported astronomy-engine at runtime; its ESM build is not marked
 * "type": "module" and crashed Vercel's loader with "Unexpected token 'export'".)
 */
const root = path.resolve(import.meta.dirname, '..');

// One smoke script per entry: it imports the entry as `mod` and prints JSON
// that must equal `expected`.
const entries: Record<string, { script: string; expected: unknown }> = {
  calendar: {
    script: `
      const res = mod.GET(new Request('https://astromoon.ca/api/calendar?tz=UTC&daily=0'));
      const body = await res.text();
      console.log(JSON.stringify({ status: res.status, type: res.headers.get('content-type'), starts: body.slice(0, 15), head: mod.HEAD(new Request('https://astromoon.ca/api/calendar?tz=UTC')).status }));
    `,
    expected: {
      status: 200,
      type: 'text/calendar; charset=utf-8',
      starts: 'BEGIN:VCALENDAR',
      head: 200,
    },
  },
};

test('every api/ entry has a runtime smoke test', () => {
  const apiFiles = readdirSync(path.join(root, 'api')).filter((file) => file.endsWith('.js'));
  assert.deepEqual(apiFiles.map((file) => file.replace(/\.js$/, '')).sort(), Object.keys(entries).sort());
});

test('api/ entries run as plain Node ESM after the API build', () => {
  execFileSync(process.execPath, ['scripts/build-api.mjs'], { cwd: root, stdio: 'pipe' });

  for (const [name, { script, expected }] of Object.entries(entries)) {
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `const mod = await import('./api/${name}.js');\n${script}`],
      { cwd: root, stdio: 'pipe' }
    ).toString();
    assert.deepEqual(JSON.parse(output.trim()), expected, name);

    const bundle = readFileSync(path.join(root, `server/dist/${name}.js`), 'utf8');
    assert.doesNotMatch(bundle, /from\s*["']/, `${name} bundle must not import anything at runtime`);
  }
});
