#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, { cwd, env, spawn = spawnSync, phase }) {
  const result = spawn(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${phase} failed with exit ${result.status ?? result.signal}`);
  }
}

export function packSuperDoc({
  publicRoot = PUBLIC_ROOT,
  repoRoot = path.resolve(publicRoot, '../..'),
  v2Root = path.resolve(publicRoot, '../v2'),
  env = process.env,
  spawn = spawnSync,
} = {}) {
  const privateEngineSource = path.join(v2Root, 'src', 'superdoc', 'index.ts');
  if (existsSync(privateEngineSource)) {
    run('pnpm', ['run', 'prepare:engine'], {
      cwd: repoRoot,
      env,
      spawn,
      phase: 'engine preparation',
    });
  }

  run('pnpm', ['--prefix', 'packages/superdoc', 'run', 'build:es'], {
    cwd: publicRoot,
    env,
    spawn,
    phase: 'public package build',
  });
  run('pnpm', ['--prefix', 'packages/superdoc', 'run', 'pack:sealed'], {
    cwd: publicRoot,
    env,
    spawn,
    phase: 'sealed public package creation',
  });

  return path.join(publicRoot, 'packages', 'superdoc', 'superdoc.tgz');
}

function isCliEntry() {
  return process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntry()) {
  try {
    const outputPath = packSuperDoc();
    console.log(`[pack-superdoc] wrote ${outputPath}`);
  } catch (error) {
    console.error(`[pack-superdoc] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    process.exitCode = 1;
  }
}
