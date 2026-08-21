import { act, type ForwardedRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';

const wrapper = vi.hoisted(() => {
  let finishExport = () => {};
  const exportPromise = new Promise<void>((resolve) => {
    finishExport = resolve;
  });

  return {
    exportDocument: vi.fn(() => exportPromise),
    finishExport,
    ready: () => {},
  };
});

vi.mock('@superdoc/react', async () => {
  const React = await import('react');

  return {
    SuperDocEditor: React.forwardRef(function MockSuperDocEditor(
      { onReady }: { onReady?: () => void },
      ref: ForwardedRef<{ getInstance: () => { export: () => Promise<void> } }>,
    ) {
      React.useImperativeHandle(ref, () => ({
        getInstance: () => ({ export: wrapper.exportDocument }),
      }));
      wrapper.ready = () => onReady?.();
      return <div data-testid='superdoc-editor' />;
    }),
  };
});
vi.mock('@superdoc/react/style.css', () => ({}));

async function renderApp() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  wrapper.exportDocument.mockClear();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const { default: App } = await import('../src/App');
  await act(async () => root.render(<App />));
  return { container, root };
}

test('enables export only after the wrapper reports readiness', async () => {
  const { container, root } = await renderApp();
  const button = container.querySelector('button');
  expect(button?.disabled).toBe(true);

  await act(async () => wrapper.ready());
  expect(button?.disabled).toBe(false);

  await act(async () => root.unmount());
  container.remove();
});

test('exports through the wrapper instance once per click', async () => {
  const { container, root } = await renderApp();
  const button = container.querySelector('button');
  await act(async () => wrapper.ready());

  await act(async () => {
    button?.click();
    button?.click();
  });
  expect(wrapper.exportDocument).toHaveBeenCalledOnce();
  expect(button?.disabled).toBe(true);

  await act(async () => wrapper.finishExport());
  expect(button?.disabled).toBe(false);

  await act(async () => root.unmount());
  container.remove();
});
