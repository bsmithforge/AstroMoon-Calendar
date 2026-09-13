import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

/**
 * Vercel runs `api/calendar.js` as native Node ESM with no bundler in front of
 * it, so the bundle it re-exports must be self-contained. This runs the real
 * build step and then the real entry file in a fresh Node process, exactly as
 * the Lambda does. (A previous version of the function imported
 * astronomy-engine at runtime; its ESM build is not marked "type": "module"
 * and crashed Vercel's loader with "Unexpected token 'export'".)
 */
test('api/calendar.js runs as plain Node ESM after the API build', () => {
  const root = path.resolve(import.meta.dirname, '..');
  execFileSync(process.execPath, ['scripts/build-api.mjs'], { cwd: root, stdio: 'pipe' });

  const script = `
    const mod = await import('./api/calendar.js');
    const res = mod.GET(new Request('https://astromoon.ca/api/calendar?tz=UTC&daily=0'));
    const body = await res.text();
    console.log(JSON.stringify({ status: res.status, type: res.headers.get('content-type'), starts: body.slice(0, 15), head: mod.HEAD(new Request('https://astromoon.ca/api/calendar?tz=UTC')).status }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, stdio: 'pipe' }).toString();
  assert.deepEqual(JSON.parse(output.trim()), {
    status: 200,
    type: 'text/calendar; charset=utf-8',
    starts: 'BEGIN:VCALENDAR',
    head: 200,
  });

  const bundle = readFileSync(path.join(root, 'server/dist/calendar.js'), 'utf8');
  assert.doesNotMatch(bundle, /from\s*["']/, 'bundle must not import anything at runtime');
});
