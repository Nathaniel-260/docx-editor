import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  BUILD_TIMING_SCHEMA,
  intervalUnionMs,
  startBuildTiming,
  validateBuildTimingPayload,
} from '../superdoc-build-timing.mjs';

test('records monotonic outer and stage spans and validates', async () => {
  const timing = startBuildTiming({ target: 'engine', command: 'test engine build' });
  await timing.stage('clean', async () => {});
  const parent = timing.startStage('raw', { label: 'raw surfaces' });
  await timing.stage('raw/vite', { parentId: 'raw' }, async () => {});
  parent.end({ verdict: 'ok' });
  const payload = timing.finalize({ status: 'ok' });

  assert.equal(payload.schema, BUILD_TIMING_SCHEMA);
  assert.equal(payload.status, 'ok');
  assert.ok(payload.outerDurationMs >= 0);
  assert.equal(payload.stages.length, 3);
  const child = payload.stages.find((stage) => stage.id === 'raw/vite');
  assert.equal(child.parentId, 'raw');
  assert.equal(child.verdict, 'ok');
  validateBuildTimingPayload(payload);
});

test('failed stages and open stages are preserved as failed/incomplete', async () => {
  const timing = startBuildTiming({ target: 'public', command: 'test public build' });
  timing.startStage('never-ends');
  await assert.rejects(
    timing.stage('explodes', async () => {
      throw new Error('boom');
    }),
    /boom/,
  );
  const payload = timing.finalize({ status: 'failed' });
  assert.equal(payload.status, 'failed');
  assert.equal(payload.stages.find((stage) => stage.id === 'explodes').verdict, 'failed');
  assert.equal(payload.stages.find((stage) => stage.id === 'never-ends').verdict, 'incomplete');
  validateBuildTimingPayload(payload);
});

test('obfuscation transforms produce the task-partition summary', () => {
  const timing = startBuildTiming({ target: 'engine', command: 'test transforms' });
  timing.addTransform({
    path: 'docx-engine.es.js',
    target: 'browser-no-eval',
    queuedAtOffsetMs: 0,
    startedAtOffsetMs: 5,
    finishedAtOffsetMs: 3005,
    inputBytes: 1000,
    outputBytes: 1500,
    cache: { disposition: 'recomputed' },
  });
  timing.addTransform({
    path: 'assets/browser-worker-entry-abc.js',
    target: 'service-worker',
    queuedAtOffsetMs: 0,
    startedAtOffsetMs: 1,
    finishedAtOffsetMs: 501,
    inputBytes: 200,
    outputBytes: 300,
    cache: { disposition: 'recomputed' },
  });
  const payload = timing.finalize({ status: 'ok', transformStage: { concurrency: 3, stageWallMs: 3200 } });
  const summary = payload.summary.obfuscation;
  assert.equal(summary.transformCount, 2);
  assert.equal(summary.concurrency, 3);
  assert.equal(summary.longestTransform.path, 'docx-engine.es.js');
  assert.match(summary.longestTransform.note, /task-partition lower bound/);
  assert.match(summary.longestTransform.note, /not an irreducible algorithmic floor/);
  assert.equal(summary.sumTransformDurationsMs, 3500);
  assert.equal(summary.idealizedLowerBoundMs, 3000);
  validateBuildTimingPayload(payload);
});

test('payload write is deterministic-shaped and hashable', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sd-build-timing-'));
  try {
    const timing = startBuildTiming({ target: 'pack', command: 'test pack' });
    const { filePath, sha256, payload } = timing.write(path.join(dir, 'timing.json'), { status: 'ok' });
    assert.ok(filePath.endsWith('timing.json'));
    assert.match(sha256, /^[0-9a-f]{64}$/);
    const onDisk = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.deepEqual(onDisk, payload);
    validateBuildTimingPayload(onDisk);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validation rejects duplicate stage ids, bad cache dispositions, and missing schema', () => {
  const timing = startBuildTiming({ target: 'verify', command: 'test verify' });
  const payload = timing.finalize({ status: 'ok' });
  assert.throws(() => validateBuildTimingPayload({ ...payload, schema: 'other' }), /schema/);
  const dupe = {
    ...payload,
    stages: [
      { id: 'a', parentId: null, verdict: 'ok', cache: { disposition: 'recomputed' }, startOffsetMs: 0, durationMs: 1 },
      { id: 'a', parentId: null, verdict: 'ok', cache: { disposition: 'recomputed' }, startOffsetMs: 0, durationMs: 1 },
    ],
  };
  assert.throws(() => validateBuildTimingPayload(dupe), /duplicate stage id/);
  const badCache = {
    ...payload,
    stages: [{ id: 'a', parentId: null, verdict: 'ok', cache: { disposition: 'warmish' }, startOffsetMs: 0, durationMs: 1 }],
  };
  assert.throws(() => validateBuildTimingPayload(badCache), /cache disposition/);
});

test('interval union merges overlap for the residual estimate', () => {
  assert.equal(
    intervalUnionMs([
      { startOffsetMs: 0, durationMs: 10 },
      { startOffsetMs: 5, durationMs: 10 },
      { startOffsetMs: 30, durationMs: 5 },
    ]),
    20,
  );
});

test('invalid targets and commands are rejected at start', () => {
  assert.throws(() => startBuildTiming({ target: 'nonsense', command: 'x' }), /timing target/);
  assert.throws(() => startBuildTiming({ target: 'engine', command: '' }), /command identity/);
});
