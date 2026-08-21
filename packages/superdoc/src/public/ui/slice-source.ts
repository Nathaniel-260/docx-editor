/**
 * Shared value-source normalization for the framework bindings
 * (`superdoc/ui/react`, `superdoc/ui/vue`). Framework-free so either binding
 * can import it without dragging in the other framework's module graph.
 */

import type { Subscribable } from './types.js';

/**
 * Minimal value source the slice hooks/composables consume: a synchronous
 * snapshot read plus a value-direct `observe` (immediate first emit, then on
 * change). Every domain handle satisfies this directly; command/font bindings
 * adapt to it.
 */
export interface SliceSource<T> {
  getSnapshot(): T;
  observe(listener: (value: T) => void): () => void;
}

/**
 * Normalize a `pick` result into a {@link SliceSource}. Domain handles and the
 * command/font bindings already expose the snapshot-shaped contract
 * (`getSnapshot` + `observe`) and pass through unchanged. A raw `ui.select(...)`
 * {@link Subscribable} (`get` + `subscribe`) is adapted: it `subscribe`s FIRST,
 * then emits the current value, so a synchronous recompute triggered by the
 * first listener is not missed (the substrate's `subscribe` does not emit on
 * attach). Exported for unit tests; not re-exported by the public facades, so
 * it stays off the public surface.
 */
export function toSliceSource<T>(source: SliceSource<T> | Subscribable<T>): SliceSource<T> {
  const candidate = source as Partial<SliceSource<T>>;
  if (typeof candidate.getSnapshot === 'function' && typeof candidate.observe === 'function') {
    return source as SliceSource<T>;
  }
  const raw = source as Subscribable<T>;
  return {
    getSnapshot: () => raw.get(),
    observe: (listener) => {
      const unsubscribe = raw.subscribe(listener);
      listener(raw.get());
      return unsubscribe;
    },
  };
}
