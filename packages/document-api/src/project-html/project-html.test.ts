import { describe, expect, it, mock } from 'bun:test';
import { DocumentApiValidationError } from '../errors.js';
import { executeProjectHtml, type ProjectHtmlAdapter } from './project-html.js';

const RESULT = {
  format: 'html',
  content: '<p>Hello</p>',
  status: 'success',
  reviewMode: 'final',
  evaluatedRevision: 'revision:1',
  story: { kind: 'story', storyType: 'body' },
  scope: { kind: 'story' },
  lossy: false,
  diagnostics: [],
  blocks: [],
  annotations: [],
} as const;

describe('executeProjectHtml', () => {
  it('validates and delegates a detailed projection read', async () => {
    const adapter: ProjectHtmlAdapter = { projectHtml: mock(async () => RESULT) };
    const input = { reviewMode: 'redline', includeSourceMap: true } as const;
    await expect(executeProjectHtml(adapter, input)).resolves.toBe(RESULT);
    expect(adapter.projectHtml).toHaveBeenCalledWith(input);
  });

  it('fails with a typed error when the adapter is unavailable', () => {
    expect(() => executeProjectHtml(undefined, {})).toThrow(DocumentApiValidationError);
    try {
      executeProjectHtml(undefined, {});
    } catch (error) {
      expect((error as DocumentApiValidationError).code).toBe('CAPABILITY_UNAVAILABLE');
    }
  });

  it('rejects invalid detailed inputs before delegation', () => {
    const adapter: ProjectHtmlAdapter = { projectHtml: mock(async () => RESULT) };
    expect(() => executeProjectHtml(adapter, { includeSourceMap: 'yes' } as any)).toThrow(/boolean/);
    expect(() => executeProjectHtml(adapter, { reviewMode: 'markup' } as any)).toThrow(/reviewMode/);
    expect(() => executeProjectHtml(adapter, { scope: { kind: 'block', nodeId: '' } } as any)).toThrow(/scope/);
    expect(adapter.projectHtml).not.toHaveBeenCalled();
  });
});
