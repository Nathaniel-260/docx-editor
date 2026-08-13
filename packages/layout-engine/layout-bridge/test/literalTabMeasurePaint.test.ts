// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParagraphBlock, ParagraphMeasure } from '@superdoc/contracts';
import { measureBlock } from '@superdoc/measuring-dom';
import { resolveCanvas } from '../../measuring/dom/src/canvas-resolver.js';
import { installNodeCanvasPolyfill } from '../../measuring/dom/src/setup.js';
import { renderLine } from '../../painters/dom/src/runs/render-line.js';
import type { RunRenderContext } from '../../painters/dom/src/runs/types.js';

const { Canvas } = resolveCanvas();

beforeAll(() => {
  installNodeCanvasPolyfill({ document, Canvas });
});

const makeRunContext = (): RunRenderContext => ({
  doc: document,
  layoutEpoch: 0,
  showFormattingMarks: false,
  contentControlsChrome: 'default',
  resolvePhysical: (family) => family,
  pendingTooltips: new WeakMap<HTMLElement, string>(),
  getNextLinkId: () => 'link-1',
  applySdtDataset: () => {},
  buildImageHyperlinkAnchor: (child) => child,
  resolveTrackedChangesConfig: () => ({ mode: 'final', enabled: false }),
  applyTrackedChangeDecorations: () => {},
  resolveRunSdtId: () => null,
  createInlineSdtWrapper: () => document.createElement('span'),
  syncInlineSdtWrapperTypography: () => {},
  expandSdtWrapperPmRange: () => {},
});

describe('literal tab measurement and painting', () => {
  it('paints each authored slice once without crossing the bold-to-regular boundary', async () => {
    const block: ParagraphBlock = {
      kind: 'paragraph',
      id: 'sd-3886-measure-paint',
      runs: [
        {
          text: '1.2\tName. ',
          fontFamily: 'Arial',
          fontSize: 16,
          bold: true,
          pmStart: 100,
          pmEnd: 110,
        },
        { text: 'Body', fontFamily: 'Arial', fontSize: 16, pmStart: 110, pmEnd: 114 },
      ],
      attrs: { tabs: [{ pos: 480, val: 'start' }] },
    };
    const measured = await measureBlock(block, 1000);
    expect(measured.kind).toBe('paragraph');
    const measure = measured as ParagraphMeasure;
    const line = measure.lines[0];

    const lineElement = renderLine({
      block,
      line,
      lineIndex: 0,
      context: { pageNumber: 1, totalPages: 1, section: 'body' },
      runContext: makeRunContext(),
    });
    const textRuns = Array.from(lineElement.querySelectorAll<HTMLElement>('.superdoc-text-run'));
    const heading = textRuns.find((element) => element.textContent === 'Name.');
    const trailingSpace = textRuns.find((element) => element.textContent === ' ');
    const body = textRuns.find((element) => element.textContent === 'Body');
    const trailingSpaceSegment = line.segments?.find((segment) => segment.runIndex === 0 && segment.fromChar === 9);
    const bodySegment = line.segments?.find((segment) => segment.runIndex === 1);

    expect(textRuns.map((element) => element.textContent)).toEqual(['1.2', 'Name.', ' ', 'Body']);
    expect(lineElement.textContent).toBe('1.2Name. Body');
    expect(heading?.style.fontWeight).toBe('bold');
    expect(trailingSpace?.style.fontWeight).toBe('bold');
    expect(body?.style.fontWeight).toBe('');
    expect(body?.dataset.pmStart).toBe('110');
    expect(Number.parseFloat(body?.style.left ?? '')).toBeCloseTo(
      Number.parseFloat(trailingSpace?.style.left ?? '') + (trailingSpaceSegment?.width ?? Number.NaN),
      3,
    );
    expect(bodySegment?.x).toBeUndefined();
  });
});
