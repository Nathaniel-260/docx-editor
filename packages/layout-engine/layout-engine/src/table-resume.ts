import type { Layout, LayoutBlockResumeCheckpoint } from '@superdoc/contracts';
import type { TableLayoutCursor } from './layout-table.js';

export type TableLayoutResumeCheckpoint = LayoutBlockResumeCheckpoint & {
  cursor: TableLayoutCursor;
};

export type TableLayoutResumeInput = {
  blockId: string;
  cursor: TableLayoutCursor;
};

const TABLE_LAYOUT_RESUME = Symbol.for('superdoc.layout.table-resume');
const TABLE_LAYOUT_RESUME_CHECKPOINTS = Symbol.for('superdoc.layout.table-resume-checkpoints');

export function readTableLayoutResume(options: object): TableLayoutResumeInput | null {
  return ((options as Record<PropertyKey, unknown>)[TABLE_LAYOUT_RESUME] as TableLayoutResumeInput | undefined) ?? null;
}

export function writeTableLayoutResume(options: object, resume: TableLayoutResumeInput): void {
  Object.defineProperty(options, TABLE_LAYOUT_RESUME, {
    configurable: true,
    enumerable: true,
    value: resume,
  });
}

export function readTableLayoutResumeCheckpoints(
  layout: Layout,
): ReadonlyMap<string, readonly TableLayoutResumeCheckpoint[]> | null {
  return (
    ((layout as unknown as Record<PropertyKey, unknown>)[TABLE_LAYOUT_RESUME_CHECKPOINTS] as
      | ReadonlyMap<string, readonly TableLayoutResumeCheckpoint[]>
      | undefined) ?? null
  );
}

export function writeTableLayoutResumeCheckpoints(
  layout: Layout,
  checkpoints: ReadonlyMap<string, readonly TableLayoutResumeCheckpoint[]>,
): void {
  Object.defineProperty(layout, TABLE_LAYOUT_RESUME_CHECKPOINTS, {
    configurable: true,
    enumerable: true,
    value: checkpoints,
  });
}
