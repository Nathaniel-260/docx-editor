/**
 * Consumer typecheck: `ui.loading` turns the built-in loading overlay off.
 *
 * The surface is a plain boolean, so what this pins is that it is declared on
 * `UIConfig` at all, and that the two ways of disabling it both typecheck: the
 * per-surface flag and the coarse `ui: false`.
 */
import type { Config, SuperDoc } from 'superdoc';

const _loadingOff: Config = {
  selector: '#editor',
  ui: {
    loading: false,
  },
};

const _loadingOn: Config = {
  selector: '#editor',
  ui: {
    loading: true,
  },
};

// The overlay is one of the built-in surfaces `ui: false` turns off, so this
// spelling has to keep compiling without naming it.
const _allBuiltInUiOff: Config = {
  selector: '#editor',
  ui: false,
};

// Alongside another surface, since `ui.loading` must not be mutually exclusive
// with the rest of the namespace.
const _loadingOffWithToolbar: Config = {
  selector: '#editor',
  ui: {
    loading: false,
    toolbar: { container: '#toolbar' },
  },
};

/**
 * The resolved side, which is the half a `Config`-only fixture misses.
 *
 * `SuperDoc['uiConfig']` is typed as `ReturnType<typeof normalizeUiConfig>`,
 * and that return type is an explicit annotation rather than an inferred one.
 * Adding a surface to the runtime object therefore does not widen it: without
 * the annotation naming `loading`, this read is a type error for a consumer
 * even though the property exists at runtime.
 */
declare const superdoc: SuperDoc;
const _resolvedLoading: boolean = superdoc.uiConfig.loading.enabled;

export { _loadingOff, _loadingOn, _allBuiltInUiOff, _loadingOffWithToolbar, _resolvedLoading };
