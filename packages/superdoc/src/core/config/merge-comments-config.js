import { mergeDefined } from './merge-defined.js';

/**
 * Layer canonical comment presentation over the live legacy config.
 *
 * The responsive options can be migrated independently, so merge that nested
 * bag by field while keeping canonical values authoritative.
 *
 * @param {Record<string, unknown>} config
 * @param {Record<string, unknown>} presentation
 * @returns {Record<string, unknown>}
 */
export function mergeCommentsConfig(config, presentation) {
  const merged = mergeDefined(config, presentation);
  const responsive = mergeDefined(config?.responsive, presentation?.responsive);

  if (Object.keys(responsive).length > 0) merged.responsive = responsive;
  else delete merged.responsive;

  return merged;
}
