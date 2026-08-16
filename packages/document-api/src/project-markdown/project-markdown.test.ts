import { describe, expect, it, mock } from 'bun:test';
import { DocumentApiValidationError } from '../errors.js';
import { executeProjectMarkdown, type ProjectMarkdownAdapter } from './project-markdown.js';

const RESULT = {
  format: 'markdown',
  content: '# Hello',
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

describe('executeProjectMarkdown', () => {
  it('validates and delegates a detailed projection read', async () => {
    const adapter: ProjectMarkdownAdapter = { projectMarkdown: mock(async () => RESULT) };
    const input = { reviewMode: 'original', includeSourceMap: true } as const;
    await expect(executeProjectMarkdown(adapter, input)).resolves.toBe(RESULT);
    expect(adapter.projectMarkdown).toHaveBeenCalledWith(input);
  });

  it('fails with a typed error when the adapter is unavailable', () => {
    expect(() => executeProjectMarkdown(undefined, {})).toThrow(DocumentApiValidationError);
    try {
      executeProjectMarkdown(undefined, {});
    } catch (error) {
      expect((error as DocumentApiValidationError).code).toBe('CAPABILITY_UNAVAILABLE');
    }
  });

  it('rejects invalid detailed inputs before delegation', () => {
    const adapter: ProjectMarkdownAdapter = { projectMarkdown: mock(async () => RESULT) };
    expect(() => executeProjectMarkdown(adapter, null as any)).toThrow(/non-null object/);
    expect(() => executeProjectMarkdown(adapter, { extra: true } as any)).toThrow(/Unknown field/);
    expect(adapter.projectMarkdown).not.toHaveBeenCalled();
  });
});
