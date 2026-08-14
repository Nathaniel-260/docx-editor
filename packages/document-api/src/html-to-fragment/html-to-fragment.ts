import { DocumentApiValidationError } from '../errors.js';
import type { SDHtmlToFragmentResult } from '../types/sd-contract.js';

export interface HtmlToFragmentInput {
  html: string;
}

export interface HtmlToFragmentAdapter {
  htmlToFragment(input: HtmlToFragmentInput): SDHtmlToFragmentResult;
}

export function executeHtmlToFragment(
  adapter: HtmlToFragmentAdapter | undefined,
  input: HtmlToFragmentInput,
): SDHtmlToFragmentResult {
  if (!adapter) {
    throw new DocumentApiValidationError(
      'CAPABILITY_UNAVAILABLE',
      'htmlToFragment is not available. The host engine has not provided an adapter for this capability.',
      { operation: 'htmlToFragment' },
    );
  }
  return adapter.htmlToFragment(input);
}
