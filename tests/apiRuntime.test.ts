import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

/**
 * Vercel compiles `api/*.ts` with tsc (not a bundler) and runs the output as
 * native Node ESM because package.json has "type": "module". Node ESM does not
 * resolve extensionless relative imports, so every file reachable from `api/`
 * must import with an explicit `.js` extension. tsx and Vite are lenient about
 * this, so emulate the production path here: emit with tsc, load with node.
 */
test('api/calendar.ts runs as compiled Node ESM (Vercel runtime emulation)', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const out = mkdtempSync(path.join(tmpdir(), 'astromoon-api-'));
  try {
    execFileSync(
      path.join(root, 'node_modules', '.bin', 'tsc'),
      [
        'api/calendar.ts',
        '--outDir', out,
        '--rootDir', root,
        '--module', 'esnext',
        '--moduleResolution', 'bundler',
        '--target', 'es2022',
        '--skipLibCheck',
      ],
      { cwd: root, stdio: 'pipe' }
    );
    writeFileSync(path.join(out, 'package.json'), '{"type":"module"}');
    symlinkSync(path.join(root, 'node_modules'), path.join(out, 'node_modules'), 'dir');

    const script = `
      const mod = await import(${JSON.stringify(path.join(out, 'api', 'calendar.js'))});
      const res = mod.GET(new Request('https://astromoon.ca/api/calendar?tz=UTC&daily=0'));
      const body = await res.text();
      console.log(JSON.stringify({ status: res.status, type: res.headers.get('content-type'), starts: body.slice(0, 15) }));
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: out,
      stdio: 'pipe',
    }).toString();
    assert.deepEqual(JSON.parse(output.trim()), {
      status: 200,
      type: 'text/calendar; charset=utf-8',
      starts: 'BEGIN:VCALENDAR',
    });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
