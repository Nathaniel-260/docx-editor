/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SuperDoc } from './SuperDoc.js';

const mounted: SuperDoc[] = [];

function createWebEditor(config: Record<string, unknown> = {}): SuperDoc {
  const selector = document.createElement('div');
  document.body.append(selector);
  const instance = new SuperDoc({
    selector,
    telemetry: { enabled: false },
    viewOptions: { layout: 'web' },
    ...config,
  });
  mounted.push(instance);
  return instance;
}

afterEach(() => {
  for (const instance of mounted.splice(0)) instance.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('V2 web layout configuration', () => {
  it('keeps the one-key web view as the public surface selector', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const instance = createWebEditor();

    expect(instance.config.viewOptions?.layout).toBe('web');
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not rewrite contradictory legacy engine inputs', () => {
    const instance = createWebEditor({
      useLayoutEngine: false,
      layoutEngineOptions: { flowMode: 'paginated' },
    });

    expect(instance.config.viewOptions?.layout).toBe('web');
    expect(instance.config.useLayoutEngine).toBe(false);
    expect(instance.config.layoutEngineOptions.flowMode).toBe('paginated');
  });

  it('preserves the temporary pre-mount dense rollback selector', () => {
    const instance = createWebEditor({
      experimental: { v2WebSurface: 'dense-control' },
    });

    expect(instance.config.experimental?.v2WebSurface).toBe('dense-control');
  });
});
