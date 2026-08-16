import { describe, expect, it, mock } from 'bun:test';
import { DocumentApiValidationError } from '../errors.js';
import { executeCapabilitiesCheck, type CapabilitiesAdapter } from './capabilities.js';
import { normalizeMutationOptions } from '../write/write.js';

describe('capabilities.check public boundary', () => {
  it('validates a closed rich request before delegating to the engine', async () => {
    const result = {
      operation: 'insert' as const,
      format: 'html' as const,
      supported: true,
      outcome: 'preserved' as const,
      evaluatedRevision: 'rev:1',
      wouldChange: false,
      conversion: { format: 'html' as const, lossy: false, diagnostics: [] },
    };
    const check = mock(async () => result);
    const adapter = { get: () => null as never, check } satisfies CapabilitiesAdapter;
    const input = {
      operation: 'insert' as const,
      input: { type: 'html' as const, value: '<p>Safe</p>' },
      options: { changeMode: 'tracked' as const },
    };

    await expect(executeCapabilitiesCheck(adapter, input)).resolves.toEqual(result);
    expect(check).toHaveBeenCalledWith(input);
  });

  it('rejects unrelated operations, plain text, and unknown fields before adapter execution', async () => {
    const check = mock(async () => null as never);
    const adapter = { get: () => null as never, check } satisfies CapabilitiesAdapter;
    for (const input of [
      { operation: 'delete', input: {} },
      { operation: 'insert', input: { type: 'text', value: 'plain' } },
      { operation: 'projectHtml', input: {}, extra: true },
    ]) {
      expect(() => executeCapabilitiesCheck(adapter, input as never)).toThrow(DocumentApiValidationError);
    }
    expect(check).not.toHaveBeenCalled();
  });

  it('rejects an explicit null projection input instead of treating it as the whole document', () => {
    const check = mock(async () => null as never);
    const adapter = { get: () => null as never, check } satisfies CapabilitiesAdapter;

    expect(() =>
      executeCapabilitiesCheck(adapter, {
        operation: 'projectHtml',
        input: null,
      } as never),
    ).toThrow(DocumentApiValidationError);
    expect(check).not.toHaveBeenCalled();
  });

  it('fails with a typed capability error when the engine has no check adapter', () => {
    const adapter = { get: () => null as never } satisfies CapabilitiesAdapter;
    expect(() =>
      executeCapabilitiesCheck(adapter, {
        operation: 'projectMarkdown',
        input: { reviewMode: 'final' },
      }),
    ).toThrow(expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' }));
  });

  it('rejects malformed, wrong-operation, dry-run, and non-rich guard use instead of dropping the guard', () => {
    const guard = {
      version: 'sd-html-markdown-check/1' as const,
      operation: 'insert' as const,
      evaluatedRevision: 'r1',
      requestSha256: 'a'.repeat(64),
      analysisSha256: 'b'.repeat(64),
    };
    expect(() => normalizeMutationOptions({ supportCheck: null } as never, 'insert')).toThrow(
      DocumentApiValidationError,
    );
    expect(() => normalizeMutationOptions({ supportCheck: guard }, 'replace')).toThrow(DocumentApiValidationError);
    expect(() => normalizeMutationOptions({ supportCheck: guard, dryRun: true }, 'insert')).toThrow(
      DocumentApiValidationError,
    );
    expect(() => normalizeMutationOptions({ supportCheck: guard })).toThrow(DocumentApiValidationError);
  });
});
