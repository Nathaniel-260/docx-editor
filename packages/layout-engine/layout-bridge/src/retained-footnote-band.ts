import { columnRenderLayoutsEqual, resolveColumnCount } from '@superdoc/contracts';
import type { Page } from '@superdoc/contracts';

/** Inputs already fenced by exact note-source, render-input and same-index tail proofs. */
export interface RetainedFootnoteBandInput {
  previous: Page;
  current: Page;
  pageIndex: number;
  pageSize: { w: number; h: number };
  columnCount: number;
  appliedReserve: number;
  anchorIds: readonly string[];
  previousBodyIndex: ReadonlyMap<string, number>;
  currentBodyIndex: ReadonlyMap<string, number>;
  retainedExtraIds: ReadonlySet<string>;
}

/**
 * Reattach a complete, bottom-anchored note band to a freshly paginated body
 * page. No note is re-sliced: changed assignments, continuations, geometry or
 * insufficient body clearance must go through canonical footnote planning.
 */
export function retainUnchangedFootnoteBand(input: RetainedFootnoteBandInput): Page | null {
  const { previous, current, anchorIds, appliedReserve } = input;
  const ledger = previous.footnoteLedger;
  if (
    !ledger ||
    ledger.pageIndex !== input.pageIndex ||
    ledger.anchorIds.length !== anchorIds.length ||
    ledger.anchorIds.some((id, index) => id !== anchorIds[index]) ||
    ledger.continuationIn.length !== 0 ||
    ledger.continuationOut.length !== 0 ||
    ledger.continuationSliceIds.length !== 0 ||
    !Number.isFinite(appliedReserve) ||
    appliedReserve < 0 ||
    previous.footnoteReserved !== appliedReserve ||
    ledger.appliedBodyReservePx !== appliedReserve ||
    !Number.isFinite(ledger.actualBandHeightPx) ||
    ledger.actualBandHeightPx < 0
  )
    return null;

  const previousSize = previous.size ?? input.pageSize;
  const currentSize = current.size ?? input.pageSize;
  if (
    input.columnCount !== 1 ||
    resolveColumnCount(previous.columns ?? { count: 1, gap: 0 }) !== 1 ||
    resolveColumnCount(current.columns ?? { count: 1, gap: 0 }) !== 1 ||
    !columnRenderLayoutsEqual(previous.columns, current.columns) ||
    (previous.columnRegions?.length ?? 0) > 0 ||
    (current.columnRegions?.length ?? 0) > 0 ||
    previous.number !== current.number ||
    previous.sectionIndex !== current.sectionIndex ||
    previous.orientation !== current.orientation ||
    previous.vAlign !== current.vAlign ||
    (current.vAlign != null && current.vAlign !== 'top') ||
    previousSize.w !== currentSize.w ||
    previousSize.h !== currentSize.h ||
    !previous.margins ||
    !current.margins ||
    (['top', 'right', 'bottom', 'left'] as const).some((side) => previous.margins![side] !== current.margins![side])
  )
    return null;

  // A locally paginated body must not already contain retained note output.
  // Source body ids and current body ids can differ after a structural edit.
  if (current.fragments.some((fragment) => !input.currentBodyIndex.has(fragment.blockId))) return null;
  const noteFragments = previous.fragments.filter((fragment) => !input.previousBodyIndex.has(fragment.blockId));
  if (noteFragments.some((fragment) => !input.retainedExtraIds.has(fragment.blockId))) return null;
  if (ledger.actualBandHeightPx > 0 !== noteFragments.length > 0) return null;
  if (anchorIds.length > 0 && noteFragments.length === 0) return null;

  const previousBodyBottom = (previous as Page & { bodyMaxY?: number }).bodyMaxY;
  const currentBodyBottom = (current as Page & { bodyMaxY?: number }).bodyMaxY;
  const physicalBottom = currentSize.h - Math.max(0, (current.margins.bottom ?? NaN) - appliedReserve);
  const bandTop = physicalBottom - ledger.actualBandHeightPx;
  if (
    !Number.isFinite(previousBodyBottom) ||
    !Number.isFinite(currentBodyBottom) ||
    !Number.isFinite(bandTop) ||
    previousBodyBottom! > bandTop ||
    currentBodyBottom! > bandTop ||
    noteFragments.some((fragment) => !Number.isFinite(fragment.y) || fragment.y < bandTop)
  )
    return null;

  return {
    ...current,
    fragments: current.fragments.concat(noteFragments.map((fragment) => ({ ...fragment }))),
    footnoteReserved: appliedReserve,
    footnoteLedger: ledger,
  };
}
