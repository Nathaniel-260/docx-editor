import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { packSuperDoc } from '../pack-superdoc.mjs';

function withFixture({ orbit }, fn) {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'superdoc-pack-orchestrator-'));
  const publicRoot = orbit ? path.join(repoRoot, 'superdoc', 'public') : repoRoot;
  const v2Root = orbit ? path.join(repoRoot, 'superdoc', 'v2') : path.join(repoRoot, '..', 'v2');
  mkdirSync(path.join(publicRoot, 'packages', 'superdoc'), { recursive: true });
  if (orbit) {
    mkdirSync(path.join(v2Root, 'src', 'superdoc'), { recursive: true });
    writeFileSync(path.join(v2Root, 'src', 'superdoc', 'index.ts'), 'export {}\n');
  }
  try {
    return fn({ repoRoot, publicRoot, v2Root });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('Orbit packing prepares the engine before the public build and sealed pack', () => {
  withFixture({ orbit: true }, ({ repoRoot, publicRoot, v2Root }) => {
    const calls = [];
    const output = packSuperDoc({
      repoRoot,
      publicRoot,
      v2Root,
      spawn: (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return { status: 0 };
      },
    });
    assert.equal(output, path.join(publicRoot, 'packages', 'superdoc', 'superdoc.tgz'));
    assert.deepEqual(calls, [
      { command: 'pnpm', args: ['run', 'prepare:engine'], cwd: repoRoot },
      {
        command: 'pnpm',
        args: ['--prefix', 'packages/superdoc', 'run', 'build:es'],
        cwd: publicRoot,
      },
      {
        command: 'pnpm',
        args: ['--prefix', 'packages/superdoc', 'run', 'pack:sealed'],
        cwd: publicRoot,
      },
    ]);
  });
});

test('standalone public packing uses the installed engine without an Orbit preparation command', () => {
  withFixture({ orbit: false }, ({ repoRoot, publicRoot, v2Root }) => {
    const calls = [];
    packSuperDoc({
      repoRoot,
      publicRoot,
      v2Root,
      spawn: (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return { status: 0 };
      },
    });
    assert.deepEqual(
      calls.map(({ args }) => args),
      [
        ['--prefix', 'packages/superdoc', 'run', 'build:es'],
        ['--prefix', 'packages/superdoc', 'run', 'pack:sealed'],
      ],
    );
  });
});

test('packing stops before public output when engine preparation fails', () => {
  withFixture({ orbit: true }, ({ repoRoot, publicRoot, v2Root }) => {
    let calls = 0;
    assert.throws(
      () =>
        packSuperDoc({
          repoRoot,
          publicRoot,
          v2Root,
          spawn: () => {
            calls += 1;
            return { status: 7 };
          },
        }),
      /engine preparation failed with exit 7/u,
    );
    assert.equal(calls, 1);
  });
});
