import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import type { App } from 'vue';

import { SuperDocEditor } from './SuperDocEditor';
import type { SuperDocEditorExpose } from './types';
// The vitest alias points `superdoc` at the mock, so the class the component
// dynamically imports and this import are the same object.
import { SuperDoc as MockSuperDoc } from 'superdoc';

type MockInstance = InstanceType<typeof MockSuperDoc> & {
  config: Record<string, unknown>;
  destroyed: boolean;
  emit: (event: string, payload: unknown) => void;
};

const apps: App[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  (MockSuperDoc as unknown as { instances: unknown[] }).instances.length = 0;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function instances(): MockInstance[] {
  return (MockSuperDoc as unknown as { instances: MockInstance[] }).instances;
}

function lastInstance(): MockInstance {
  const all = instances();
  expect(all.length).toBeGreaterThan(0);
  return all[all.length - 1];
}

/** Mount the editor with reactive props; mutate `props` then await settle(). */
function mount(initialProps: Record<string, unknown> = {}, options: { slots?: Record<string, () => unknown> } = {}) {
  const props = reactive({ ...initialProps });
  let exposed: SuperDocEditorExpose | null = null;
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(
            SuperDocEditor,
            {
              ...props,
              ref: (component: unknown) => {
                exposed = component as SuperDocEditorExpose | null;
              },
            },
            options.slots,
          );
      },
    }),
  );
  const el = document.createElement('div');
  document.body.append(el);
  app.mount(el);
  apps.push(app);
  return {
    el,
    props,
    getExposed: () => exposed,
  };
}

/** Let the dynamic import, the mock's ready microtask, and re-renders settle. */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('SuperDocEditor', () => {
  it('renders the wrapper with toolbar and editor containers and mounts by element', async () => {
    const { el } = mount({ document: 'test.docx' });
    await settle();

    expect(el.querySelector('.superdoc-wrapper')).not.toBeNull();
    expect(el.querySelector('.superdoc-toolbar-container')).not.toBeNull();
    expect(el.querySelector('.superdoc-editor-container')).not.toBeNull();

    const instance = lastInstance();
    expect(instance.config.selector).toBe(el.querySelector('.superdoc-editor-container'));
    expect(instance.config.toolbar).toBe(el.querySelector('.superdoc-toolbar-container'));
  });

  it('omits the toolbar container when ui.toolbar is false', async () => {
    const { el } = mount({ document: 'test.docx', ui: { toolbar: false } });
    await settle();

    expect(el.querySelector('.superdoc-toolbar-container')).toBeNull();
    expect(lastInstance().config.toolbar).toBeUndefined();
  });

  it('shows the loading slot until ready, then reveals the containers', async () => {
    const { el } = mount({ document: 'test.docx' }, { slots: { loading: () => 'Opening document' } });

    expect(el.querySelector('.superdoc-loading-container')?.textContent).toBe('Opening document');

    await settle();
    expect(el.querySelector('.superdoc-loading-container')).toBeNull();
    const editor = el.querySelector('.superdoc-editor-container') as HTMLElement;
    expect(editor.style.display).not.toBe('none');
  });

  it('renders the error slot with the failure when bootstrap throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { el } = mount(
      { document: 'not-a-valid-doc' },
      { slots: { error: (scope?: unknown) => `failed: ${(scope as { error: Error }).error.message}` } },
    );
    await settle();

    expect(el.querySelector('.superdoc-error-container')?.textContent).toBe('failed: Invalid document');
  });

  it('emits ready and editor-create, and exposes the instance', async () => {
    const ready = vi.fn();
    const editorCreate = vi.fn();
    const { getExposed } = mount({ document: 'test.docx', onReady: ready, 'onEditor-create': editorCreate });

    expect(getExposed()?.getInstance()).toBeNull();

    await settle();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(editorCreate).toHaveBeenCalledTimes(1);
    expect(getExposed()?.getInstance()).toBe(lastInstance() as never);
  });

  it('applies documentMode in place and echoes external changes to v-model', async () => {
    const updateMode = vi.fn();
    const { props } = mount({ document: 'test.docx', 'onUpdate:documentMode': updateMode });
    await settle();

    const instance = lastInstance();
    const setMode = vi.spyOn(instance, 'setDocumentMode');

    props.documentMode = 'viewing';
    await settle();
    expect(setMode).toHaveBeenCalledWith('viewing');
    // Applying the prop must not echo back as a v-model update.
    expect(updateMode).not.toHaveBeenCalled();
    expect(instances()).toHaveLength(1);

    // An external change (built-in toolbar, getInstance() call) feeds v-model.
    instance.emit('document-mode-change', { documentMode: 'suggesting' });
    expect(updateMode).toHaveBeenCalledWith('suggesting');
  });

  it('queues a documentMode change that lands during initialization', async () => {
    const { props } = mount({ document: 'test.docx' });
    // Before the dynamic import resolves, change the mode.
    props.documentMode = 'viewing';
    await settle();

    expect(lastInstance().config.documentMode).toBe('viewing');
    expect(instances()).toHaveLength(1);
  });

  it('queues a mode change that lands after construction but before ready', async () => {
    // The core throws on pre-ready setDocumentMode (the mock replicates the
    // guard), so the change must queue and flush from the ready callback.
    const { props } = mount({ document: 'test.docx', config: { manualReady: true } });
    await settle();
    const instance = lastInstance();
    expect(instance.ready).toBe(false);

    props.documentMode = 'viewing';
    await settle();

    instance.fireReady();
    expect(instance.config.documentMode).toBe('viewing');
    expect(instances()).toHaveLength(1);
  });

  it('drops a queued mode change that the prop reverts before ready', async () => {
    // editing -> viewing -> editing while init is in flight. The second update
    // matches the applied mode and returns early, so a queue that is only
    // written and never cleared still holds `viewing`, and the ready callback
    // applies it against a prop that reads `editing`.
    const { props } = mount({ document: 'test.docx', documentMode: 'editing', config: { manualReady: true } });
    await settle();
    const instance = lastInstance();

    props.documentMode = 'viewing';
    await settle();
    props.documentMode = 'editing';
    await settle();

    instance.fireReady();
    await settle();

    expect(instance.config.documentMode).toBe('editing');
  });

  it('emits editor-destroy for wrapper-owned teardowns', async () => {
    const destroyed = vi.fn();
    const { props } = mount({ document: 'first.docx', 'onEditor-destroy': destroyed });
    await settle();

    props.document = 'second.docx';
    await settle();
    expect(destroyed).toHaveBeenCalledTimes(1);

    apps.pop()?.unmount();
    expect(destroyed).toHaveBeenCalledTimes(2);
  });

  it('rebuilds when document changes and destroys the previous instance', async () => {
    const { props } = mount({ document: 'first.docx' });
    await settle();
    const first = lastInstance();

    props.document = 'second.docx';
    await settle();

    expect(first.destroyed).toBe(true);
    expect(instances()).toHaveLength(2);
    expect(lastInstance().config.document).toBe('second.docx');
  });

  it('does not rebuild for a structurally equal inline user object', async () => {
    const { props } = mount({ document: 'test.docx', user: { name: 'Ada', email: 'ada@example.com' } });
    await settle();

    props.user = { name: 'Ada', email: 'ada@example.com' };
    await settle();

    expect(instances()).toHaveLength(1);
  });

  it('still rebuilds when teardown throws', async () => {
    // Core teardown calls consumer-supplied collaboration cleanup without
    // containing its exceptions, so a custom provider can throw from
    // destroy(). If that escapes, the generation is never bumped, stale
    // callbacks stay authorized, and rebuild() aborts before init() — the
    // editor wedges permanently instead of degrading.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destroyed = vi.fn();
    const { props } = mount({ document: 'first.docx', 'onEditor-destroy': destroyed });
    await settle();
    const first = lastInstance();
    first.destroy = () => {
      throw new Error('provider disconnect failed');
    };

    props.document = 'second.docx';
    await settle();

    expect(instances()).toHaveLength(2);
    expect(lastInstance().config.document).toBe('second.docx');
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('warns when a reactive config is mutated in place', async () => {
    // config is initialization-only, and the warning is the only signal a
    // consumer gets that their edit was ignored. A watch source reading the
    // reference alone never re-runs for `config.rulers = false`, so the edit
    // is dropped silently, which is the failure the warning exists to prevent.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = reactive({ rulers: true });
    mount({ document: 'test.docx', config });
    await settle();
    expect(warn).not.toHaveBeenCalled();

    config.rulers = false;
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/applied when the instance is created/);
    warn.mockRestore();
  });

  it('rebuilds when ui identity changes, which is why docs must hoist it', async () => {
    // `ui` is compared by reference on purpose: it can carry a live container.
    // The cost is that an object literal written inline in a template is a new
    // reference on every parent render, so an unrelated rerender rebuilds the
    // editor and discards unsaved edits. Documented examples define it once.
    const { props } = mount({ document: 'test.docx', ui: { toolbar: false } });
    await settle();
    expect(instances()).toHaveLength(1);

    props.ui = { toolbar: false };
    await settle();

    expect(instances()).toHaveLength(2);
  });

  it('treats a null document as omitted, the documented initial state', async () => {
    // The quick start starts from `ref<File | null>(null)`, so null reaches
    // this prop before a file is chosen. It must construct without a document
    // rather than pass null through to core.
    mount({ document: null });
    await settle();

    expect(instances()).toHaveLength(1);
    expect('document' in lastInstance().config).toBe(false);
  });

  it('resolves the parent height on the wrapper in contained mode', async () => {
    // The editor host grows with `flex: 1 1 0%`, which constrains nothing
    // unless the wrapper itself resolves the fixed-height parent. Left at
    // `height: auto`, a multi-page document expands the page instead of
    // scrolling inside the parent.
    const { el } = mount({ document: 'test.docx', contained: true });
    await settle();

    const wrapper = el.querySelector('.superdoc-wrapper') as HTMLElement;
    expect(wrapper.style.display).toBe('flex');
    expect(wrapper.style.height).toBe('100%');
  });

  it('leaves the wrapper height alone when not contained', async () => {
    // Default mode expands to the document's full height, so imposing a height
    // here would break the normal page-flow layout.
    const { el } = mount({ document: 'test.docx' });
    await settle();

    const wrapper = el.querySelector('.superdoc-wrapper') as HTMLElement;
    expect(wrapper.style.height).toBe('');
  });

  it('rebuilds when a reactive user is mutated in place', async () => {
    // A watch source that reads only the reference never re-runs for
    // `user.name = ...`, so the editor keeps the old user while the parent
    // believes it changed. Core normalizes `config.user` into its own object,
    // so nothing downstream notices either.
    const user = reactive({ name: 'Ada', email: 'ada@example.com' });
    mount({ document: 'test.docx', user });
    await settle();
    expect(instances()).toHaveLength(1);

    user.name = 'Grace';
    await settle();

    expect(instances()).toHaveLength(2);
    expect((lastInstance().config.user as { name: string }).name).toBe('Grace');
  });

  it('exposes getInstance only once the editor is ready', async () => {
    // `SuperDocEditorExpose` promises null until initialization completes, and
    // an instance handed back mid-init throws from readiness-guarded methods.
    const { getExposed } = mount({ document: 'test.docx', config: { manualReady: true } });
    await settle();

    expect(lastInstance().ready).toBe(false);
    expect(getExposed()?.getInstance()).toBeNull();

    lastInstance().fireReady();
    await settle();

    expect(getExposed()?.getInstance()).toBe(lastInstance());
  });

  it('rebuilds when user content actually changes and when modules identity changes', async () => {
    const modules = { comments: {} };
    const { props } = mount({ document: 'test.docx', user: { name: 'Ada' }, modules });
    await settle();
    expect(instances()).toHaveLength(1);

    props.user = { name: 'Grace' };
    await settle();
    expect(instances()).toHaveLength(2);

    props.modules = { comments: {} };
    await settle();
    expect(instances()).toHaveLength(3);
  });

  it('ignores config changes after initialization, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { props } = mount({ document: 'test.docx', config: { rulers: true } });
    await settle();

    props.config = { rulers: false };
    await settle();

    expect(instances()).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('destroys the instance on unmount', async () => {
    mount({ document: 'test.docx' });
    await settle();
    const instance = lastInstance();

    apps.pop()?.unmount();

    expect(instance.destroyed).toBe(true);
  });
});
