import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { test } = process.env.VITEST ? await import('vitest') : require('node:test');

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));

test('the JSDoc check uses the platform-independent TypeScript runner', () => {
  const source = readFileSync(path.join(scriptRoot, 'check-jsdoc.cjs'), 'utf8');

  assert.match(source, /require\('\.\/typescript-runner\.cjs'\)/u);
  assert.match(source, /runTypeScript\(\['--noEmit', '-p', tsconfigPath\]/u);
  assert.doesNotMatch(source, /node_modules['"], ['"]\.bin['"], ['"]tsc/u);
  assert.doesNotMatch(source, /spawnSync\(tscBin/u);
});
