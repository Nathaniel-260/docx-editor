import { describe, expect, it, mock } from 'bun:test';
import { DocumentApiValidationError } from '../errors.js';
import { executeHtmlToFragment, type HtmlToFragmentAdapter } from './html-to-fragment.js';

describe('executeHtmlToFragment', () => {
  it('delegates to the supplied adapter without changing the result', () => {
    const result = {
      fragment: [{ kind: 'paragraph' as const, paragraph: { inlines: [] } }],
      lossy: false,
      diagnostics: [],
    };
    const adapter: HtmlToFragmentAdapter = { htmlToFragment: mock(() => result) };
    const input = { html: '<p>Hello</p>' };

    expect(executeHtmlToFragment(adapter, input)).toBe(result);
    expect(adapter.htmlToFragment).toHaveBeenCalledWith(input);
  });

  it('throws the typed capability error when an optional adapter is missing', () => {
    try {
      executeHtmlToFragment(undefined, { html: '<p>Hello</p>' });
      throw new Error('expected executeHtmlToFragment to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentApiValidationError);
      expect((error as DocumentApiValidationError).code).toBe('CAPABILITY_UNAVAILABLE');
      expect((error as DocumentApiValidationError).details).toEqual({ operation: 'htmlToFragment' });
    }
  });
});
