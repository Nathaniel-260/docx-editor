import { describe, expect, it } from 'bun:test';
import {
  createReviewAwareWordNumberingSequence,
  type ReviewAwareWordNumberingDefinition,
} from '../src/review-aware-numbering.js';

const decimal: ReviewAwareWordNumberingDefinition = {
  numId: 1,
  abstractId: 1,
  ilvl: 0,
  start: 1,
  startOverridden: false,
  lvlText: '%1.',
  numFmt: 'decimal',
};

function text(
  result: ReturnType<ReturnType<typeof createReviewAwareWordNumberingSequence>['advance']>['redline'],
): string | null {
  return result.status === 'resolved' ? result.result.listRenderingAttrs.markerText : null;
}

describe('review-aware Word numbering sequence', () => {
  it('isolates live and original counters for inserted and deleted paragraphs', () => {
    const sequence = createReviewAwareWordNumberingSequence();
    expect(text(sequence.advance({ definition: decimal, paragraphOrdinal: 0, membership: 'ordinary' }).redline)).toBe(
      '1.',
    );
    const inserted = sequence.advance({ definition: decimal, paragraphOrdinal: 1, membership: 'inserted' });
    expect(text(inserted.redline)).toBe('2.');
    expect(inserted.original).toBeNull();
    const deleted = sequence.advance({ definition: decimal, paragraphOrdinal: 2, membership: 'deleted' });
    expect(deleted.final).toBeNull();
    expect(text(deleted.redline)).toBe('2.');
    const ordinary = sequence.advance({ definition: decimal, paragraphOrdinal: 3, membership: 'ordinary' });
    expect(text(ordinary.final!)).toBe('3.');
    expect(text(ordinary.original!)).toBe('3.');
  });

  it('captures both counter planes and independent section epochs', () => {
    const definition = { ...decimal, restartNumberingAfterBreak: true };
    const sequence = createReviewAwareWordNumberingSequence();
    sequence.advance({ definition, paragraphOrdinal: 0, membership: 'ordinary' });
    const snapshot = sequence.captureSnapshot();
    sequence.advanceSectionBreak('inserted');
    expect(sequence.counterScope(definition, 'live')).toBe('abstract:1:section:1');
    expect(sequence.counterScope(definition, 'original')).toBe('abstract:1:section:0');
    const afterInsertedBreak = sequence.advance({ definition, paragraphOrdinal: 1, membership: 'ordinary' });
    expect(text(afterInsertedBreak.final!)).toBe('1.');
    expect(text(afterInsertedBreak.original!)).toBe('2.');
    expect(text(sequence.advance({ definition, paragraphOrdinal: 2, membership: 'deleted' }).original!)).toBe('3.');
    sequence.restoreSnapshot(snapshot);
    const restored = sequence.advance({ definition, paragraphOrdinal: 1, membership: 'ordinary' });
    expect(text(restored.final!)).toBe('2.');
    expect(text(restored.original!)).toBe('2.');
  });

  it('fails closed for missing level text and malformed membership', () => {
    const sequence = createReviewAwareWordNumberingSequence();
    expect(
      sequence.advance({
        definition: { ...decimal, lvlText: undefined },
        paragraphOrdinal: 0,
        membership: 'ordinary',
      }).redline,
    ).toEqual({ status: 'unresolved', reason: 'missingLvlText' });
    expect(text(sequence.advance({ definition: decimal, paragraphOrdinal: 1, membership: 'ordinary' }).redline)).toBe(
      '2.',
    );
    expect(sequence.advance({ definition: decimal, paragraphOrdinal: 1, membership: 'malformed' }).redline).toEqual({
      status: 'unresolved',
      reason: 'malformedMembership',
    });
  });

  it('restores same-realm compact cursors for scoped prefix continuation', () => {
    const sequence = createReviewAwareWordNumberingSequence({ stateMode: 'cursor' });
    sequence.advance({ definition: decimal, paragraphOrdinal: 0, membership: 'ordinary' });
    const snapshot = sequence.captureSnapshot();
    const continued = sequence.advance({ definition: decimal, paragraphOrdinal: 1, membership: 'ordinary' });
    expect(text(continued.redline)).toBe('2.');
    sequence.restoreSnapshot(snapshot);
    expect(text(sequence.advance({ definition: decimal, paragraphOrdinal: 1, membership: 'ordinary' }).redline)).toBe(
      '2.',
    );
  });
});
