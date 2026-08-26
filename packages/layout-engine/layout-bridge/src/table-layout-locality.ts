import type { TableBlock, TableFragment, TableMeasure } from '@superdoc/contracts';
import { computeTableDirtyRowRange } from './diff.js';

export type TableLayoutLocality = {
  blockId: string;
  previousBlock: TableBlock;
  currentBlock: TableBlock;
  previousMeasure: TableMeasure;
  currentMeasure: TableMeasure;
  previousFirstAffectedRow: number;
  previousLastAffectedRowExclusive: number;
  currentFirstAffectedRow: number;
  currentLastAffectedRowExclusive: number;
  stableSuffixRowStart: number | null;
};

const numbersEqual = (left: number | undefined, right: number | undefined): boolean =>
  left === right ||
  (left != null && right != null && Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-6);

const numberArraysEqual = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, index) => numbersEqual(value, right[index]));

const expandRowSpanClosure = (block: TableBlock, initialStart: number, initialEnd: number): [number, number] => {
  let start = Math.max(0, Math.min(initialStart, block.rows.length));
  let end = Math.max(start, Math.min(initialEnd, block.rows.length));
  let changed = true;
  while (changed) {
    changed = false;
    for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
      const rowSpan = Math.max(1, ...block.rows[rowIndex]!.cells.map((cell) => cell.rowSpan ?? 1));
      const rowEnd = Math.min(block.rows.length, rowIndex + rowSpan);
      if (rowIndex < end && rowEnd > start) {
        const nextStart = Math.min(start, rowIndex);
        const nextEnd = Math.max(end, rowEnd);
        if (nextStart !== start || nextEnd !== end) {
          start = nextStart;
          end = nextEnd;
          changed = true;
        }
      }
    }
  }
  return [start, end];
};

export function analyzeTableLayoutLocality(input: {
  previousBlock: TableBlock;
  currentBlock: TableBlock;
  previousMeasure: TableMeasure;
  currentMeasure: TableMeasure;
}): TableLayoutLocality | null {
  const dirtyRows = computeTableDirtyRowRange(input.previousBlock, input.currentBlock);
  if (!dirtyRows) return null;

  const [previousFirstAffectedRow, previousLastAffectedRowExclusive] = expandRowSpanClosure(
    input.previousBlock,
    dirtyRows.firstRow,
    dirtyRows.previousLastRowExclusive,
  );
  const [currentFirstAffectedRow, currentLastAffectedRowExclusive] = expandRowSpanClosure(
    input.currentBlock,
    dirtyRows.firstRow,
    dirtyRows.currentLastRowExclusive,
  );
  const columnGeometryStable =
    !dirtyRows.globalGeometryInputsChanged &&
    numberArraysEqual(input.previousMeasure.columnWidths, input.currentMeasure.columnWidths) &&
    numbersEqual(input.previousMeasure.totalWidth, input.currentMeasure.totalWidth) &&
    numbersEqual(input.previousMeasure.cellSpacingPx, input.currentMeasure.cellSpacingPx);
  const stableSuffixRowStart =
    dirtyRows.rowTopologyUnchanged && columnGeometryStable
      ? Math.max(previousLastAffectedRowExclusive, currentLastAffectedRowExclusive)
      : null;

  return {
    blockId: input.currentBlock.id,
    ...input,
    previousFirstAffectedRow,
    previousLastAffectedRowExclusive,
    currentFirstAffectedRow,
    currentLastAffectedRowExclusive,
    stableSuffixRowStart,
  };
}

const rangesOverlap = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean =>
  leftStart < rightEnd && rightStart < leftEnd;

export function tableFragmentTouchesAffectedRows(
  fragment: TableFragment,
  locality: TableLayoutLocality,
  generation: 'previous' | 'current',
): boolean {
  const first = generation === 'previous' ? locality.previousFirstAffectedRow : locality.currentFirstAffectedRow;
  const last =
    generation === 'previous' ? locality.previousLastAffectedRowExclusive : locality.currentLastAffectedRowExclusive;
  const repeatedHeaderCount = Math.max(0, fragment.repeatHeaderCount ?? 0);
  return (
    rangesOverlap(fragment.fromRow, fragment.toRow, first, last) || rangesOverlap(0, repeatedHeaderCount, first, last)
  );
}

export function tableFragmentIsStableSuffix(
  fragment: TableFragment,
  locality: TableLayoutLocality,
  generation: 'previous' | 'current',
): boolean {
  if (locality.stableSuffixRowStart == null) return false;
  if (tableFragmentTouchesAffectedRows(fragment, locality, generation)) return false;
  return fragment.fromRow >= locality.stableSuffixRowStart;
}
