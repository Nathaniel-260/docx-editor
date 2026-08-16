import {
  computeWordListMarker,
  type ComputeWordListMarkerResult,
  type WordListMarkerDefinition,
} from './list-marker.js';
import {
  createNumberingManager,
  type NumberingCursor,
  type NumberingManager,
  type NumberingManagerSnapshot,
} from './numbering-manager.js';

export type ReviewAwareNumberingMembership = 'ordinary' | 'inserted' | 'deleted' | 'malformed';
export type ReviewAwareNumberingStateMode = 'snapshot' | 'cursor';

export interface ReviewAwareWordNumberingDefinition extends WordListMarkerDefinition {
  restartNumberingAfterBreak?: boolean;
}

export type ReviewAwareWordMarkerFact =
  | { status: 'resolved'; result: ComputeWordListMarkerResult }
  | { status: 'unresolved'; reason: 'missingLvlText' | 'malformedMembership' };

export interface ReviewAwareWordNumberingResult {
  final: ReviewAwareWordMarkerFact | null;
  original: ReviewAwareWordMarkerFact | null;
  redline: ReviewAwareWordMarkerFact;
}

export interface ReviewAwareWordNumberingSnapshot {
  live?: NumberingManagerSnapshot | NumberingCursor;
  original?: NumberingManagerSnapshot | NumberingCursor;
  liveSectionEpoch: number;
  originalSectionEpoch: number;
}

export interface ReviewAwareWordNumberingSequence {
  advance(input: {
    definition: ReviewAwareWordNumberingDefinition;
    paragraphOrdinal: number;
    membership: ReviewAwareNumberingMembership;
  }): ReviewAwareWordNumberingResult;
  advanceSectionBreak(membership: ReviewAwareNumberingMembership): void;
  captureSnapshot(): ReviewAwareWordNumberingSnapshot;
  restoreSnapshot(snapshot: ReviewAwareWordNumberingSnapshot | null): void;
  counterScope(definition: ReviewAwareWordNumberingDefinition, plane: 'live' | 'original'): string;
  retainedState(): readonly [NumberingManager, NumberingManager];
}

export function createReviewAwareWordNumberingSequence(
  options: {
    stateMode?: ReviewAwareNumberingStateMode;
  } = {},
): ReviewAwareWordNumberingSequence {
  const stateMode = options.stateMode ?? 'snapshot';
  let live = createManager(stateMode);
  let original = createManager(stateMode);
  let liveSectionEpoch = 0;
  let originalSectionEpoch = 0;

  return {
    advance({ definition, paragraphOrdinal, membership }) {
      if (membership === 'malformed') {
        const unresolved = { status: 'unresolved', reason: 'malformedMembership' } as const;
        return { final: unresolved, original: unresolved, redline: unresolved };
      }
      const final =
        membership === 'deleted'
          ? null
          : computeFact(live, scopeDefinition(definition, liveSectionEpoch), paragraphOrdinal);
      const originalFact =
        membership === 'inserted'
          ? null
          : computeFact(original, scopeDefinition(definition, originalSectionEpoch), paragraphOrdinal);
      return {
        final,
        original: originalFact,
        redline: membership === 'deleted' ? originalFact! : final!,
      };
    },
    advanceSectionBreak(membership) {
      if (membership === 'ordinary' || membership === 'inserted') liveSectionEpoch += 1;
      if (membership === 'ordinary' || membership === 'deleted') originalSectionEpoch += 1;
    },
    captureSnapshot() {
      return {
        live: stateMode === 'cursor' ? live.captureCursor() : live.exportSnapshot(),
        original: stateMode === 'cursor' ? original.captureCursor() : original.exportSnapshot(),
        liveSectionEpoch,
        originalSectionEpoch,
      };
    },
    restoreSnapshot(snapshot) {
      live = createManager(stateMode);
      original = createManager(stateMode);
      liveSectionEpoch = snapshot?.liveSectionEpoch ?? 0;
      originalSectionEpoch = snapshot?.originalSectionEpoch ?? 0;
      if (snapshot?.live) restoreManager(live, snapshot.live, stateMode);
      if (snapshot?.original) restoreManager(original, snapshot.original, stateMode);
    },
    counterScope(definition, plane) {
      return reviewAwareWordNumberingCounterScope(definition, plane, {
        liveSectionEpoch,
        originalSectionEpoch,
      });
    },
    retainedState() {
      return [live, original];
    },
  };
}

export function reviewAwareWordNumberingCounterScope(
  definition: ReviewAwareWordNumberingDefinition,
  plane: 'live' | 'original',
  epochs: Pick<ReviewAwareWordNumberingSnapshot, 'liveSectionEpoch' | 'originalSectionEpoch'>,
): string {
  const epoch = plane === 'original' ? epochs.originalSectionEpoch : epochs.liveSectionEpoch;
  const section = definition.restartNumberingAfterBreak ? `:section:${epoch}` : '';
  return `abstract:${definition.abstractId}${section}`;
}

function computeFact(
  manager: NumberingManager,
  definition: ReviewAwareWordNumberingDefinition,
  paragraphOrdinal: number,
): ReviewAwareWordMarkerFact {
  const result = computeWordListMarker({ definition, manager, paragraphOrdinal });
  if (definition.numFmt !== 'none' && definition.lvlText == null) {
    return { status: 'unresolved', reason: 'missingLvlText' };
  }
  return { status: 'resolved', result };
}

function scopeDefinition(
  definition: ReviewAwareWordNumberingDefinition,
  sectionEpoch: number,
): WordListMarkerDefinition {
  if (!definition.restartNumberingAfterBreak) return definition;
  const section = `:section:${sectionEpoch}`;
  return {
    ...definition,
    numId: `num:${definition.numId}${section}`,
    abstractId: `abstract:${definition.abstractId}${section}`,
  };
}

function createManager(stateMode: ReviewAwareNumberingStateMode): NumberingManager {
  const manager = createNumberingManager();
  if (stateMode === 'cursor') manager.enableCompactMode();
  else manager.enableCache();
  return manager;
}

function restoreManager(
  manager: NumberingManager,
  state: NumberingManagerSnapshot | NumberingCursor,
  stateMode: ReviewAwareNumberingStateMode,
): void {
  if (stateMode === 'cursor') manager.restoreCursor(state as NumberingCursor);
  else manager.restoreSnapshot(state as NumberingManagerSnapshot);
}
