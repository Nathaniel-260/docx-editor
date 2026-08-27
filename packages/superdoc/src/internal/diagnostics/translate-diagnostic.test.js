import { describe, it, expect } from 'vite-plus/test';
import {
  translateUnzipDiagnostic,
  translateRenderReadinessDiagnostic,
  translateBootFailureReason,
} from './translate-diagnostic.js';

describe('translateUnzipDiagnostic', () => {
  it('maps an error-severity package-integrity code to PARSE_ERROR/unzip', () => {
    const result = translateUnzipDiagnostic({
      code: 'package-not-zip',
      severity: 'error',
      message: 'not a zip',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PARSE_ERROR',
      diagnosticStage: 'unzip',
      severity: 'error',
      internalCode: 'package-not-zip',
    });
    expect(result.error).toBeInstanceOf(Error);
  });

  it('maps an error-severity PKG-payload-* code to PERFORMANCE_ERROR', () => {
    const result = translateUnzipDiagnostic({
      code: 'PKG-payload-zip-entries-exceeded',
      severity: 'error',
      message: 'too many entries',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PERFORMANCE_ERROR',
      diagnosticStage: 'unzip',
    });
  });

  it('promotes the main-document-fallback warn allow-list entry', () => {
    const result = translateUnzipDiagnostic({
      code: 'main-document-fallback',
      severity: 'warn',
      message: 'fell back to a different main document part',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PARSE_ERROR',
      severity: 'warn',
    });
  });

  it('returns null for an info-severity record', () => {
    expect(
      translateUnzipDiagnostic({
        code: 'macros-present',
        severity: 'info',
        message: 'macros present',
      }),
    ).toBeNull();
  });

  it('returns null for a non-allow-listed warn record', () => {
    expect(
      translateUnzipDiagnostic({
        code: 'main-rels-missing',
        severity: 'warn',
        message: 'main rels missing',
      }),
    ).toBeNull();
  });

  it('returns null for internal-only relationship codes below error severity', () => {
    expect(
      translateUnzipDiagnostic({
        code: 'relationship-id-collision',
        severity: 'warn',
        message: 'collision',
      }),
    ).toBeNull();
  });

  it('promotes an internal-only relationship code once it escalates to error', () => {
    const result = translateUnzipDiagnostic({
      code: 'relationship-id-collision',
      severity: 'error',
      message: 'collision',
    });
    expect(result).toMatchObject({ diagnosticCode: 'PARSE_ERROR' });
  });

  it('returns null for a malformed record', () => {
    expect(translateUnzipDiagnostic(null)).toBeNull();
    expect(translateUnzipDiagnostic({ severity: 'error', message: 'no code' })).toBeNull();
  });

  it('carries documentId/editor from context', () => {
    const editor = {};
    const result = translateUnzipDiagnostic(
      { code: 'package-not-zip', severity: 'error', message: 'bad' },
      { documentId: 'doc-1', editor },
    );
    expect(result.documentId).toBe('doc-1');
    expect(result.editor).toBe(editor);
  });
});

describe('translateRenderReadinessDiagnostic', () => {
  it('maps a page-geometry error code to RENDER_ERROR', () => {
    const result = translateRenderReadinessDiagnostic({
      code: 'render.page-geometry.failed',
      reason: 'geometry failed',
      severity: 'error',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      diagnosticStage: 'render',
    });
  });

  it('excludes render.exact-content-hydration-failed as a self-healing rollback, not a real failure', () => {
    // Confirmed by render-surface-persistent-failure-recovery.test.ts: this
    // code fires when an automatic hydration attempt rolls back, but page
    // shells stay mounted/connected and a subsequent repaint succeeds and
    // hydrates. Promoting it would raise a false customer-facing
    // UNSUPPORTED_FEATURE for a transient, already-recovered condition.
    expect(
      translateRenderReadinessDiagnostic({
        code: 'render.exact-content-hydration-failed',
        reason: 'exact content hydration rolled back for generation 4, pages [2, 3]',
        severity: 'warn',
      }),
    ).toBeNull();
    // Excluded regardless of severity -- it's excluded by code, not by the
    // severity gate.
    expect(
      translateRenderReadinessDiagnostic({
        code: 'render.exact-content-hydration-failed',
        reason: 'hydration failed',
        severity: 'error',
      }),
    ).toBeNull();
  });

  it('maps the real warn-severity page-geometry.failed code to RENDER_ERROR', () => {
    // render-readiness.ts emits this at severity 'warn', not 'error' -- must
    // not be filtered out before classification.
    const result = translateRenderReadinessDiagnostic({
      code: 'render.page-geometry.failed',
      reason: 'page geometry could not be resolved: source coverage failed/cancelled',
      severity: 'warn',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      diagnosticStage: 'render',
      severity: 'warn',
    });
  });

  it('maps the real warn-severity section-metadata.failed code to RENDER_ERROR', () => {
    const result = translateRenderReadinessDiagnostic({
      code: 'render.section-metadata.failed',
      reason: 'section identity metadata could not be resolved from source signals',
      severity: 'warn',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      severity: 'warn',
    });
  });

  it('maps the real warn-severity page-furniture.failed code to RENDER_ERROR', () => {
    const result = translateRenderReadinessDiagnostic({
      code: 'render.page-furniture.failed',
      reason: 'page furniture (headers/footers) could not be resolved',
      severity: 'warn',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      severity: 'warn',
    });
  });

  it('maps the warn-severity render.provider-error code to RENDER_ERROR', () => {
    // Confirmed by manual testing: fired from the onPageFurnitureDiagnostic
    // pathway (render-surface.ts) at severity 'warn', not 'error' -- a
    // genuine render pipeline failure, distinct from the markPage*/
    // markSectionMetadataStatus pathway above.
    const result = translateRenderReadinessDiagnostic({
      code: 'render.provider-error',
      reason: 'projectBodyWindow failed: signal is aborted without reason',
      severity: 'warn',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      diagnosticStage: 'render',
      severity: 'warn',
    });
  });

  it('keeps pipeline.* codes internal (retry/resume heuristics, not customer-facing failures)', () => {
    expect(
      translateRenderReadinessDiagnostic({
        code: 'pipeline.compose-resume-fallback',
        reason: 'resume-seed-rejected-unproved-exact-commit',
        severity: 'warn',
      }),
    ).toBeNull();
  });

  it('does not promote an info-severity page-geometry status', () => {
    expect(
      translateRenderReadinessDiagnostic({
        code: 'render.page-geometry.default-fallback',
        reason: 'page geometry is using mount defaults',
        severity: 'info',
      }),
    ).toBeNull();
  });

  it('maps a degraded warn code to PERFORMANCE_ERROR', () => {
    const result = translateRenderReadinessDiagnostic({
      code: 'render.scheduler-degraded',
      reason: 'scheduler degraded',
      severity: 'warn',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PERFORMANCE_ERROR',
      severity: 'warn',
    });
  });

  it('reclassifies a retained-state invariant violation under engine-pass-degraded as RENDER_ERROR', () => {
    // Confirmed real case: retained-state.ts throws a defensive invariant
    // assertion (id collision), which emitEnginePassFailure passes through
    // verbatim as the degraded reason. This is a correctness bug, not a
    // performance condition.
    const result = translateRenderReadinessDiagnostic({
      code: 'render.engine-pass-degraded',
      reason:
        'initial-render: engine pass failed (retained-state-recording-failed): retained state recording failed at snapshotComplete: retained body block id collision: 0/section-break/67/o0',
      severity: 'warn',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      diagnosticStage: 'render',
      internalCode: 'render.engine-pass-degraded',
    });
  });

  it('reclassifies the same invariant violation once wrapped by the scheduler retry-count prefix', () => {
    // The scheduler wraps the inner reason with "canonical render failed N
    // consecutive times: ..." before reporting render.scheduler-degraded --
    // the retained-state.ts vocabulary must still be detected through that
    // wrapping.
    const result = translateRenderReadinessDiagnostic({
      code: 'render.scheduler-degraded',
      reason:
        'canonical render failed 2 consecutive times: canonical engine pass initial-render failed (retained-state-recording-failed): retained state recording failed at snapshotComplete: retained body block id collision: 0/section-break/67/o0',
      severity: 'error',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      diagnosticStage: 'render',
      internalCode: 'render.scheduler-degraded',
    });
  });

  it('keeps a genuine timeout/watchdog degraded reason as PERFORMANCE_ERROR', () => {
    const result = translateRenderReadinessDiagnostic({
      code: 'render.scheduler-degraded',
      reason: 'current unpainted target reached 1200ms (limit 1000ms)',
      severity: 'error',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PERFORMANCE_ERROR',
      diagnosticStage: 'render',
    });
  });

  it('falls back to RENDER_ERROR for an unrecognized error-severity code', () => {
    const result = translateRenderReadinessDiagnostic({
      code: 'render.some-new-failure',
      reason: 'unknown',
      severity: 'error',
    });
    expect(result).toMatchObject({ diagnosticCode: 'RENDER_ERROR' });
  });

  it('returns null for a non-degraded warn code', () => {
    expect(
      translateRenderReadinessDiagnostic({ code: 'render.some-notice', reason: 'fyi', severity: 'warn' }),
    ).toBeNull();
  });

  it('returns null for an info-severity diagnostic', () => {
    expect(
      translateRenderReadinessDiagnostic({ code: 'render.some-info', reason: 'fyi', severity: 'info' }),
    ).toBeNull();
  });

  it('returns null for a malformed diagnostic', () => {
    expect(translateRenderReadinessDiagnostic(null)).toBeNull();
    expect(translateRenderReadinessDiagnostic({ severity: 'error' })).toBeNull();
  });
});

describe('translateBootFailureReason', () => {
  it('maps the open-failed reason to PARSE_ERROR/unzip', () => {
    const result = translateBootFailureReason('open-failed', 'corrupt zip');
    expect(result).toMatchObject({
      diagnosticCode: 'PARSE_ERROR',
      diagnosticStage: 'unzip',
      internalCode: 'open-failed',
    });
  });

  it('excludes worker-init-failed from the taxonomy', () => {
    expect(translateBootFailureReason('worker-init-failed', 'worker crashed')).toBeNull();
  });

  it('maps source-load-failed to PARSE_ERROR/unzip', () => {
    // Confirmed by manual testing: readiness.readiness === 'blocked' (which
    // is what produces this reason) is set exclusively for a hard
    // package-invariant failure or a non-zip container -- a genuine unzip
    // failure, not a transport issue.
    const result = translateBootFailureReason('source-load-failed', 'host-readiness=blocked');
    expect(result).toMatchObject({
      diagnosticCode: 'PARSE_ERROR',
      diagnosticStage: 'unzip',
      internalCode: 'source-load-failed',
    });
  });

  it('excludes collaboration and other unrelated boot reasons', () => {
    expect(translateBootFailureReason('collaboration-room-corrupt', 'room corrupt')).toBeNull();
    expect(translateBootFailureReason('input-too-large-for-inline-review', 'too large')).toBeNull();
    expect(translateBootFailureReason('v2-integration-unavailable', 'stub')).toBeNull();
    expect(translateBootFailureReason('dispose-failed', 'disposed')).toBeNull();
  });

  it('classifies by bootErrorName, taking precedence over reason', () => {
    // Reason is hardcoded to 'open-failed' at the real catch sites even when
    // the underlying error is a render-path failure — bootErrorName must win.
    const result = translateBootFailureReason('open-failed', 'no progress', {
      bootErrorName: 'OpenRenderNoProgressError',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PERFORMANCE_ERROR',
      diagnosticStage: 'render',
      internalCode: 'OpenRenderNoProgressError',
    });
  });

  it('classifies BoundedLocalPageCapError as PERFORMANCE_ERROR', () => {
    const result = translateBootFailureReason('open-failed', 'page cap hit', {
      bootErrorName: 'BoundedLocalPageCapError',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PERFORMANCE_ERROR',
      diagnosticStage: 'render',
    });
  });

  it('classifies MountedEnginePassInterrupt as RENDER_ERROR', () => {
    const result = translateBootFailureReason('open-failed', 'pass interrupted', {
      bootErrorName: 'MountedEnginePassInterrupt',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'RENDER_ERROR',
      diagnosticStage: 'render',
    });
  });

  it('ignores an unrecognized bootErrorName and falls back to reason-based classification', () => {
    const result = translateBootFailureReason('open-failed', 'detail', {
      bootErrorName: 'SomeOtherError',
    });
    expect(result).toMatchObject({
      diagnosticCode: 'PARSE_ERROR',
      diagnosticStage: 'unzip',
      internalCode: 'open-failed',
    });
  });

  it('carries documentId/editor from context', () => {
    const editor = {};
    const result = translateBootFailureReason('open-failed', 'corrupt', {
      documentId: 'doc-1',
      editor,
    });
    expect(result.documentId).toBe('doc-1');
    expect(result.editor).toBe(editor);
  });
});
