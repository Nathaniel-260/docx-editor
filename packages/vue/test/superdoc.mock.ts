/**
 * Deterministic stand-in for the `superdoc` package, aliased in
 * `vitest.config.ts`. Mirrors the lifecycle surface the wrapper drives:
 * config callbacks fired on a microtask, `setDocumentMode`, `destroy`, and a
 * minimal event emitter for `document-mode-change`.
 */
type SuperDocConfig = {
  selector?: unknown;
  toolbar?: unknown;
  document?: unknown;
  documentMode?: string;
  /** Test hook: skip the automatic ready microtask; call `fireReady()` manually. */
  manualReady?: boolean;
  onEditorCreate?: (event: { editor: object; superdoc: SuperDoc }) => void;
  onReady?: (event: { superdoc: SuperDoc }) => void;
  onEditorDestroy?: () => void;
  onZoomChange?: (event: { zoom: number; mode: string }) => void;
  [key: string]: unknown;
};

export class SuperDoc {
  static instances: SuperDoc[] = [];

  config: SuperDocConfig;
  destroyed = false;
  ready = false;
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  constructor(config: SuperDocConfig) {
    if (config.document === 'not-a-valid-doc') {
      throw new Error('Invalid document');
    }

    this.config = config;
    SuperDoc.instances.push(this);

    if (!config.manualReady) {
      queueMicrotask(() => this.fireReady());
    }
  }

  fireReady() {
    if (this.destroyed || this.ready) return;
    this.ready = true;
    this.config.onEditorCreate?.({ editor: {}, superdoc: this });
    this.config.onReady?.({ superdoc: this });
  }

  on(event: string, handler: (payload: unknown) => void) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return this;
  }

  off(event: string, handler: (payload: unknown) => void) {
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, payload: unknown) {
    for (const handler of this.listeners.get(event) ?? []) handler(payload);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    // Deliberately does NOT call `onEditorDestroy`, because core does not.
    // Core declares the callback and a `broadcastEditorDestroy()` that emits
    // `editorDestroy`, but nothing calls either, so a mock that invoked it
    // here would prove the wrapper forwards an event that never arrives. The
    // wrapper emits `editor-destroy` itself for teardown it owns.
  }

  setDocumentMode(mode: string) {
    // Mirrors the core guard: `SuperDoc#setDocumentMode` throws until ready.
    if (!this.ready) throw new Error('setDocumentMode requires a ready SuperDoc');
    this.config.documentMode = mode;
    this.emit('document-mode-change', { documentMode: mode });
  }
}
