import { DocumentApiValidationError } from '../errors.js';
import { validateOptionalBoolean, validateProjectionReadInput } from '../content-projection/validation.js';
import type { ProjectMarkdownInput, SDContentProjectionResult } from '../types/content-projection.js';

const PROJECT_MARKDOWN_FIELDS = new Set(['in', 'reviewMode', 'scope', 'includeSourceMap']);

export interface ProjectMarkdownAdapter {
  projectMarkdown(input: ProjectMarkdownInput): Promise<SDContentProjectionResult<'markdown'>>;
}

export function executeProjectMarkdown(
  adapter: ProjectMarkdownAdapter | undefined,
  input: ProjectMarkdownInput,
): Promise<SDContentProjectionResult<'markdown'>> {
  validateProjectionReadInput(input, 'projectMarkdown', PROJECT_MARKDOWN_FIELDS);
  validateOptionalBoolean(input.includeSourceMap, 'includeSourceMap', 'projectMarkdown');
  if (!adapter) {
    throw new DocumentApiValidationError(
      'CAPABILITY_UNAVAILABLE',
      'projectMarkdown is not available. The host engine has not provided an adapter for this capability.',
      { operation: 'projectMarkdown' },
    );
  }
  return adapter.projectMarkdown(input);
}
