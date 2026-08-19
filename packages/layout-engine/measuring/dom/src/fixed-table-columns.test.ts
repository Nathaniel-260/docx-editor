import { describe, expect, it } from 'vite-plus/test';
import type { WorkingTableGridInput } from './autofit-normalize.js';
import { computeFixedTableColumnWidths } from './fixed-table-columns.js';

describe('computeFixedTableColumnWidths', () => {
  it('preserves a plain authored grid when no row requests change it', () => {
    const result = computeFixedTableColumnWidths({
      layoutMode: 'fixed',
      maxTableWidth: 500,
      preferredColumnWidths: [60, 90],
      preferredTableWidth: undefined,
      gridColumnCount: 2,
      rows: [],
    });

    expect(result.columnWidths).toEqual([60, 90]);
    expect(result.totalWidth).toBe(150);
    expect(result.gridColumnCount).toBe(2);
  });

  it('shrinks proportionally to a dxa-style preferred table width target once row requests exceed it', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [100, 100],
        preferredTableWidth: 150,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [{ startColumn: 0, span: 2, preferredWidth: 240 }],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([62.5, 87.5]);
    expect(result.totalWidth).toBe(150);
  });

  it('shrinks proportionally to a pct-resolved preferred table width target once row requests exceed it', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [120, 80],
        preferredTableWidth: 100,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [{ startColumn: 0, span: 2, preferredWidth: 240 }],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([50, 50]);
    expect(result.totalWidth).toBe(100);
  });

  it('applies preferred table width even when no rows are present', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [100, 100],
        preferredTableWidth: 150,
        rows: [],
      }),
    );

    expect(result.columnWidths).toEqual([75, 75]);
    expect(result.totalWidth).toBe(150);
  });

  it('lets first-row skipped-column requests set widths downward', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [100],
        gridColumnCount: 1,
        rows: [
          {
            skippedBefore: [{ columnIndex: 0, preferredWidth: 40, minContentWidth: 0, maxContentWidth: 0 }],
            skippedAfter: [],
            skippedColumns: [{ columnIndex: 0, preferredWidth: 40, minContentWidth: 0, maxContentWidth: 0 }],
            logicalColumnCount: 1,
            cells: [],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([40]);
    expect(result.totalWidth).toBe(40);
  });

  it('applies row requests before shrinking to the preferred table width', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [100, 100],
        preferredTableWidth: 100,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [{ startColumn: 0, span: 2, preferredWidth: 150 }],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([66.66666666666666, 33.33333333333334]);
    expect(result.totalWidth).toBe(100);
  });

  it('lets first-row tcW requests set a span downward from a larger seeded width', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [80],
        gridColumnCount: 1,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [{ startColumn: 0, span: 2, preferredWidth: 80 }],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([80, 0]);
    expect(result.gridColumnCount).toBe(2);
    expect(result.totalWidth).toBe(80);
  });

  it('applies tcW requests by growing the affected logical span', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [60, 60],
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [
              { startColumn: 0, span: 1, preferredWidth: 100 },
              { startColumn: 1, span: 1, preferredWidth: 50 },
            ],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([100, 50]);
    expect(result.totalWidth).toBe(150);
  });

  it('reconciles later-row conflicts by adding width to the last column of the affected span', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [60, 60],
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [{ startColumn: 0, span: 2, preferredWidth: 150 }],
          },
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [
              { startColumn: 0, span: 1, preferredWidth: 100 },
              { startColumn: 1, span: 1, preferredWidth: 70 },
            ],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([100, 90]);
    expect(result.totalWidth).toBe(190);
  });

  // SD-3880: fixed 100%-width tables with an authored grid and repeated
  // full-grid merged rows whose tcW restates the grid total must not skew
  // width into the last logical column after preferred-table shrink.
  it('keeps authored proportions when later full-grid spans restate the grid total under a pct table width', () => {
    const preferredColumnWidths = [
      55.93333333333333, 46.86666666666667, 56.266666666666666, 38.53333333333333, 41.666666666666664, 44,
      45.666666666666664, 44.8, 45.733333333333334, 44.8, 45.666666666666664, 51.4, 51.333333333333336,
      41.13333333333333, 41.333333333333336, 56.266666666666666, 34.93333333333333, 53.86666666666667,
      56.666666666666664, 129.66666666666666,
    ];
    const authoredGridTotal = preferredColumnWidths.reduce((sum, width) => sum + width, 0);
    const preferredTableWidth = 624;
    const headerCells = preferredColumnWidths.map((preferredWidth, startColumn) => ({
      startColumn,
      span: 1,
      preferredWidth,
    }));
    const fullSpanRow = {
      skippedBefore: [],
      skippedAfter: [],
      skippedColumns: [],
      logicalColumnCount: preferredColumnWidths.length,
      cells: [{ startColumn: 0, span: preferredColumnWidths.length, preferredWidth: authoredGridTotal }],
    };

    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths,
        preferredTableWidth,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: preferredColumnWidths.length,
            cells: headerCells,
          },
          fullSpanRow,
          fullSpanRow,
          fullSpanRow,
          fullSpanRow,
        ],
      }),
    );

    const scale = preferredTableWidth / authoredGridTotal;
    expect(result.totalWidth).toBe(preferredTableWidth);
    expect(result.columnWidths).toHaveLength(20);
    for (let index = 0; index < preferredColumnWidths.length; index++) {
      expect(result.columnWidths[index]).toBeCloseTo(preferredColumnWidths[index]! * scale, 5);
    }
    expect(result.columnWidths.slice(0, 19).reduce((sum, width) => sum + width, 0)).toBeGreaterThan(500);
    expect(result.columnWidths[19]).toBeCloseTo(preferredColumnWidths[19]! * scale, 5);
  });

  it('keeps authored proportions when a later remaining-grid span after gridBefore restates the grid total', () => {
    const preferredColumnWidths = [200, 150, 150, 300];
    const authoredGridTotal = 800;
    const preferredTableWidth = 400;
    const scale = preferredTableWidth / authoredGridTotal;
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths,
        preferredTableWidth,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 4,
            cells: preferredColumnWidths.map((preferredWidth, startColumn) => ({
              startColumn,
              span: 1,
              preferredWidth,
            })),
          },
          {
            skippedBefore: [{ columnIndex: 0, preferredWidth: undefined, minContentWidth: 0, maxContentWidth: 0 }],
            skippedAfter: [],
            skippedColumns: [{ columnIndex: 0, preferredWidth: undefined, minContentWidth: 0, maxContentWidth: 0 }],
            logicalColumnCount: 4,
            cells: [{ startColumn: 1, span: 3, preferredWidth: authoredGridTotal }],
          },
        ],
      }),
    );

    expect(result.totalWidth).toBe(preferredTableWidth);
    expect(result.columnWidths).toHaveLength(4);
    for (let index = 0; index < preferredColumnWidths.length; index++) {
      expect(result.columnWidths[index]).toBeCloseTo(preferredColumnWidths[index]! * scale, 5);
    }
  });

  it('keeps authored proportions when a later skipped column restates the grid total as wBefore', () => {
    const preferredColumnWidths = [200, 150, 150, 300];
    const authoredGridTotal = 800;
    const preferredTableWidth = 400;
    const scale = preferredTableWidth / authoredGridTotal;
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths,
        preferredTableWidth,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 4,
            cells: preferredColumnWidths.map((preferredWidth, startColumn) => ({
              startColumn,
              span: 1,
              preferredWidth,
            })),
          },
          {
            skippedBefore: [
              { columnIndex: 0, preferredWidth: authoredGridTotal, minContentWidth: 0, maxContentWidth: 0 },
            ],
            skippedAfter: [],
            skippedColumns: [
              { columnIndex: 0, preferredWidth: authoredGridTotal, minContentWidth: 0, maxContentWidth: 0 },
            ],
            logicalColumnCount: 4,
            cells: [
              { startColumn: 1, span: 1, preferredWidth: undefined },
              { startColumn: 2, span: 1, preferredWidth: undefined },
              { startColumn: 3, span: 1, preferredWidth: undefined },
            ],
          },
        ],
      }),
    );

    expect(result.totalWidth).toBe(preferredTableWidth);
    expect(result.columnWidths).toHaveLength(4);
    for (let index = 0; index < preferredColumnWidths.length; index++) {
      expect(result.columnWidths[index]).toBeCloseTo(preferredColumnWidths[index]! * scale, 5);
    }
  });

  it('accounts for skipped columns and their preferred widths', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [],
        gridColumnCount: 3,
        rows: [
          {
            skippedBefore: [{ columnIndex: 0, preferredWidth: 40, minContentWidth: 0, maxContentWidth: 0 }],
            skippedAfter: [{ columnIndex: 2, preferredWidth: 20, minContentWidth: 0, maxContentWidth: 0 }],
            skippedColumns: [
              { columnIndex: 0, preferredWidth: 40, minContentWidth: 0, maxContentWidth: 0 },
              { columnIndex: 2, preferredWidth: 20, minContentWidth: 0, maxContentWidth: 0 },
            ],
            logicalColumnCount: 3,
            cells: [{ startColumn: 1, span: 1, preferredWidth: 60 }],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([40, 60, 20]);
    expect(result.totalWidth).toBe(120);
  });

  it('extends the logical grid when spans exceed the authored grid width', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [80],
        gridColumnCount: 2,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [{ startColumn: 0, span: 2, preferredWidth: 200 }],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([80, 120]);
    expect(result.gridColumnCount).toBe(2);
    expect(result.totalWidth).toBe(200);
  });

  it('assigns a non-zero default width to dynamically added grid columns', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [80],
        gridColumnCount: 1,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 2,
            cells: [{ startColumn: 0, span: 1, preferredWidth: 80 }],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([80, 80]);
    expect(result.gridColumnCount).toBe(2);
    expect(result.totalWidth).toBe(160);
  });

  it('shrinks after each row when cumulative requests exceed the preferred table width', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [100, 100, 100],
        preferredTableWidth: 240,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 3,
            cells: [
              { startColumn: 0, span: 1, preferredWidth: 120 },
              { startColumn: 1, span: 1, preferredWidth: 120 },
              { startColumn: 2, span: 1, preferredWidth: 120 },
            ],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([80, 80, 80]);
    expect(result.totalWidth).toBe(240);
  });

  it('preserves complete authored grid for fixed tables when grid sums to tblW', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [57.53333333333333, 239.46666666666667, 103],
        preferredTableWidth: 400,
        preserveAuthoredGrid: true,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 3,
            cells: [
              { startColumn: 0, span: 1, preferredWidth: 192 },
              { startColumn: 1, span: 1, preferredWidth: 96 },
              { startColumn: 2, span: 1, preferredWidth: 384 },
            ],
          },
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 3,
            cells: [
              { startColumn: 0, span: 1, preferredWidth: 192 },
              { startColumn: 1, span: 1, preferredWidth: 960 },
              { startColumn: 2, span: 1, preferredWidth: 384 },
            ],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([57.53333333333333, 239.46666666666667, 103]);
    expect(result.totalWidth).toBe(400);
  });

  it('still applies fixed tcW requests when authored grid is not protected', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        preferredColumnWidths: [57.53333333333333, 239.46666666666667],
        preferredTableWidth: 400,
        gridColumnCount: 3,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 3,
            cells: [
              { startColumn: 0, span: 1, preferredWidth: 192 },
              { startColumn: 1, span: 1, preferredWidth: 96 },
              { startColumn: 2, span: 1, preferredWidth: 384 },
            ],
          },
        ],
      }),
    );

    expect(result.columnWidths).not.toEqual([57.53333333333333, 239.46666666666667, 103]);
    expect(result.columnWidths[0]).toBeCloseTo(114.28571428571428, 10);
    expect(result.columnWidths[1]).toBeCloseTo(57.14285714285714, 10);
    expect(result.columnWidths[2]).toBeCloseTo(228.57142857142856, 10);
    expect(result.totalWidth).toBe(400);
  });

  it('preserves authored grid for AutoFit tables under preserveAutoGrid', () => {
    // Repro for TABLES-FIDELITY-AUTOFIT-COMPLETE-GRID-AUTO-WIDTH-001: when tblW=auto
    // with a complete authored grid, the first-row tcW requests must not inflate
    // the table beyond the authored-grid total.
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        layoutMode: 'autofit',
        preferredColumnWidths: [144, 144, 144, 144],
        preferredTableWidth: undefined,
        maxTableWidth: 576,
        preserveAutoGrid: true,
        rows: [
          {
            skippedBefore: [],
            skippedAfter: [],
            skippedColumns: [],
            logicalColumnCount: 4,
            cells: [
              { startColumn: 0, span: 1, preferredWidth: 240 },
              { startColumn: 1, span: 1, preferredWidth: 76.8 },
              { startColumn: 2, span: 1, preferredWidth: 144 },
              { startColumn: 3, span: 1, preferredWidth: 288 },
            ],
          },
        ],
      }),
    );

    expect(result.columnWidths).toEqual([144, 144, 144, 144]);
    expect(result.totalWidth).toBe(576);
  });

  it('does not clamp fixed results to the available container width', () => {
    const result = computeFixedTableColumnWidths(
      buildFixedInput({
        maxTableWidth: 400,
        preferredColumnWidths: [300, 300],
        rows: [],
      }),
    );

    expect(result.columnWidths).toEqual([300, 300]);
    expect(result.totalWidth).toBe(600);
  });
});

/**
 * Build a complete fixed-layout working-grid input with sensible defaults for
 * focused unit tests.
 */
function buildFixedInput(overrides: Partial<WorkingTableGridInput>): WorkingTableGridInput {
  return {
    layoutMode: 'fixed',
    maxTableWidth: 500,
    preferredTableWidth: undefined,
    preferredColumnWidths: [],
    gridColumnCount: overrides.preferredColumnWidths?.length ?? 0,
    rows: [],
    ...overrides,
  };
}
