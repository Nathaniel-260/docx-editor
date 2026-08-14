import { describe, expect, it, vi } from 'vite-plus/test';

import { incrementalLayout, measureCache } from '../src/incrementalLayout';

import type { FlowBlock, Measure, SectionBreakBlock } from '@superdoc/contracts';

const makeParagraph = (id: string, text: string): FlowBlock => ({
  kind: 'paragraph',
  id,
  runs: [{ text, fontFamily: 'Arial', fontSize: 12 }],
});

const makeParagraphMeasure = (lineHeight: number, runLength: number, maxWidth: number): Measure => ({
  kind: 'paragraph',
  lines: [
    {
      fromRun: 0,
      fromChar: 0,
      toRun: 0,
      toChar: runLength,
      width: Math.min(maxWidth, runLength * 7),
      ascent: lineHeight * 0.8,
      descent: lineHeight * 0.2,
      lineHeight,
      maxWidth,
    },
  ],
  totalHeight: lineHeight,
});

describe('incrementalLayout semantic flow', () => {
  it('rewrites section-break columns to single-column semantic width before layout', async () => {
    const semanticMargins = { top: 24, right: 100, bottom: 36, left: 100 };
    const semanticContentWidth = 600;
    const semanticPageWidth = semanticContentWidth + semanticMargins.left + semanticMargins.right;

    const firstSectionBreak: SectionBreakBlock = {
      kind: 'sectionBreak',
      id: 'sb-1',
      type: 'continuous',
      attrs: { isFirstSection: true, source: 'sectPr' },
      // Intentionally narrow + multi-column: would reduce paragraph fragment width
      // without semantic rewrite in incrementalLayout.
      pageSize: { w: 320, h: 900 },
      margins: { top: 12, right: 12, bottom: 12, left: 12 },
      columns: { count: 2, gap: 24 },
    };

    const paragraph = makeParagraph('p-1', 'Semantic section rewrite keeps this paragraph full-width.');
    const paragraphTextLength = paragraph.kind === 'paragraph' ? paragraph.runs[0].text.length : 1;

    const measureBlock = vi.fn(async (block: FlowBlock, constraints: { maxWidth: number; maxHeight: number }) => {
      if (block.kind !== 'paragraph') {
        throw new Error(`Unexpected block kind in test measure: ${block.kind}`);
      }
      return makeParagraphMeasure(20, paragraphTextLength, constraints.maxWidth);
    });

    const result = await incrementalLayout(
      [],
      null,
      [firstSectionBreak, paragraph],
      {
        flowMode: 'semantic',
        pageSize: { w: semanticPageWidth, h: 900 },
        margins: semanticMargins,
        semantic: {
          contentWidth: semanticContentWidth,
          marginTop: semanticMargins.top,
          marginBottom: semanticMargins.bottom,
        },
      },
      measureBlock,
    );

    const paragraphFragment = result.layout.pages
      .flatMap((page) => page.fragments)
      .find((fragment) => fragment.kind === 'para' && fragment.blockId === paragraph.id);

    expect(paragraphFragment).toBeDefined();
    expect(paragraphFragment?.width).toBe(semanticContentWidth);
  });

  it('preserves explicit fixed-width columns for semantic nextColumn sections', async () => {
    const semanticMargins = { top: 44, right: 88, bottom: 49, left: 90 };
    const semanticPageWidth = 816;
    const columns = { count: 2, gap: 0, widths: [272.67, 365.4], equalWidth: false };
    const continuous: SectionBreakBlock = {
      kind: 'sectionBreak',
      id: 'sb-continuous',
      type: 'continuous',
      pageSize: { w: 816, h: 1056 },
      margins: semanticMargins,
      columns,
      attrs: { sectionIndex: 5, source: 'sectPr' },
    };
    const left = makeParagraph('left-signature', 'By: ____ Name: Left Signer');
    const marker: FlowBlock = {
      kind: 'paragraph',
      id: 'continuous-marker',
      runs: [],
      attrs: { sectPrMarker: true },
    };
    const nextColumn: SectionBreakBlock = {
      kind: 'sectionBreak',
      id: 'sb-next-column',
      type: 'nextColumn',
      pageSize: { w: 816, h: 1056 },
      margins: semanticMargins,
      columns,
      attrs: { sectionIndex: 6, source: 'sectPr' },
    };
    const right = makeParagraph('right-signature', 'By: ____ Name: ____________________');

    const measureWidths: number[] = [];
    const measureBlock = vi.fn(async (block: FlowBlock, constraints: { maxWidth: number; maxHeight: number }) => {
      if (block.kind !== 'paragraph') {
        throw new Error(`Unexpected block kind in test measure: ${block.kind}`);
      }
      measureWidths.push(constraints.maxWidth);
      return makeParagraphMeasure(40, 12, constraints.maxWidth);
    });

    const result = await incrementalLayout(
      [],
      null,
      [continuous, left, marker, nextColumn, right],
      {
        flowMode: 'semantic',
        pageSize: { w: semanticPageWidth, h: 1056 },
        margins: semanticMargins,
        semantic: {
          contentWidth: semanticPageWidth - (semanticMargins.left + semanticMargins.right),
          marginTop: semanticMargins.top,
          marginBottom: semanticMargins.bottom,
        },
      },
      measureBlock,
    );

    const fragments = result.layout.pages.flatMap((page) => page.fragments);
    const leftFragment = fragments.find((fragment) => fragment.kind === 'para' && fragment.blockId === left.id);
    const markerFragment = fragments.find((fragment) => fragment.kind === 'para' && fragment.blockId === marker.id);
    const rightFragment = fragments.find((fragment) => fragment.kind === 'para' && fragment.blockId === right.id);

    expect(measureWidths).toEqual([272.67, 272.67, 365.4]);
    expect(leftFragment).toBeDefined();
    expect(markerFragment).toBeUndefined();
    expect(rightFragment).toBeDefined();
    expect(leftFragment?.width).toBeCloseTo(272.67);
    expect(rightFragment?.x).toBeCloseTo(semanticMargins.left + 272.67);
    expect(rightFragment?.y).toBeCloseTo(leftFragment!.y);
    expect(rightFragment?.width).toBeCloseTo(365.4);
  });

  it('skips header/footer layout work in semantic flow mode', async () => {
    const paragraph = makeParagraph('body-1', 'Body content');
    const headerParagraph = makeParagraph('header-1', 'Header content');

    const measureBlock = vi.fn(async (block: FlowBlock, constraints: { maxWidth: number; maxHeight: number }) => {
      if (block.kind !== 'paragraph') {
        throw new Error(`Unexpected block kind in test measure: ${block.kind}`);
      }
      const runLength = block.runs[0]?.text?.length ?? 1;
      return makeParagraphMeasure(20, runLength, constraints.maxWidth);
    });

    const headerMeasure = vi.fn(async (block: FlowBlock, constraints: { maxWidth: number; maxHeight: number }) => {
      if (block.kind !== 'paragraph') {
        throw new Error(`Unexpected header block kind in test measure: ${block.kind}`);
      }
      const runLength = block.runs[0]?.text?.length ?? 1;
      return makeParagraphMeasure(20, runLength, constraints.maxWidth);
    });

    const result = await incrementalLayout(
      [],
      null,
      [paragraph],
      {
        flowMode: 'semantic',
        pageSize: { w: 800, h: 900 },
        margins: { top: 40, right: 100, bottom: 40, left: 100 },
        semantic: { contentWidth: 600, marginTop: 40, marginBottom: 40 },
      },
      measureBlock,
      {
        headerBlocks: { default: [headerParagraph] },
        constraints: { width: 600, height: 80 },
        measure: headerMeasure,
      },
    );

    expect(result.headers).toBeUndefined();
    expect(result.footers).toBeUndefined();
    expect(headerMeasure).not.toHaveBeenCalled();
  });

  it('returns reconciled per-call bridge timing without forcing header/footer work', async () => {
    measureCache.clear();
    const paragraph = makeParagraph('body-1', 'Body content');
    const measureBlock = vi.fn(async (block: FlowBlock, constraints: { maxWidth: number; maxHeight: number }) => {
      if (block.kind !== 'paragraph') {
        throw new Error(`Unexpected block kind in test measure: ${block.kind}`);
      }
      const runLength = block.runs[0]?.text?.length ?? 1;
      return makeParagraphMeasure(20, runLength, constraints.maxWidth);
    });

    const result = await incrementalLayout(
      [],
      null,
      [paragraph],
      {
        flowMode: 'semantic',
        pageSize: { w: 800, h: 900 },
        margins: { top: 40, right: 100, bottom: 40, left: 100 },
        semantic: { contentWidth: 600, marginTop: 40, marginBottom: 40 },
      },
      measureBlock,
    );

    const timing = result.bridgeTiming;
    expect(timing.totalMs).toBeGreaterThanOrEqual(0);
    expect(timing.measureTotalMs).toBeGreaterThanOrEqual(timing.measureActualMs);
    expect(Math.abs(timing.measureCallbackWallMs - timing.measureActualMs)).toBeLessThanOrEqual(0.1);
    expect(timing.headerFooterPreLayoutMs).toBe(0);
    expect(timing.finalHeaderFooterMs).toBe(0);
    expect(timing.counters.blocksRead).toBe(1);
    expect(timing.counters.blocksByKind).toEqual({
      paragraph: 1,
      image: 0,
      drawing: 0,
      list: 0,
      table: 0,
      sectionBreak: 0,
      pageBreak: 0,
      columnBreak: 0,
    });
    expect(timing.counters.bodyBlocksMeasuredByKind.paragraph).toBe(1);
    expect(timing.counters.bodyMeasureCacheReads).toBe(1);
    expect(timing.counters.bodyMeasureCacheWrites).toBe(1);
    expect(timing.counters.bodyMeasureCacheKeyComputations).toBe(1);
    expect(timing.counters.measureContentSignatureComputations).toBe(0);
    expect(timing.counters.cacheMisses).toBe(1);
    expect(timing.counters.measuresAdopted).toBe(0);
    expect(timing.counters.paginationPasses).toBe(1);
    expect(timing.counters.pageTokenRelayouts).toBe(0);
    expect(timing.counters.footnoteRelayouts).toBe(0);
    expect(
      timing.counters.footnoteReserveRelayouts +
        timing.counters.footnoteGrowRelayouts +
        timing.counters.footnoteTightenRelayouts +
        timing.counters.footnotePreferredRelayouts +
        timing.counters.footnoteWidowRelayouts +
        timing.counters.footnoteRevertRelayouts +
        timing.counters.footnoteOtherRelayouts,
    ).toBe(timing.counters.footnoteRelayouts);
    const additive =
      timing.inputPreparationMs +
      timing.measureTotalMs +
      timing.headerFooterPreLayoutMs +
      timing.warmStartPreparationMs +
      timing.layoutDocumentMs +
      timing.layoutReuseOrchestrationMs +
      timing.pageTokenSetupMs +
      timing.pageTokenTotalMs +
      timing.footnoteMs +
      timing.numberingMs +
      timing.finalHeaderFooterMs +
      timing.layoutExposureMs +
      timing.unattributedMs;
    expect(Math.abs(additive - timing.totalMs)).toBeLessThanOrEqual(0.01);
    expect(timing.paginationMs).toBe(timing.layoutDocumentMs);
    expect(
      Math.abs(timing.paginationInitialMs - (timing.layoutDocumentMs + timing.layoutReuseOrchestrationMs)),
    ).toBeLessThanOrEqual(0.01);
    expect(timing.paginationPageTokenMs).toBe(0);
    expect(timing.paginationFootnoteMs).toBe(0);
    expect(timing.paginationTotalMs).toBe(timing.paginationInitialMs);
    expect(timing.layoutReuseOrchestrationMs).toBeGreaterThanOrEqual(0);
  });

  it('stamps section display numbering onto body page context without chapter prefixes', async () => {
    const paragraph = makeParagraph('body-1', 'Body content');
    const measureBlock = vi.fn(async (block: FlowBlock, constraints: { maxWidth: number; maxHeight: number }) => {
      if (block.kind !== 'paragraph') {
        throw new Error(`Unexpected block kind in test measure: ${block.kind}`);
      }
      const runLength = block.runs[0]?.text?.length ?? 1;
      return makeParagraphMeasure(20, runLength, constraints.maxWidth);
    });

    const result = await incrementalLayout(
      [],
      null,
      [paragraph],
      {
        flowMode: 'semantic',
        pageSize: { w: 800, h: 900 },
        margins: { top: 40, right: 100, bottom: 40, left: 100 },
        semantic: { contentWidth: 600, marginTop: 40, marginBottom: 40 },
        sectionMetadata: [{ sectionIndex: 0, numbering: { start: 5, format: 'upperRoman' } }],
      },
      measureBlock,
    );

    expect(result.layout.pages[0]?.numberText).toBe('V');
    expect(result.layout.pages[0]?.displayNumber).toBe(5);
    expect(result.layout.pages[0]?.pageNumberFormat).toBe('upperRoman');
  });
});
