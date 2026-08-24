import assert from 'node:assert/strict';
import { test } from 'node:test';

test('runtime embeds load their assets before configuring every cross-origin worker', async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  context.after(() => {
    restore(globalThis, 'window', originalWindow);
    restore(globalThis, 'document', originalDocument);
    restore(globalThis, 'fetch', originalFetch);
    restore(URL, 'createObjectURL', originalCreateObjectUrl);
    restore(URL, 'revokeObjectURL', originalRevokeObjectUrl);
  });

  const runtimeWindow = {};
  const removedElements = [];
  const revokedUrls = [];
  let fetchCount = 0;
  let scriptAttempt = 0;
  let workerAttempt = 0;

  Object.defineProperty(globalThis, 'window', { configurable: true, value: runtimeWindow });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => {
      fetchCount += 1;
      return {
        ok: true,
        json: async () => ({
          files: [
            { path: 'assets/browser-worker-entry-test.js' },
            { path: 'assets/collaboration-worker-entry-test.js' },
            { path: 'assets/review-index-worker-entry-test.js' },
          ],
        }),
      };
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tagName) {
        const listeners = new Map();
        return {
          tagName: tagName.toUpperCase(),
          addEventListener(type, listener) {
            listeners.set(type, listener);
          },
          dispatch(type) {
            listeners.get(type)?.();
          },
          remove() {
            removedElements.push(tagName);
          },
        };
      },
      head: {
        append(element) {
          if (element.tagName === 'LINK') {
            queueMicrotask(() => element.dispatch('load'));
            return;
          }

          scriptAttempt += 1;
          if (scriptAttempt === 1) {
            queueMicrotask(() => element.dispatch('error'));
            return;
          }

          runtimeWindow.SuperDoc = class SuperDoc {
            constructor(config) {
              runtimeWindow.lastConfig = config;
            }
          };
          queueMicrotask(() => element.dispatch('load'));
        },
      },
    },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value() {
      workerAttempt += 1;
      return `blob:worker-${workerAttempt}`;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value(url) {
      revokedUrls.push(url);
    },
  });

  const { createRuntimeEditor, getRuntimeWorkerUrls, loadRuntime } =
    await import('../components/embeds/superdoc-runtime.ts');

  await assert.rejects(loadRuntime(), /Could not load script/u);
  assert.equal(runtimeWindow.SuperDoc, undefined);
  assert.equal(runtimeWindow.__SUPERDOC_V2_BROWSER_WORKER_URL__, undefined);
  assert.equal(fetchCount, 0);
  assert.equal(workerAttempt, 0);
  assert.deepEqual(revokedUrls, []);
  assert.deepEqual(removedElements.sort(), ['link', 'script']);

  const constructor = await loadRuntime();
  assert.equal(constructor, runtimeWindow.SuperDoc);
  assert.equal(fetchCount, 1);
  assert.equal(runtimeWindow.__SUPERDOC_V2_BROWSER_WORKER_URL__, 'blob:worker-1');
  assert.deepEqual(getRuntimeWorkerUrls(), {
    document: 'blob:worker-1',
    collaboration: 'blob:worker-2',
    reviewIndex: 'blob:worker-3',
  });

  createRuntimeEditor(constructor, { selector: '#editor' });
  assert.deepEqual(runtimeWindow.lastConfig.workerUrls, getRuntimeWorkerUrls());
});

test('a partial worker configuration is released before retrying', async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  context.after(() => {
    restore(globalThis, 'window', originalWindow);
    restore(globalThis, 'fetch', originalFetch);
    restore(URL, 'createObjectURL', originalCreateObjectUrl);
    restore(URL, 'revokeObjectURL', originalRevokeObjectUrl);
  });

  const runtimeWindow = { SuperDoc: class SuperDoc {} };
  const revokedUrls = [];
  let fetchAttempt = 0;
  let objectUrlCount = 0;

  Object.defineProperty(globalThis, 'window', { configurable: true, value: runtimeWindow });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => {
      fetchAttempt += 1;
      return {
        ok: true,
        json: async () => ({
          files:
            fetchAttempt === 1
              ? [{ path: 'assets/browser-worker-entry-test.js' }]
              : [
                  { path: 'assets/browser-worker-entry-test.js' },
                  { path: 'assets/collaboration-worker-entry-test.js' },
                  { path: 'assets/review-index-worker-entry-test.js' },
                ],
        }),
      };
    },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value() {
      objectUrlCount += 1;
      return `blob:retry-worker-${objectUrlCount}`;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value(url) {
      revokedUrls.push(url);
    },
  });

  const { getRuntimeWorkerUrls, loadRuntime } =
    await import('../components/embeds/superdoc-runtime.ts?worker-retry');

  await assert.rejects(loadRuntime(), /collaboration worker/u);
  assert.equal(runtimeWindow.__SUPERDOC_V2_BROWSER_WORKER_URL__, undefined);
  assert.deepEqual(revokedUrls, ['blob:retry-worker-1']);

  await loadRuntime();
  assert.deepEqual(getRuntimeWorkerUrls(), {
    document: 'blob:retry-worker-2',
    collaboration: 'blob:retry-worker-3',
    reviewIndex: 'blob:retry-worker-4',
  });
});

test('concurrent embeds share one in-flight worker configuration', async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  context.after(() => {
    restore(globalThis, 'window', originalWindow);
    restore(globalThis, 'fetch', originalFetch);
    restore(URL, 'createObjectURL', originalCreateObjectUrl);
    restore(URL, 'revokeObjectURL', originalRevokeObjectUrl);
  });

  const runtimeWindow = { SuperDoc: class SuperDoc {} };
  let fetchCount = 0;
  let objectUrlCount = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: runtimeWindow });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        ok: true,
        json: async () => ({
          files: [
            { path: 'assets/browser-worker-entry-test.js' },
            { path: 'assets/collaboration-worker-entry-test.js' },
            { path: 'assets/review-index-worker-entry-test.js' },
          ],
        }),
      };
    },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value() {
      objectUrlCount += 1;
      return `blob:concurrent-worker-${objectUrlCount}`;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value() {} });

  const { loadRuntime } = await import('../components/embeds/superdoc-runtime.ts?concurrent-workers');
  const [first, second] = await Promise.all([loadRuntime(), loadRuntime()]);

  assert.equal(first, runtimeWindow.SuperDoc);
  assert.equal(second, runtimeWindow.SuperDoc);
  assert.equal(fetchCount, 1);
  assert.equal(objectUrlCount, 3);
});

function restore(target, property, descriptor) {
  if (descriptor) Object.defineProperty(target, property, descriptor);
  else delete target[property];
}
