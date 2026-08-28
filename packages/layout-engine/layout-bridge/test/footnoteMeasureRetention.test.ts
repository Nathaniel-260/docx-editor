import { afterEach, describe, expect, it } from 'vite-plus/test';
import type { FlowBlock, Measure } from '@superdoc/contracts';
import { clearIncrementalModuleState, incrementalLayout, measureCache } from '../src/incrementalLayout';

const makeParagraph = (id: string, text: string, pmStart: number): FlowBlock => ({
  kind: 'paragraph',
  id,
  runs: [{ text, fontFamily: 'Arial', fontSize: 12, pmStart, pmEnd: pmStart + text.length }],
});

const makeMeasure = (lineHeight: number, lineCount: number): Measure => ({
  kind: 'paragraph',
  lines: Array.from({ length: lineCount }, (_, index) => ({
    fromRun: 0,
    fromChar: index,
    toRun: 0,
    toChar: index + 1,
    width: 200,
    ascent: lineHeight * 0.8,
    descent: lineHeight * 0.2,
    lineHeight,
  })),
  totalHeight: lineCount * lineHeight,
});

describe('footnote measurement retention', () => {
  afterEach(() => clearIncrementalModuleState());

  it('measures each note block at most once during one cold convergence run', async () => {
    clearIncrementalModuleState();

    const bodyBlocks: FlowBlock[] = [];
    let position = 0;
    for (let index = 0; index < 40; index += 1) {
      const text = `Body line ${index + 1}.`;
      bodyBlocks.push(makeParagraph(`body-${index}`, text, position));
      position += text.length + 1;
    }

    // One rendered note block forces reserve convergence. The empty measured
    // blocks model a large note story without making the synthetic layout
    // itself thousands of pages long. Exceeding the shared LRU capacity is
    // essential: repeated same-order scans otherwise look like cache hits.
    const noteBlocks: FlowBlock[] = [makeParagraph('footnote-rendered', 'Big footnote.', 0)];
    for (let index = 0; index < measureCache.getMaxSize(); index += 1) {
      noteBlocks.push(makeParagraph(`footnote-empty-${index}`, '', 0));
    }

    let noteMeasureCalls = 0;
    const measureBlock = async (block: FlowBlock): Promise<Measure> => {
      if (block.id === 'footnote-rendered') {
        noteMeasureCalls += 1;
        return makeMeasure(12, 60);
      }
      if (block.id.startsWith('footnote-empty-')) {
        noteMeasureCalls += 1;
        return makeMeasure(0, 0);
      }
      return makeMeasure(20, 1);
    };

    const margins = { top: 72, right: 72, bottom: 72, left: 72 };
    const result = await incrementalLayout(
      [],
      null,
      bodyBlocks,
      {
        pageSize: { w: 612, h: 600 + margins.top + margins.bottom },
        margins,
        footnotes: {
          refs: [{ id: '1', pos: 2 }],
          blocksById: new Map([['1', noteBlocks]]),
          topPadding: 6,
          dividerHeight: 6,
        },
      },
      measureBlock,
    );

    expect(result.bridgeTiming.counters.footnoteRelayouts).toBeGreaterThan(0);
    expect(noteMeasureCalls).toBe(noteBlocks.length);
  }, 30_000);
});
