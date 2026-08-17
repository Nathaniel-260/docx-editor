import assert from 'node:assert/strict';
import { test } from 'node:test';

test('a failed runtime load releases its worker before retrying', async (context) => {
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
  let scriptAttempt = 0;
  let pendingScript;
  let workerAttempt = 0;

  Object.defineProperty(globalThis, 'window', { configurable: true, value: runtimeWindow });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => ({
      ok: true,
      json: async () => ({ files: [{ path: 'assets/browser-worker-entry-test.js' }] }),
    }),
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
            pendingScript = element;
            return;
          }

          runtimeWindow.SuperDoc = class SuperDoc {};
          queueMicrotask(() => element.dispatch('load'));
        },
      },
    },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value() {
      workerAttempt += 1;
      const url = `blob:worker-${workerAttempt}`;
      if (workerAttempt === 1) {
        // The first failure lands after the worker global exists, which is the
        // retry path that must revoke and clear it.
        queueMicrotask(() => pendingScript.dispatch('error'));
      }
      return url;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value(url) {
      revokedUrls.push(url);
    },
  });

  const { loadRuntime } = await import('../components/embeds/superdoc-runtime.ts');

  await assert.rejects(loadRuntime(), /Could not load script/u);
  assert.equal(runtimeWindow.SuperDoc, undefined);
  assert.equal(runtimeWindow.__SUPERDOC_V2_BROWSER_WORKER_URL__, undefined);
  assert.deepEqual(revokedUrls, ['blob:worker-1']);
  assert.deepEqual(removedElements.sort(), ['link', 'script']);

  const constructor = await loadRuntime();
  assert.equal(constructor, runtimeWindow.SuperDoc);
  assert.equal(runtimeWindow.__SUPERDOC_V2_BROWSER_WORKER_URL__, 'blob:worker-2');
});

function restore(target, property, descriptor) {
  if (descriptor) Object.defineProperty(target, property, descriptor);
  else delete target[property];
}
