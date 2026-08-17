import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vite-plus/test';
import {
  applyCompareWithWs09Fallback,
  captureCompareApplyDebugSnapshot,
  compareApplyDeferredMessage,
  isWs09TrackedCompareDeferred,
  settleCompareApplyPaint,
} from './compare-apply';

describe('dev compare apply fallback', () => {
  it('awaits the asynchronous host comparison before checking its summary', () => {
    const testDirectory = dirname(fileURLToPath(import.meta.url));
    const devAppSource = readFileSync(resolve(testDirectory, 'components/SuperdocDev.vue'), 'utf8');

    expect(devAppSource).toContain('const diff = await liveCompareDocApi.diff.compare({ targetSnapshot });');
  });

  it('keeps tracked compare apply when an asynchronous host facade succeeds', async () => {
    const apply = vi.fn(async () => ({ appliedOperations: 3, diagnostics: [] }));
    const outcome = await applyCompareWithWs09Fallback({ diff: { apply } }, { id: 'diff' });

    expect(outcome.changeMode).toBe('tracked');
    expect(outcome.fallbackFromTracked).toBe(false);
    expect(outcome.applyResult.appliedOperations).toBe(3);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenNthCalledWith(1, { diff: { id: 'diff' } }, { changeMode: 'tracked' });
  });

  it('falls back to direct compare apply for asynchronous ws09 tracked deferral', async () => {
    const deferredError = Object.assign(
      new Error('compare-apply-deferred (ws09): table topology changes are detected'),
      { code: 'CAPABILITY_UNSUPPORTED' },
    );
    const apply = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw deferredError;
      })
      .mockImplementationOnce(async () => ({
        appliedOperations: 5,
        diagnostics: ['body: applied 2 safe operation(s)'],
      }));

    const outcome = await applyCompareWithWs09Fallback({ diff: { apply } }, { id: 'diff' });

    expect(outcome.changeMode).toBe('direct');
    expect(outcome.fallbackFromTracked).toBe(true);
    expect(outcome.applyResult.appliedOperations).toBe(5);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenNthCalledWith(1, { diff: { id: 'diff' } }, { changeMode: 'tracked' });
    expect(apply).toHaveBeenNthCalledWith(2, { diff: { id: 'diff' } }, { changeMode: 'direct' });
  });

  it('prefers direct compare apply for ws09 deferred table topology diffs before tracked apply can partially succeed', async () => {
    const apply = vi.fn(() => ({ appliedOperations: 6, diagnostics: [] }));
    const diff = {
      payload: {
        familyPolicy: [
          { family: 'body', disposition: 'deferred', changed: true, applyRequired: true },
          { family: 'tables', disposition: 'deferred', changed: true, applyRequired: true },
        ],
        mainDocument: {
          target: { xml: '<w:document><w:body><w:tbl/></w:body></w:document>' },
        },
      },
    };

    const outcome = await applyCompareWithWs09Fallback({ diff: { apply } }, diff);

    expect(outcome.changeMode).toBe('direct');
    expect(outcome.fallbackFromTracked).toBe(true);
    expect(outcome.applyResult.appliedOperations).toBe(6);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ diff }, { changeMode: 'direct' });
  });

  it('fails closed when ws07 visual families block a ws09 table topology apply', async () => {
    const ws07Error = Object.assign(
      new Error(
        'diff.apply: full diff apply cannot safely replay changed families ' +
          '[sections (deferred: compare-apply-deferred (ws07)); ' +
          'settings (deferred: compare-apply-deferred (ws07)); ' +
          'theme (deferred: compare-apply-deferred (ws07))] in this build.',
      ),
      { code: 'CAPABILITY_UNSUPPORTED' },
    );
    const diff = {
      payload: {
        analysis: {
          families: [
            { family: 'body', state: 'changed-supported' },
            { family: 'tables', state: 'changed-supported' },
            { family: 'sections', state: 'changed-supported' },
            { family: 'settings', state: 'changed-supported' },
            { family: 'theme', state: 'changed-supported' },
          ],
        },
        semanticAnalysis: {
          familyDeltas: [
            { family: 'body', detectedChange: true },
            { family: 'tables', detectedChange: true },
            { family: 'sections', detectedChange: true },
            { family: 'settings', detectedChange: true },
            { family: 'theme', detectedChange: true },
          ],
        },
        familyPolicy: [
          { family: 'body', disposition: 'deferred', changed: true, applyRequired: true },
          { family: 'tables', disposition: 'deferred', changed: true, applyRequired: true },
        ],
        mainDocument: {
          target: { xml: '<w:document><w:body><w:tbl/></w:body></w:document>' },
        },
      },
    };
    const apply = vi.fn(() => {
      throw ws07Error;
    });

    await expect(applyCompareWithWs09Fallback({ diff: { apply } }, diff)).rejects.toBe(ws07Error);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ diff }, { changeMode: 'direct' });
  });

  it('rethrows non-ws09 compare apply failures', async () => {
    const error = Object.assign(new Error('boom'), { code: 'PRECONDITION_FAILED' });
    const apply = vi.fn(() => {
      throw error;
    });

    await expect(applyCompareWithWs09Fallback({ diff: { apply } }, { id: 'diff' })).rejects.toThrow(error);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('recognizes the ws09 tracked deferral message', () => {
    const error = Object.assign(
      new Error('diff.apply: compare-apply-deferred (ws09): table topology changes are detected'),
      { code: 'CAPABILITY_UNSUPPORTED' },
    );

    expect(isWs09TrackedCompareDeferred(error)).toBe(true);
    expect(compareApplyDeferredMessage(error)).toContain('retried the same diff in direct mode');
  });

  it('awaits mutation readiness paint when the active editor exposes it', async () => {
    const whenPainted = vi.fn(async () => undefined);

    await settleCompareApplyPaint({
      diff: { apply: vi.fn() },
      documentMutationReadiness: { whenPainted },
    });

    expect(whenPainted).toHaveBeenCalledTimes(1);
    expect(whenPainted).toHaveBeenCalledWith();
  });

  it('noops when mutation readiness is unavailable', async () => {
    await expect(settleCompareApplyPaint({ diff: { apply: vi.fn() } })).resolves.toBeUndefined();
  });

  it('captures debug snapshot from doc text, mounted projection, and render readiness', () => {
    const hostDoc = { getText: vi.fn(() => 'alpha beta') };
    const snapshot = captureCompareApplyDebugSnapshot({
      diff: {
        apply: vi.fn(),
      },
      doc: hostDoc,
      host: {
        readMountedProjectionBlocks: vi.fn(() => [{ kind: 'paragraph' }, { kind: 'table' }, { kind: 'table' }]),
        getRenderReadinessSnapshot: vi.fn(() => ({ renderStage: 'render-complete' })),
        getDocumentFacade: vi.fn(() => ({ available: true as const, doc: hostDoc })),
      },
    });

    expect(snapshot).toEqual({
      textLength: 'alpha beta'.length,
      hostFacadeTextLength: 'alpha beta'.length,
      projectionBlockCount: 3,
      projectionTableCount: 2,
      renderStage: 'render-complete',
      hostFacadeMatchesEditorDoc: true,
    });
  });
});
