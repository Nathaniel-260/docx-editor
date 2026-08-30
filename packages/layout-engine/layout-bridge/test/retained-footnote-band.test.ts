import { describe, expect, it } from 'vite-plus/test';
import type { Page } from '@superdoc/contracts';
import { retainUnchangedFootnoteBand, type RetainedFootnoteBandInput } from '../src/retained-footnote-band';

function bandInput(): RetainedFootnoteBandInput {
  const previous: Page & { bodyMaxY: number } = {
    number: 3,
    sectionIndex: 0,
    size: { w: 800, h: 1000 },
    margins: { top: 40, left: 40, right: 40, bottom: 140 },
    bodyMaxY: 850,
    footnoteReserved: 100,
    fragments: [
      { kind: 'para', blockId: 'old-body', x: 40, y: 40, width: 720, fromLine: 0, toLine: 1 },
      { kind: 'para', blockId: 'note-1', x: 40, y: 890, width: 720, fromLine: 0, toLine: 1 },
      { kind: 'para', blockId: 'note-2', x: 40, y: 920, width: 720, fromLine: 0, toLine: 1 },
    ],
    footnoteLedger: {
      pageIndex: 2,
      anchorIds: ['1', '2'],
      mandatorySliceIds: ['1', '2'],
      continuationSliceIds: [],
      extendedSliceIds: [],
      continuationIn: [],
      continuationOut: [],
      mandatoryReservePx: 80,
      preferredReservePx: 80,
      actualBandHeightPx: 80,
      appliedBodyReservePx: 100,
      deadReservePx: 20,
      lastAnchorRenderedLines: 1,
    },
  };
  const current = {
    ...previous,
    footnoteReserved: undefined,
    footnoteLedger: undefined,
    bodyMaxY: 860,
    fragments: [{ ...previous.fragments[0]!, blockId: 'current-body' }],
  };
  return {
    previous,
    current,
    pageIndex: 2,
    pageSize: { w: 800, h: 1000 },
    columnCount: 1,
    appliedReserve: 100,
    anchorIds: ['1', '2'],
    previousBodyIndex: new Map([['old-body', 0]]),
    currentBodyIndex: new Map([['current-body', 0]]),
    retainedExtraIds: new Set(['note-1', 'note-2']),
  };
}

describe('complete retained footnote band', () => {
  it('keeps source note geometry and current body identity without mutating either page', () => {
    const input = bandInput();
    const before = structuredClone([input.previous, input.current]);

    const page = retainUnchangedFootnoteBand(input);

    expect(page?.fragments.map((fragment) => fragment.blockId)).toEqual(['current-body', 'note-1', 'note-2']);
    expect(page?.fragments.slice(1)).toEqual(input.previous.fragments.slice(1));
    expect(page?.footnoteLedger).toEqual(input.previous.footnoteLedger);
    expect(page?.footnoteReserved).toBe(100);
    expect([input.previous, input.current]).toEqual(before);
    expect(page).not.toBe(input.current);
    expect(page?.fragments[1]).not.toBe(input.previous.fragments[1]);
  });

  const negativeCases: Array<[string, (input: RetainedFootnoteBandInput) => void]> = [
    [
      'reordered anchors',
      (input) => {
        input.anchorIds = ['2', '1'];
      },
    ],
    [
      'moved anchor',
      (input) => {
        input.anchorIds = ['1'];
      },
    ],
    [
      'new anchor',
      (input) => {
        input.anchorIds = ['1', '2', '3'];
      },
    ],
    [
      'missing ledger',
      (input) => {
        delete input.previous.footnoteLedger;
      },
    ],
    [
      'wrong ledger page',
      (input) => {
        input.previous.footnoteLedger!.pageIndex = 1;
      },
    ],
    [
      'incoming continuation',
      (input) => {
        input.previous.footnoteLedger!.continuationIn = [{ id: '0', remainingRangeCount: 1, remainingHeightPx: 30 }];
      },
    ],
    [
      'outgoing continuation',
      (input) => {
        input.previous.footnoteLedger!.continuationOut = [{ id: '2', remainingRangeCount: 1, remainingHeightPx: 30 }];
      },
    ],
    [
      'continuation slice',
      (input) => {
        input.previous.footnoteLedger!.continuationSliceIds = ['0'];
      },
    ],
    [
      'reserve changed',
      (input) => {
        input.appliedReserve = 110;
      },
    ],
    [
      'reserve ownership mismatch',
      (input) => {
        input.previous.footnoteLedger!.appliedBodyReservePx = 90;
      },
    ],
    [
      'page width changed',
      (input) => {
        input.current.size = { w: 750, h: 1000 };
      },
    ],
    [
      'page margin changed',
      (input) => {
        input.current.margins = { ...input.current.margins!, left: 60 };
      },
    ],
    [
      'section changed',
      (input) => {
        input.current.sectionIndex = 1;
      },
    ],
    [
      'page index shifted',
      (input) => {
        input.current.number = 4;
      },
    ],
    [
      'multiple columns',
      (input) => {
        input.columnCount = 2;
      },
    ],
    [
      'column region',
      (input) => {
        input.current.columnRegions = [{ yStart: 40, yEnd: 800, columns: { count: 1, gap: 0 } }];
      },
    ],
    [
      'vertical alignment',
      (input) => {
        input.current.vAlign = 'center';
      },
    ],
    [
      'unowned note fragment',
      (input) => {
        input.retainedExtraIds = new Set(['note-1']);
      },
    ],
    [
      'already injected note',
      (input) => {
        input.current.fragments.push(input.previous.fragments[1]!);
      },
    ],
    [
      'body/band overlap',
      (input) => {
        (input.current as Page & { bodyMaxY: number }).bodyMaxY = 881;
      },
    ],
    [
      'missing body bounds',
      (input) => {
        delete (input.current as Page & { bodyMaxY?: number }).bodyMaxY;
      },
    ],
    [
      'nonfinite band bounds',
      (input) => {
        input.previous.footnoteLedger!.actualBandHeightPx = NaN;
      },
    ],
    [
      'source band outside its bounds',
      (input) => {
        input.previous.fragments[1]!.y = 875;
      },
    ],
  ];
  it.each(negativeCases)('falls back for %s', (_name, invalidate) => {
    const input = bandInput();
    invalidate(input);
    expect(retainUnchangedFootnoteBand(input)).toBeNull();
  });

  it('retains an empty band including previously applied dead reserve', () => {
    const input = bandInput();
    input.anchorIds = [];
    input.previous.fragments = input.previous.fragments.slice(0, 1);
    input.previous.footnoteLedger = {
      ...input.previous.footnoteLedger!,
      anchorIds: [],
      mandatorySliceIds: [],
      actualBandHeightPx: 0,
      mandatoryReservePx: 0,
      preferredReservePx: 0,
      deadReservePx: 100,
      lastAnchorRenderedLines: 0,
    };
    expect(retainUnchangedFootnoteBand(input)?.footnoteReserved).toBe(100);
  });
});
