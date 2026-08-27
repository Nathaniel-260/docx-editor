import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { describe, it } = process.env.VITEST ? await import('vitest') : require('node:test');
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  formatTypeScriptLaunchError,
  runTypeScript,
  typescriptEntry,
} = require('./typescript-runner.cjs');

describe('TypeScript runner', () => {
  it('launches the JavaScript entry through the current Node executable', () => {
    const calls = [];
    const options = { encoding: 'utf8' };
    const result = runTypeScript(['--version'], options, (command, args, spawnOptions) => {
      calls.push({ command, args, options: spawnOptions });
      return { error: undefined, status: 0 };
    });

    assert.equal(result.status, 0);
    assert.equal(typescriptEntry, require.resolve('typescript/bin/tsc', { paths: [packageRoot] }));
    assert.deepEqual(calls, [
      {
        command: process.execPath,
        args: [typescriptEntry, '--version'],
        options,
      },
    ]);
  });

  it('runs the installed TypeScript entry end to end', () => {
    const result = runTypeScript(['--version'], { encoding: 'utf8' });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Version \d+/u);
  });

  it('formats process launch errors before status handling', () => {
    const error = Object.assign(new Error('spawn EINVAL'), { code: 'EINVAL' });

    assert.equal(
      formatTypeScriptLaunchError({ error, status: null }, 'shared/common declarations'),
      'failed to invoke TypeScript for shared/common declarations: spawn EINVAL',
    );
    assert.equal(formatTypeScriptLaunchError({ error: undefined, status: 2 }, 'shared/common declarations'), null);
  });
});
