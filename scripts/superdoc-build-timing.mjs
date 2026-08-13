// superdoc-build-timing.mjs - the one versioned build-timing evidence payload.
//
// Schema `superdoc-build-timing.v1` is the single timing format shared by the
// direct public build, the engine (private V2) producer, the CI candidate, and
// pack/release commands. A payload records monotonic outer and stage spans plus
// per-raw-obfuscation-transform spans, and is bound into the existing
// receipt/evidence protocol by reference and hash. Timing is evidence about a
// run; it is never part of stable artifact byte identity and must never be
// written into a sealed dist root.
//
// Design constraints (build-pipeline redesign plan, Release 0a):
// - Durations come from a monotonic clock; ISO timestamps are correlation-only.
// - Failed commands still emit a payload, marked failed, with incomplete
//   stages marked incomplete rather than dropped.
// - Cache dispositions use a closed vocabulary so hits and recomputation are
//   distinguishable across runs.
// - The longest raw obfuscation transform is reported as the CURRENT
//   task-partition lower bound, never as an irreducible algorithmic floor.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

export const BUILD_TIMING_SCHEMA = 'superdoc-build-timing.v1';
export const BUILD_TIMING_CLOCK_METHOD = 'node:perf_hooks/performance.now';
export const BUILD_TIMING_FILE_ENV = 'SUPERDOC_BUILD_TIMING_FILE';

// Stable command-target vocabulary. `engine` is the private V2 producer,
// `public` the public superdoc producer, `candidate` the integrated CI
// candidate, `protection` a standalone obfuscation/hardening run, and
// `pack`/`release`/`verify` the packaging, release-derivation, and
// verification commands.
export const BUILD_TIMING_TARGETS = Object.freeze([
  'engine',
  'public',
  'candidate',
  'protection',
  'pack',
  'release',
  'verify',
  'benchmark',
]);

// Closed cache-disposition vocabulary. `recomputed` means the work ran with no
// cache in play; `hit`/`miss` describe an actual cache lookup; `bypassed`
// means a cache existed but was deliberately not consulted.
export const CACHE_DISPOSITIONS = Object.freeze(['recomputed', 'hit', 'miss', 'bypassed', 'not-applicable']);

export const STAGE_VERDICTS = Object.freeze(['ok', 'failed', 'incomplete']);

const TASK_PARTITION_NOTE =
  'current task-partition lower bound for the observed schedule; not an irreducible algorithmic floor';

function assertOneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')}; got ${JSON.stringify(value)}`);
  }
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Merge possibly-overlapping [start, end] spans and return total covered time.
 * Used for the coarse unexplained-residual estimate over top-level stages.
 */
export function intervalUnionMs(spans) {
  const sorted = spans
    .filter((span) => Number.isFinite(span.startOffsetMs) && Number.isFinite(span.durationMs))
    .map((span) => [span.startOffsetMs, span.startOffsetMs + span.durationMs])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursorEnd = -Infinity;
  for (const [start, end] of sorted) {
    if (end <= cursorEnd) continue;
    total += end - Math.max(start, cursorEnd);
    cursorEnd = end;
  }
  return total;
}

/**
 * Start a timing recorder for one command invocation.
 *
 * @param {object} params
 * @param {string} params.target one of BUILD_TIMING_TARGETS
 * @param {string} params.command the user-visible command identity (e.g. "pnpm run build:engine")
 * @param {string[]} [params.argv]
 * @param {object} [params.meta] free-form correlation metadata (never bytes-identity input)
 */
export function startBuildTiming({ target, command, argv = [], meta = {} }) {
  assertOneOf(target, BUILD_TIMING_TARGETS, 'timing target');
  if (typeof command !== 'string' || command.length === 0) {
    throw new Error('timing command identity is required');
  }

  const startedAtIso = new Date().toISOString();
  const originMs = performance.now();
  const stages = [];
  const openStages = new Map();
  const transforms = [];
  let nextStageOrdinal = 0;
  let finalized = null;

  function now() {
    return performance.now() - originMs;
  }

  /** Translate an absolute performance.now() value into a recorder offset. */
  function toOffset(absolutePerfMs) {
    return absolutePerfMs - originMs;
  }

  function startStage(id, { parentId = null, label = id, command: stageCommand = null, cache = null } = {}) {
    if (finalized) throw new Error(`cannot start stage ${id} after finalize`);
    if (openStages.has(id)) throw new Error(`stage id already open: ${id}`);
    if (stages.some((stage) => stage.id === id)) throw new Error(`stage id already used: ${id}`);
    if (cache) assertOneOf(cache.disposition, CACHE_DISPOSITIONS, `stage ${id} cache disposition`);
    const record = {
      id,
      parentId,
      label,
      ordinal: nextStageOrdinal++,
      startOffsetMs: round(now()),
      durationMs: null,
      verdict: 'incomplete',
      command: stageCommand,
      cache: cache ?? { disposition: 'not-applicable' },
      io: null,
      error: null,
    };
    stages.push(record);
    openStages.set(id, record);
    return {
      end({ verdict = 'ok', io = null, cache: endCache = null, error = null } = {}) {
        assertOneOf(verdict, STAGE_VERDICTS, `stage ${id} verdict`);
        if (!openStages.delete(id)) throw new Error(`stage not open: ${id}`);
        record.durationMs = round(now() - record.startOffsetMs);
        record.verdict = verdict;
        if (io) record.io = io;
        if (endCache) {
          assertOneOf(endCache.disposition, CACHE_DISPOSITIONS, `stage ${id} cache disposition`);
          record.cache = endCache;
        }
        if (error) record.error = String(error?.message ?? error);
        return record;
      },
    };
  }

  /** Run `fn` inside a stage span; failures mark the stage failed and rethrow. */
  async function stage(id, options, fn) {
    if (typeof options === 'function') {
      fn = options;
      options = {};
    }
    const handle = startStage(id, options);
    try {
      const result = await fn();
      handle.end({ verdict: 'ok', io: result?.timingIo ?? null, cache: result?.timingCache ?? null });
      return result;
    } catch (error) {
      handle.end({ verdict: 'failed', error });
      throw error;
    }
  }

  /**
   * Record one raw obfuscation transform span. Offsets are milliseconds from
   * the recorder origin; callers translate their own clocks with `originNowMs`.
   */
  function addTransform({
    path: relativePath,
    target: transformTarget,
    queuedAtOffsetMs,
    startedAtOffsetMs,
    finishedAtOffsetMs,
    inputBytes,
    outputBytes,
    inputSha256 = null,
    cache = { disposition: 'recomputed' },
    destinations = 1,
  }) {
    assertOneOf(cache.disposition, CACHE_DISPOSITIONS, `transform ${relativePath} cache disposition`);
    transforms.push({
      path: relativePath,
      target: transformTarget,
      queuedAtOffsetMs: round(queuedAtOffsetMs),
      startedAtOffsetMs: round(startedAtOffsetMs),
      finishedAtOffsetMs: round(finishedAtOffsetMs),
      durationMs: round(finishedAtOffsetMs - startedAtOffsetMs),
      schedulerDelayMs: round(startedAtOffsetMs - queuedAtOffsetMs),
      inputBytes,
      outputBytes,
      inputSha256,
      cache,
      destinations,
    });
  }

  function summarize(outerDurationMs, transformStage) {
    const topLevel = stages.filter((stageRecord) => stageRecord.parentId === null && stageRecord.durationMs !== null);
    const explainedMs = intervalUnionMs(topLevel);
    const summary = {
      stageCount: stages.length,
      topStagesByDuration: [...stages]
        .filter((stageRecord) => stageRecord.durationMs !== null)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 5)
        .map(({ id, durationMs }) => ({ id, durationMs })),
      explainedTopLevelMs: round(explainedMs),
      unexplainedResidualMs: round(Math.max(0, outerDurationMs - explainedMs)),
    };
    if (transforms.length > 0) {
      const durations = transforms.map((transform) => transform.durationMs);
      const longest = transforms.reduce((best, transform) => (transform.durationMs > best.durationMs ? transform : best));
      const sumDurations = durations.reduce((total, duration) => total + duration, 0);
      const concurrency = transformStage?.concurrency ?? null;
      summary.obfuscation = {
        transformCount: transforms.length,
        concurrency,
        stageWallMs: transformStage?.stageWallMs ?? null,
        sumTransformDurationsMs: round(sumDurations),
        idealizedLowerBoundMs:
          concurrency && concurrency > 0
            ? round(Math.max(longest.durationMs, sumDurations / concurrency))
            : null,
        maxSchedulerDelayMs: round(Math.max(...transforms.map((transform) => transform.schedulerDelayMs))),
        sumSchedulerDelayMs: round(
          transforms.reduce((total, transform) => total + transform.schedulerDelayMs, 0),
        ),
        totalInputBytes: transforms.reduce((total, transform) => total + (transform.inputBytes ?? 0), 0),
        totalOutputBytes: transforms.reduce((total, transform) => total + (transform.outputBytes ?? 0), 0),
        longestTransform: {
          path: longest.path,
          durationMs: longest.durationMs,
          inputBytes: longest.inputBytes,
          note: TASK_PARTITION_NOTE,
        },
      };
    }
    return summary;
  }

  /**
   * Close the payload. Open stages are marked incomplete; a failed/incomplete
   * status is preserved so partial evidence from failed builds stays usable.
   */
  function finalize({ status = 'ok', transformStage = null, resources = null } = {}) {
    assertOneOf(status, STAGE_VERDICTS.map((verdict) => (verdict === 'incomplete' ? 'incomplete' : verdict)), 'payload status');
    if (finalized) return finalized;
    const outerDurationMs = round(now());
    for (const record of openStages.values()) {
      record.durationMs = round(now() - record.startOffsetMs);
      record.verdict = 'incomplete';
    }
    openStages.clear();
    finalized = {
      schema: BUILD_TIMING_SCHEMA,
      clock: { method: BUILD_TIMING_CLOCK_METHOD, unit: 'ms' },
      target,
      command,
      argv,
      meta,
      startedAtIso,
      finishedAtIso: new Date().toISOString(),
      outerDurationMs,
      status,
      stages,
      transforms,
      resources: resources ?? { cpu: 'unavailable', peakRss: 'unavailable' },
      summary: summarize(outerDurationMs, transformStage),
    };
    return finalized;
  }

  function write(filePath, options = {}) {
    const payload = finalized ?? finalize(options);
    const resolved = filePath ?? process.env[BUILD_TIMING_FILE_ENV];
    if (!resolved) return { payload, filePath: null, sha256: sha256Json(payload) };
    mkdirSync(path.dirname(resolved), { recursive: true });
    const rendered = `${JSON.stringify(payload, null, 2)}\n`;
    writeFileSync(resolved, rendered);
    return { payload, filePath: resolved, sha256: createHash('sha256').update(rendered).digest('hex') };
  }

  return { startStage, stage, addTransform, finalize, write, now, toOffset };
}

export function sha256Json(payload) {
  return createHash('sha256').update(`${JSON.stringify(payload, null, 2)}\n`).digest('hex');
}

/**
 * Validate a superdoc-build-timing.v1 payload. Throws with an exact reason.
 * Used by receipt binding and by consumers before trusting timing evidence.
 */
export function validateBuildTimingPayload(payload) {
  if (payload?.schema !== BUILD_TIMING_SCHEMA) {
    throw new Error(`timing payload schema must be ${BUILD_TIMING_SCHEMA}`);
  }
  if (payload.clock?.method !== BUILD_TIMING_CLOCK_METHOD || payload.clock?.unit !== 'ms') {
    throw new Error('timing payload clock method/unit is not the supported monotonic clock');
  }
  assertOneOf(payload.target, BUILD_TIMING_TARGETS, 'timing target');
  assertOneOf(payload.status, STAGE_VERDICTS, 'timing status');
  if (typeof payload.command !== 'string' || payload.command.length === 0) {
    throw new Error('timing payload command identity missing');
  }
  if (!Number.isFinite(payload.outerDurationMs) || payload.outerDurationMs < 0) {
    throw new Error('timing payload outerDurationMs must be a non-negative number');
  }
  if (!Array.isArray(payload.stages)) throw new Error('timing payload stages must be an array');
  const ids = new Set();
  for (const stage of payload.stages) {
    if (typeof stage.id !== 'string' || stage.id.length === 0) throw new Error('stage id missing');
    if (ids.has(stage.id)) throw new Error(`duplicate stage id: ${stage.id}`);
    ids.add(stage.id);
    if (stage.parentId !== null && !ids.has(stage.parentId)) {
      throw new Error(`stage ${stage.id} references unknown parent ${stage.parentId}`);
    }
    assertOneOf(stage.verdict, STAGE_VERDICTS, `stage ${stage.id} verdict`);
    assertOneOf(stage.cache?.disposition, CACHE_DISPOSITIONS, `stage ${stage.id} cache disposition`);
    if (!Number.isFinite(stage.startOffsetMs) || stage.startOffsetMs < 0) {
      throw new Error(`stage ${stage.id} startOffsetMs invalid`);
    }
    if (stage.durationMs !== null && (!Number.isFinite(stage.durationMs) || stage.durationMs < 0)) {
      throw new Error(`stage ${stage.id} durationMs invalid`);
    }
  }
  if (!Array.isArray(payload.transforms)) throw new Error('timing payload transforms must be an array');
  for (const transform of payload.transforms) {
    if (typeof transform.path !== 'string') throw new Error('transform path missing');
    assertOneOf(transform.cache?.disposition, CACHE_DISPOSITIONS, `transform ${transform.path} cache disposition`);
    for (const field of ['queuedAtOffsetMs', 'startedAtOffsetMs', 'finishedAtOffsetMs', 'durationMs']) {
      if (!Number.isFinite(transform[field])) throw new Error(`transform ${transform.path} ${field} invalid`);
    }
  }
  if (payload.summary?.obfuscation && payload.summary.obfuscation.longestTransform?.note !== TASK_PARTITION_NOTE) {
    throw new Error('obfuscation summary must label the longest transform as the current task-partition lower bound');
  }
  return true;
}
