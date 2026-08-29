/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('./v2-integration/v2-integration.js', () => ({
  loadDefaultV2IntegrationOrFallback: () => new Promise(() => {}),
}));

const { SuperDoc } = await import('./SuperDoc.js');

const instances: InstanceType<typeof SuperDoc>[] = [];

afterEach(() => {
  for (const instance of instances.splice(0)) instance.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('deprecated configuration', () => {
  it('does not warn when AI Writer is not configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const selector = document.createElement('div');
    document.body.append(selector);

    instances.push(new SuperDoc({ selector, telemetry: { enabled: false } }));

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('`modules.ai` is deprecated'));
  });

  it('points AI Writer users to an application-owned integration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const selector = document.createElement('div');
    document.body.append(selector);

    instances.push(
      new SuperDoc({
        selector,
        modules: { ai: {} },
        telemetry: { enabled: false },
      }),
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`modules.ai` is deprecated'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`ui.toolbar.customItems`'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`doc.insert()` or `doc.replace()`'));
  });
});
