import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, shallowRef, toRaw, watch } from 'vue';
import type {
  ComponentOptionsMixin,
  DefineComponent,
  EmitsToProps,
  PropType,
  PublicProps,
  SlotsType,
  VNode,
} from 'vue';

import type {
  DocumentMode,
  SuperDocConfig,
  SuperDocContentErrorEvent,
  SuperDocEditorConfig,
  SuperDocEditorExpose,
  SuperDocEditorCreateEvent,
  SuperDocEditorUpdateEvent,
  SuperDocExceptionEvent,
  SuperDocInstance,
  SuperDocModules,
  SuperDocReadyEvent,
  SuperDocTransactionEvent,
  SuperDocUIConfig,
  SuperDocUser,
  SuperDocViewportChangeEvent,
  SuperDocZoomChangeEvent,
  UserRole,
} from './types';

interface SuperDocEditorProps {
  document?: SuperDocConfig['document'] | null;
  documentMode?: DocumentMode;
  role?: UserRole;
  user?: SuperDocUser;
  users?: SuperDocConfig['users'];
  modules?: SuperDocModules;
  ui?: SuperDocUIConfig;
  contained?: boolean;
  config?: SuperDocEditorConfig;
}

type SuperDocEditorEmits = {
  ready: (event: SuperDocReadyEvent) => boolean;
  'editor-create': (event: SuperDocEditorCreateEvent) => boolean;
  'editor-destroy': () => boolean;
  'editor-update': (event: SuperDocEditorUpdateEvent) => boolean;
  transaction: (event: SuperDocTransactionEvent) => boolean;
  'content-error': (event: SuperDocContentErrorEvent) => boolean;
  exception: (event: SuperDocExceptionEvent) => boolean;
  'zoom-change': (event: SuperDocZoomChangeEvent) => boolean;
  'viewport-change': (event: SuperDocViewportChangeEvent) => boolean;
  'update:documentMode': (mode: DocumentMode) => boolean;
};

type SuperDocEditorSlots = SlotsType<{
  loading: Record<string, never>;
  error: { error: unknown };
}>;

type SuperDocEditorComponent = DefineComponent<
  SuperDocEditorProps,
  SuperDocEditorExpose,
  {},
  {},
  {},
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  SuperDocEditorEmits,
  keyof SuperDocEditorEmits,
  PublicProps,
  Readonly<SuperDocEditorProps> & EmitsToProps<SuperDocEditorEmits>,
  {},
  SuperDocEditorSlots,
  {},
  {},
  'getInstance'
>;

/**
 * SuperDocEditor - Vue 3 wrapper component for SuperDoc.
 *
 * Owns the mount elements (passed to core as HTMLElements, not selectors),
 * the instance lifecycle, and the rebuild policy. Container divs are always
 * rendered (hidden until initialized) so SuperDoc can mount into them on the
 * first client-side effect, which also keeps server-rendered markup
 * deterministic for hydration.
 *
 * Authored as a plain-`.ts` `defineComponent` (no SFC) so the package builds
 * without the SFC compiler and stays inside the workspace's TypeScript lint
 * surface.
 */

/** Unwrap a possible reactive proxy without cloning; identity is preserved. */
function raw<T>(value: T): T {
  return value === null || typeof value !== 'object' ? value : toRaw(value);
}

/**
 * Serialized form of a plain-data prop (`user`, `users`), used as the watch
 * source rather than only as a comparison.
 *
 * Reading it inside the watch getter is the point: serializing touches every
 * nested property, so Vue tracks them and an in-place edit (`user.name = ...`)
 * re-runs the comparison. A source that read the reference alone never re-ran
 * at all, so a mutated user silently kept the old identity in core. Comparing
 * the string still keeps an equal inline literal from forcing a rebuild.
 *
 * Returns null when the value will not serialize, and the caller falls back to
 * reference identity. Live objects must never take this path.
 */
function valueKey(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? 'undefined';
  } catch {
    return null;
  }
}

const SuperDocEditorImplementation = defineComponent({
  name: 'SuperDocEditor',
  props: {
    /** Document to load: URL string, File, or Blob. Changing it rebuilds the instance. */
    // `null` is in the type because the runtime already accepts it
    // (`props.document != null` treats it as omitted) and because the
    // documented quick start starts from `ref<File | null>(null)`. Without it,
    // template type checking rejects this package's own README.
    document: { type: [String, Object] as PropType<SuperDocConfig['document'] | null>, default: undefined },
    /** Editing mode; two-way bindable as `v-model:document-mode`. Applied in place, no rebuild. */
    documentMode: { type: String as PropType<DocumentMode>, default: 'editing' },
    /** Permission role. Changing it rebuilds the instance. */
    role: { type: String as PropType<UserRole>, default: 'editor' },
    /** Current user. Compared by value: an inline literal with the same content does not rebuild. */
    user: { type: Object as PropType<SuperDocUser>, default: undefined },
    /** All users. Compared by value, like `user`. */
    users: { type: Array as PropType<SuperDocConfig['users']>, default: undefined },
    /**
     * Module configuration. Compared by reference: it can carry functions and
     * live objects (collaboration providers, Yjs documents) that must never
     * be serialized or cloned. Swap the object to rebuild.
     */
    modules: { type: Object as PropType<SuperDocModules>, default: undefined },
    /**
     * Built-in UI configuration (`ui.toolbar: false` hides the toolbar).
     * Compared by reference; changing it rebuilds the instance.
     */
    ui: { type: [Object, Boolean] as PropType<SuperDocUIConfig>, default: undefined },
    /** Fit within a fixed-height parent and scroll internally. */
    contained: { type: Boolean, default: false },
    /**
     * Everything else from the core config (fonts, zoom, rulers, ...).
     * Applied at initialization only; later changes are ignored with a dev
     * warning. Use `getInstance()` or a managed prop for runtime changes.
     */
    config: { type: Object as PropType<SuperDocEditorConfig>, default: undefined },
  },
  emits: {
    ready: (_event: SuperDocReadyEvent) => true,
    'editor-create': (_event: SuperDocEditorCreateEvent) => true,
    'editor-destroy': () => true,
    'editor-update': (_event: SuperDocEditorUpdateEvent) => true,
    transaction: (_event: SuperDocTransactionEvent) => true,
    'content-error': (_event: SuperDocContentErrorEvent) => true,
    exception: (_event: SuperDocExceptionEvent) => true,
    'zoom-change': (_event: SuperDocZoomChangeEvent) => true,
    'viewport-change': (_event: SuperDocViewportChangeEvent) => true,
    'update:documentMode': (_mode: DocumentMode) => true,
  },
  slots: Object as SlotsType<{
    loading: Record<string, never>;
    error: { error: unknown };
  }>,
  setup(props, { emit, expose, slots }) {
    const editorEl = shallowRef<HTMLDivElement | null>(null);
    const toolbarEl = shallowRef<HTMLDivElement | null>(null);
    const isLoading = shallowRef(true);
    const hasError = shallowRef(false);
    const bootError = shallowRef<unknown>(null);

    let instance: SuperDocInstance | null = null;
    /** Invalidates in-flight async init on rebuild and unmount. */
    let generation = 0;
    let isInitializing = false;
    /** Mode requested while init was still running; flushed on ready. */
    let pendingMode: DocumentMode | null = null;
    /** Last mode applied or observed, to break the v-model echo loop. */
    let appliedMode: DocumentMode | null = null;
    /** Set when core delivers `onEditorDestroy`, so teardown emits it once. */
    let coreEmittedDestroy = false;

    /**
     * Whether this component renders its own toolbar host. The answer comes
     * from the core config: `ui: false` and `ui.toolbar: false` both mean no
     * toolbar, and a consumer who named their own container in
     * `ui.toolbar.container` gets the toolbar there instead.
     */
    const rendersToolbar = (): boolean => {
      const ui = props.ui;
      const uiToolbar = ui === false ? false : ui?.toolbar;
      const consumerOwnsContainer =
        typeof uiToolbar === 'object' && uiToolbar !== null && uiToolbar.container !== undefined;
      return uiToolbar !== false && !consumerOwnsContainer;
    };

    const destroyInstance = (): void => {
      const current = instance;
      instance = null;
      coreEmittedDestroy = false;
      try {
        // Destroy before invalidating the generation, so that if core does
        // fire `onEditorDestroy` the captured `gen` still matches.
        current?.destroy();
      } catch (error) {
        // Teardown is best-effort. Core's collaboration cleanup calls
        // consumer-supplied provider/socket `disconnect()` and `destroy()`
        // without containing their exceptions, so a custom provider can throw
        // here. Letting that escape would skip the generation bump below,
        // leaving stale callbacks authorized and aborting `rebuild()` before
        // it reaches `init()` — a failed teardown would permanently wedge the
        // editor rather than degrade it.
        console.error('[SuperDocEditor] Failed to destroy SuperDoc:', error);
      } finally {
        // Core declares `Config.onEditorDestroy` and a `broadcastEditorDestroy()`
        // that emits `editorDestroy`, but nothing in the package calls either,
        // so that callback does not fire today. Consumers are promised
        // `editor-destroy` for wrapper-owned teardown (rebuild and unmount),
        // so emit it here rather than depending on a core path that is inert.
        // The flag keeps this from double-emitting once core is wired up.
        if (current && !coreEmittedDestroy) emit('editor-destroy');
        generation += 1;
        isInitializing = false;
        pendingMode = null;
      }
    };

    const init = async (): Promise<void> => {
      const gen = ++generation;
      isLoading.value = true;
      hasError.value = false;
      bootError.value = null;
      isInitializing = true;

      try {
        // Dynamic import for SSR safety: the core touches browser globals at
        // module scope, so it must not load during server rendering.
        const superdocModule = await import('superdoc');
        // The mount elements render in the same pass that scheduled this init.
        await nextTick();
        if (gen !== generation) return;

        const editorHost = editorEl.value;
        if (!editorHost) return;

        const mode = props.documentMode;
        const config = {
          ...(props.config ? raw(props.config) : {}),
          selector: editorHost,
          ...(rendersToolbar() && toolbarEl.value ? { toolbar: toolbarEl.value } : {}),
          documentMode: mode,
          role: props.role,
          contained: props.contained,
          ...(props.document != null ? { document: raw(props.document) } : {}),
          ...(props.user ? { user: raw(props.user) } : {}),
          ...(props.users ? { users: raw(props.users) } : {}),
          ...(props.modules ? { modules: raw(props.modules) } : {}),
          ...(props.ui !== undefined ? { ui: raw(props.ui) } : {}),
          onReady: (event: { superdoc: SuperDocInstance }) => {
            if (gen !== generation) return;
            isLoading.value = false;
            isInitializing = false;
            if (pendingMode && pendingMode !== mode) {
              // Assign before calling: the mode-change event fires
              // synchronously and must not echo into v-model.
              appliedMode = pendingMode;
              event.superdoc.setDocumentMode(appliedMode);
            }
            pendingMode = null;
            emit('ready', event);
          },
          onEditorCreate: (event) => {
            if (gen === generation) emit('editor-create', event);
          },
          onEditorDestroy: () => {
            if (gen !== generation) return;
            // Records that core delivered the event, so wrapper-owned teardown
            // does not emit a second one.
            coreEmittedDestroy = true;
            emit('editor-destroy');
          },
          onEditorUpdate: (event) => {
            if (gen === generation) emit('editor-update', event);
          },
          onTransaction: (event) => {
            if (gen === generation) emit('transaction', event);
          },
          onContentError: (event) => {
            if (gen === generation) emit('content-error', event);
          },
          onException: (event) => {
            if (gen === generation) emit('exception', event);
          },
          onZoomChange: (event) => {
            if (gen === generation) emit('zoom-change', event);
          },
          onViewportChange: (event) => {
            if (gen === generation) emit('viewport-change', event);
          },
        } as SuperDocConfig;

        const created = new superdocModule.SuperDoc(config) as SuperDocInstance;
        if (gen !== generation) {
          created.destroy();
          return;
        }
        instance = created;
        appliedMode = mode;

        // Externally-driven mode changes (built-in toolbar, getInstance()
        // calls) feed v-model; self-applied changes are filtered above via
        // `appliedMode`.
        created.on?.('document-mode-change', (event: { documentMode?: DocumentMode }) => {
          if (gen !== generation) return;
          const next = event?.documentMode;
          if (!next || next === appliedMode) return;
          appliedMode = next;
          emit('update:documentMode', next);
        });
      } catch (error) {
        if (gen !== generation) return;
        isInitializing = false;
        isLoading.value = false;
        hasError.value = true;
        bootError.value = error;
        console.error('[SuperDocEditor] Failed to initialize SuperDoc:', error);
      }
    };

    const rebuild = (): void => {
      destroyInstance();
      void init();
    };

    onMounted(() => void init());
    onBeforeUnmount(destroyInstance);

    // Rebuild policy. `user`/`users` are compared by value so inline literals
    // do not rebuild; `modules`/`ui` stay on reference identity because they
    // may carry live objects a consumer intentionally swaps.
    //
    // The serialized keys are in the source, not just the comparison. Vue only
    // re-runs this when something the getter read has changed, so reading the
    // references alone meant an in-place `user.name = ...` never scheduled the
    // callback and never rebuilt, while core had already normalized `user`
    // into its own object. Serializing reads the nested values and tracks them.
    watch(
      () =>
        [
          props.document,
          props.modules,
          props.ui,
          props.role,
          props.contained,
          props.user,
          props.users,
          valueKey(props.user),
          valueKey(props.users),
        ] as const,
      (next, previous) => {
        const [, , , , , nextUser, nextUsers, nextUserKey, nextUsersKey] = next;
        const [, , , , , previousUser, previousUsers, previousUserKey, previousUsersKey] = previous;
        const byReferenceChanged = next
          .slice(0, 5)
          .some((value, index) => !Object.is(value, (previous as readonly unknown[])[index]));
        // A null key means the value would not serialize, so fall back to
        // reference identity rather than treating every read as a change.
        const changedByValue = (
          nextKey: string | null,
          previousKey: string | null,
          nextValue: unknown,
          previousValue: unknown,
        ): boolean =>
          nextKey === null || previousKey === null ? !Object.is(nextValue, previousValue) : nextKey !== previousKey;
        if (
          byReferenceChanged ||
          changedByValue(nextUserKey, previousUserKey, nextUser, previousUser) ||
          changedByValue(nextUsersKey, previousUsersKey, nextUsers, previousUsers)
        ) {
          rebuild();
        }
      },
    );

    // documentMode is applied in place; a change during init is queued and
    // flushed by the ready callback.
    watch(
      () => props.documentMode,
      (mode) => {
        if (mode === appliedMode) {
          // Returning to the applied value while init is in flight has to drop
          // the queued change, not just skip this one. `editing → viewing →
          // editing` before ready otherwise leaves `pendingMode` on `viewing`,
          // and the ready callback applies it, so the editor ends in viewing
          // while the bound prop reads editing.
          pendingMode = null;
          return;
        }
        if (instance && !isInitializing) {
          // Assign before calling: the mode-change event fires synchronously
          // and must not echo into v-model.
          appliedMode = mode;
          instance.setDocumentMode(mode);
        } else if (isInitializing) {
          // The instance exists as soon as the constructor returns, but core
          // `setDocumentMode` throws until ready; queue and flush on ready.
          pendingMode = mode;
        }
      },
    );

    // `config` is initialization-only by contract; say so instead of
    // silently ignoring a changed reference.
    //
    // The serialized key is in the source for the same reason as `user`: a
    // parent that mutates a reactive config in place (`config.rulers = false`)
    // leaves the reference untouched, so a source reading only the reference
    // never re-runs and the promised warning never fires. Core copied the
    // value at construction, so the edit is silently ignored, which is exactly
    // what this warning exists to prevent. `valueKey` falls back to identity
    // for a config carrying something unserializable.
    watch(
      () => [props.config, valueKey(props.config)] as const,
      () => {
        if (!instance && !isInitializing) return;
        console.warn(
          '[SuperDocEditor] `config` is applied when the instance is created; this change is ignored. ' +
            'Use getInstance() or a managed prop (document, documentMode, user, users, modules, ui, role, contained) for runtime changes.',
        );
      },
    );

    expose({
      // Gated on readiness, not merely on the constructor having returned.
      // `SuperDocEditorExpose` promises null until initialization completes,
      // and handing back an instance mid-init lets a consumer call a
      // readiness-guarded method such as `setDocumentMode`, which throws.
      // The internal `instance` stays set throughout so teardown still works.
      getInstance: () => (isInitializing ? null : instance),
    });

    return (): VNode => {
      const hideWhenLoading = isLoading.value ? { display: 'none' } : undefined;
      return h(
        'div',
        {
          class: 'superdoc-wrapper',
          // `height: 100%` is what carries the parent's definite height down to
          // the editor host. Without it the wrapper is `height: auto`, so the
          // host's `flex: 1 1 0%` grows against an unconstrained box and a
          // multi-page document expands the page instead of scrolling inside
          // the parent, which is the whole point of `contained`. Safe when the
          // parent is not definite-height: a percentage height against an auto
          // containing block resolves to auto, the current behaviour.
          style: props.contained ? { display: 'flex', flexDirection: 'column', height: '100%' } : undefined,
        },
        [
          rendersToolbar()
            ? h('div', { ref: toolbarEl, class: 'superdoc-toolbar-container', style: hideWhenLoading })
            : null,
          h('div', {
            ref: editorEl,
            class: 'superdoc-editor-container',
            style: {
              ...hideWhenLoading,
              ...(props.contained ? { flex: '1 1 0%', minHeight: '0' } : {}),
            },
          }),
          isLoading.value && !hasError.value && slots.loading
            ? h('div', { class: 'superdoc-loading-container' }, slots.loading({}))
            : null,
          hasError.value
            ? h(
                'div',
                { class: 'superdoc-error-container' },
                slots.error
                  ? slots.error({ error: bootError.value })
                  : 'Failed to load editor. Check console for details.',
              )
            : null,
        ],
      );
    };
  },
});

export const SuperDocEditor = SuperDocEditorImplementation as unknown as SuperDocEditorComponent;

export default SuperDocEditor;
