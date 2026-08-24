/**
 * Hyperlink activation is behavior, not a built-in UI surface. This profile
 * gives the top-level `hyperlinks` API precedence while preserving the
 * existing link-popover spellings.
 */

import { firstDefined } from './merge-defined.js';

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Resolve hyperlink activation behavior.
 *
 * A canonical handler remains active under `ui: false` because an application
 * may navigate or render its own interface. Without a canonical handler, the
 * existing UI suppression rules keep their current behavior.
 *
 * @param {Record<string, any>} [config] Raw consumer config.
 * @returns {{
 *   onActivate: import('../types/index.js').HyperlinkActivationHandler | import('../types/index.js').LinkPopoverResolver | undefined,
 *   suppressed: boolean,
 *   defaultUiSuppressed: boolean,
 *   handleNonEditable: boolean,
 * }}
 */
export function normalizeHyperlinksConfig(config = {}) {
  const canonical = isPlainObject(config.hyperlinks) ? config.hyperlinks : {};
  const hasCanonicalHandler = typeof canonical.onActivate === 'function';
  const ui = isPlainObject(config.ui) ? config.ui : {};
  const legacyUi = isPlainObject(ui.linkPopover) ? ui.linkPopover : {};

  const canonicalSuppressed = config.hyperlinks === false;
  const legacySuppressed = config.ui === false || ui.linkPopover === false;
  const suppressed = canonicalSuppressed || (!hasCanonicalHandler && legacySuppressed);
  const onActivate = suppressed
    ? undefined
    : firstDefined(canonical.onActivate, legacyUi.popoverResolver, config.modules?.links?.popoverResolver);

  return {
    onActivate: typeof onActivate === 'function' ? onActivate : undefined,
    suppressed,
    defaultUiSuppressed: legacySuppressed,
    handleNonEditable: config.hyperlinks === false || hasCanonicalHandler,
  };
}
