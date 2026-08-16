import type { SDProjectionReadInput } from '../types/content-projection.js';
import { validateProjectionReadInput } from '../content-projection/validation.js';

const GET_MARKDOWN_FIELDS = new Set(['in', 'reviewMode', 'scope']);

export interface GetMarkdownInput extends SDProjectionReadInput {}

/**
 * Engine-specific adapter that the getMarkdown API delegates to.
 */
export interface GetMarkdownAdapter {
  /**
   * Return the full document content as a Markdown string.
   */
  getMarkdown(input: GetMarkdownInput): string;
}

/**
 * Execute a getMarkdown operation via the provided adapter.
 *
 * @param adapter - Engine-specific getMarkdown adapter.
 * @param input - Canonical getMarkdown input object.
 * @returns The full document content as a Markdown-formatted string.
 */
export function executeGetMarkdown(adapter: GetMarkdownAdapter, input: GetMarkdownInput): string {
  validateProjectionReadInput(input, 'getMarkdown', GET_MARKDOWN_FIELDS);
  return adapter.getMarkdown(input);
}
