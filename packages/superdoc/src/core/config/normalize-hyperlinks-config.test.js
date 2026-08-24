import { describe, expect, it, vi } from 'vite-plus/test';
import { normalizeHyperlinksConfig } from './normalize-hyperlinks-config.js';

describe('normalizeHyperlinksConfig', () => {
  it('uses SuperDoc mode-aware behavior when no handler is configured', () => {
    expect(normalizeHyperlinksConfig({})).toEqual({
      onActivate: undefined,
      suppressed: false,
      defaultUiSuppressed: false,
      handleNonEditable: false,
    });
  });

  it('uses hyperlinks.onActivate', () => {
    const onActivate = vi.fn();

    expect(normalizeHyperlinksConfig({ hyperlinks: { onActivate } })).toEqual({
      onActivate,
      suppressed: false,
      defaultUiSuppressed: false,
      handleNonEditable: true,
    });
  });

  it('prefers hyperlinks.onActivate over both deprecated spellings', () => {
    const onActivate = vi.fn();
    const uiResolver = vi.fn();
    const moduleResolver = vi.fn();

    expect(
      normalizeHyperlinksConfig({
        hyperlinks: { onActivate },
        ui: { linkPopover: { popoverResolver: uiResolver } },
        modules: { links: { popoverResolver: moduleResolver } },
      }).onActivate,
    ).toBe(onActivate);
  });

  it('keeps the deprecated ui.linkPopover resolver ahead of modules.links', () => {
    const uiResolver = vi.fn();
    const moduleResolver = vi.fn();

    expect(
      normalizeHyperlinksConfig({
        ui: { linkPopover: { popoverResolver: uiResolver } },
        modules: { links: { popoverResolver: moduleResolver } },
      }).onActivate,
    ).toBe(uiResolver);
  });

  it('still accepts modules.links.popoverResolver', () => {
    const popoverResolver = vi.fn();

    expect(normalizeHyperlinksConfig({ modules: { links: { popoverResolver } } }).onActivate).toBe(popoverResolver);
  });

  it('lets hyperlinks: false suppress every deprecated handler', () => {
    const popoverResolver = vi.fn();

    expect(
      normalizeHyperlinksConfig({
        hyperlinks: false,
        ui: { linkPopover: { popoverResolver } },
        modules: { links: { popoverResolver } },
      }),
    ).toEqual({
      onActivate: undefined,
      suppressed: true,
      defaultUiSuppressed: false,
      handleNonEditable: true,
    });
  });

  it('preserves deprecated UI suppression when no canonical handler is present', () => {
    const popoverResolver = vi.fn();

    expect(normalizeHyperlinksConfig({ ui: false, modules: { links: { popoverResolver } } })).toEqual({
      onActivate: undefined,
      suppressed: true,
      defaultUiSuppressed: true,
      handleNonEditable: false,
    });
    expect(normalizeHyperlinksConfig({ ui: { linkPopover: false }, modules: { links: { popoverResolver } } })).toEqual({
      onActivate: undefined,
      suppressed: true,
      defaultUiSuppressed: true,
      handleNonEditable: false,
    });
  });

  it('keeps a canonical handler active when built-in UI is disabled', () => {
    const onActivate = vi.fn();

    expect(normalizeHyperlinksConfig({ ui: false, hyperlinks: { onActivate } })).toEqual({
      onActivate,
      suppressed: false,
      defaultUiSuppressed: true,
      handleNonEditable: true,
    });
    expect(normalizeHyperlinksConfig({ ui: { linkPopover: false }, hyperlinks: { onActivate } })).toEqual({
      onActivate,
      suppressed: false,
      defaultUiSuppressed: true,
      handleNonEditable: true,
    });
  });
});
