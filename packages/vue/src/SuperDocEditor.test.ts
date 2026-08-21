import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import type { App } from 'vue';

import { SuperDocEditor } from './SuperDocEditor';
import type { SuperDocEditorExpose } from './types';
// The Vitest alias makes this the same class the component imports at runtime.
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
    expect(updateMode).not.toHaveBeenCalled();
    expect(instances()).toHaveLength(1);

    instance.emit('document-mode-change', { documentMode: 'suggesting' });
    expect(updateMode).toHaveBeenCalledWith('suggesting');
  });

  it('queues a documentMode change that lands during initialization', async () => {
    const { props } = mount({ document: 'test.docx' });
    props.documentMode = 'viewing';
    await settle();

    expect(lastInstance().config.documentMode).toBe('viewing');
    expect(instances()).toHaveLength(1);
  });

  it('queues a mode change that lands after construction but before ready', async () => {
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
    // Consumer-owned collaboration cleanup can throw from destroy().
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
    const { props } = mount({ document: 'test.docx', ui: { toolbar: false } });
    await settle();
    expect(instances()).toHaveLength(1);

    props.ui = { toolbar: false };
    await settle();

    expect(instances()).toHaveLength(2);
  });

  it('treats a null document as omitted, the documented initial state', async () => {
    mount({ document: null });
    await settle();

    expect(instances()).toHaveLength(1);
    expect('document' in lastInstance().config).toBe(false);
  });

  it('resolves the parent height on the wrapper in contained mode', async () => {
    const { el } = mount({ document: 'test.docx', contained: true });
    await settle();

    const wrapper = el.querySelector('.superdoc-wrapper') as HTMLElement;
    expect(wrapper.style.display).toBe('flex');
    expect(wrapper.style.height).toBe('100%');
  });

  it('leaves the wrapper height alone when not contained', async () => {
    const { el } = mount({ document: 'test.docx' });
    await settle();

    const wrapper = el.querySelector('.superdoc-wrapper') as HTMLElement;
    expect(wrapper.style.height).toBe('');
  });

  it('rebuilds when a reactive user is mutated in place', async () => {
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
