import { describe, expect, it } from 'vite-plus/test';
import {
  createHeaderFooterResolutionIndex,
  resolveEffectiveHeaderFooterRef,
  selectHeaderFooterVariantForPage,
} from './header-footer-resolution.js';
import type {
  HeaderFooterKind,
  HeaderFooterResolutionSection,
  HeaderFooterVariant,
} from './header-footer-resolution.js';

describe('header/footer effective ref resolution', () => {
  it('inherits matching variants across more than one previous section', () => {
    const sections: HeaderFooterResolutionSection[] = [
      { sectionIndex: 0, titlePg: true, headerRefs: { first: 'h0-first' } },
      { sectionIndex: 1, titlePg: true, headerRefs: { default: 'h1-default' } },
      { sectionIndex: 2, titlePg: true, headerRefs: {} },
    ];

    expect(
      resolveEffectiveHeaderFooterRef({ sections, sectionIndex: 2, kind: 'header', variant: 'first' }),
    ).toMatchObject({
      refId: 'h0-first',
      matchedSectionIndex: 0,
      matchedVariant: 'first',
    });
  });

  it('preserves inherited missing variants when a later section partially overrides another variant', () => {
    const sections: HeaderFooterResolutionSection[] = [
      { sectionIndex: 0, footerRefs: { default: 'f0-default', even: 'f0-even' } },
      { sectionIndex: 1, footerRefs: { default: 'f1-default' } },
    ];

    expect(
      resolveEffectiveHeaderFooterRef({ sections, sectionIndex: 1, kind: 'footer', variant: 'even' }),
    ).toMatchObject({
      refId: 'f0-even',
      matchedSectionIndex: 0,
      matchedVariant: 'even',
    });
  });

  it('does not let first inherit default when titlePg selects first', () => {
    const sections: HeaderFooterResolutionSection[] = [
      { sectionIndex: 0, titlePg: true, headerRefs: { default: 'h0-default' } },
    ];

    const variant = selectHeaderFooterVariantForPage({
      documentPageNumber: 1,
      sectionPageNumber: 1,
      titlePg: true,
      alternateHeaders: false,
    });

    expect(variant).toBe('first');
    expect(resolveEffectiveHeaderFooterRef({ sections, sectionIndex: 0, kind: 'header', variant: 'first' })).toBeNull();
  });

  it('does not let even inherit default when odd/even headers are enabled', () => {
    const sections: HeaderFooterResolutionSection[] = [{ sectionIndex: 0, headerRefs: { default: 'h0-default' } }];

    expect(resolveEffectiveHeaderFooterRef({ sections, sectionIndex: 0, kind: 'header', variant: 'even' })).toBeNull();
  });

  it('resolves odd from explicit odd before OOXML default', () => {
    const sections: HeaderFooterResolutionSection[] = [
      { sectionIndex: 0, headerRefs: { default: 'h0-default' } },
      { sectionIndex: 1, headerRefs: { odd: 'h1-odd', default: 'h1-default' } },
    ];

    expect(
      resolveEffectiveHeaderFooterRef({ sections, sectionIndex: 1, kind: 'header', variant: 'odd' }),
    ).toMatchObject({
      refId: 'h1-odd',
      matchedVariant: 'odd',
    });
  });

  it('resolves odd from OOXML default when explicit odd is absent', () => {
    const sections: HeaderFooterResolutionSection[] = [{ sectionIndex: 0, headerRefs: { default: 'h0-default' } }];

    expect(
      resolveEffectiveHeaderFooterRef({ sections, sectionIndex: 0, kind: 'header', variant: 'odd' }),
    ).toMatchObject({
      refId: 'h0-default',
      matchedVariant: 'default',
    });
  });

  it('matches the legacy resolver across sparse, unordered, and duplicate section metadata', () => {
    const sections: HeaderFooterResolutionSection[] = [
      { sectionIndex: 7, headerRefs: { even: 'h7-even' }, footerRefs: { first: 'f7-first' } },
      { sectionIndex: 0, headerRefs: { default: 'h0-default', first: 'h0-first' } },
      { sectionIndex: 2, headerRefs: { odd: 'h2-old' }, footerRefs: { default: 'f2-default' } },
      { sectionIndex: 11, headerRefs: null, footerRefs: {} },
      { sectionIndex: 2, headerRefs: { odd: 'h2-odd', default: 'h2-default' }, footerRefs: { even: 'f2-even' } },
    ];
    const index = createHeaderFooterResolutionIndex(sections);
    const kinds: HeaderFooterKind[] = ['header', 'footer'];
    const variants: HeaderFooterVariant[] = ['default', 'first', 'even', 'odd'];

    for (let sectionIndex = 0; sectionIndex <= 12; sectionIndex += 1) {
      for (const kind of kinds) {
        for (const variant of variants) {
          expect(index.resolve(sectionIndex, kind, variant)).toEqual(
            resolveEffectiveHeaderFooterRef({ sections, sectionIndex, kind, variant }),
          );
        }
      }
    }
  });

  it('snapshots input refs so later caller mutation cannot stale the index', () => {
    const headerRefs = { default: 'h-before' };
    const sections: HeaderFooterResolutionSection[] = [{ sectionIndex: 0, headerRefs }];
    const index = createHeaderFooterResolutionIndex(sections);

    headerRefs.default = 'h-after';

    expect(index.resolve(0, 'header', 'default')?.refId).toBe('h-before');
    expect(
      resolveEffectiveHeaderFooterRef({ sections, sectionIndex: 0, kind: 'header', variant: 'default' })?.refId,
    ).toBe('h-after');
  });

  it('invalidates only changed effective refs and preserves any-ref state', () => {
    const index = createHeaderFooterResolutionIndex([
      { sectionIndex: 0, headerRefs: { default: 'h0' }, footerRefs: { default: 'f0' } },
      { sectionIndex: 2 },
    ]);
    const cachedHeader = index.resolve(2, 'header', 'odd');
    const cachedFooter = index.resolve(2, 'footer', 'default');

    expect(index.revision).toBe(0);
    expect(index.hasAny('header')).toBe(true);
    expect(index.hasAny('footer')).toBe(true);

    expect(
      index.updateSection({
        sectionIndex: 0,
        headerRefs: { default: 'h0', first: null, even: '' },
        footerRefs: { default: 'f0' },
      }),
    ).toBe(false);
    expect(index.revision).toBe(0);
    expect(index.resolve(2, 'header', 'odd')).toBe(cachedHeader);
    expect(index.resolve(2, 'footer', 'default')).toBe(cachedFooter);

    expect(
      index.updateSection({
        sectionIndex: 0,
        headerRefs: { default: 'h1' },
        footerRefs: { default: 'f0' },
      }),
    ).toBe(true);
    expect(index.revision).toBe(1);
    expect(index.resolve(2, 'header', 'odd')).toMatchObject({
      refId: 'h1',
      matchedSectionIndex: 0,
      matchedVariant: 'default',
    });
    expect(index.resolve(2, 'footer', 'default')).toBe(cachedFooter);

    expect(index.updateSection({ sectionIndex: 0 })).toBe(true);
    expect(index.revision).toBe(2);
    expect(index.hasAny('header')).toBe(false);
    expect(index.hasAny('footer')).toBe(false);
    expect(index.resolve(2, 'header', 'odd')).toBeNull();
    expect(index.resolve(2, 'footer', 'default')).toBeNull();
  });

  it('keeps cached earlier sections while invalidating the changed inheritance suffix', () => {
    const index = createHeaderFooterResolutionIndex([
      { sectionIndex: 0, headerRefs: { default: 'h0' } },
      { sectionIndex: 2 },
    ]);
    const earlier = index.resolve(0, 'header', 'default');
    const later = index.resolve(2, 'header', 'default');

    index.updateSection({ sectionIndex: 1, headerRefs: { default: 'h1' } });

    expect(index.resolve(0, 'header', 'default')).toBe(earlier);
    expect(index.resolve(2, 'header', 'default')).not.toBe(later);
    expect(index.resolve(2, 'header', 'default')).toMatchObject({
      refId: 'h1',
      matchedSectionIndex: 1,
    });
  });

  it('uses document page number for even/odd selection', () => {
    expect(
      selectHeaderFooterVariantForPage({
        documentPageNumber: 4,
        sectionPageNumber: 1,
        titlePg: false,
        alternateHeaders: true,
      }),
    ).toBe('even');
  });

  it('accepts non-positive document page numbers for parity when the section page is valid', () => {
    expect(
      selectHeaderFooterVariantForPage({
        documentPageNumber: 0,
        sectionPageNumber: 1,
        titlePg: false,
        alternateHeaders: true,
      }),
    ).toBe('even');
    expect(
      selectHeaderFooterVariantForPage({
        documentPageNumber: -1,
        sectionPageNumber: 1,
        titlePg: false,
        alternateHeaders: true,
      }),
    ).toBe('odd');
  });

  it('returns null when the section page number is invalid', () => {
    expect(
      selectHeaderFooterVariantForPage({
        documentPageNumber: 1,
        sectionPageNumber: 0,
        titlePg: false,
        alternateHeaders: false,
      }),
    ).toBeNull();
    expect(
      selectHeaderFooterVariantForPage({
        documentPageNumber: -1,
        sectionPageNumber: -1,
        titlePg: false,
        alternateHeaders: true,
      }),
    ).toBeNull();
  });
});
