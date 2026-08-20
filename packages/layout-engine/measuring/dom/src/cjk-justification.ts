import type { Run, TextRun } from '@superdoc/contracts';

const CJK_JUSTIFICATION_SCRIPT =
  /^(?:\p{Script_Extensions=Han}|\p{Script_Extensions=Hiragana}|\p{Script_Extensions=Katakana}|\p{Script_Extensions=Hangul})$/u;
const LETTER_CHARACTER = /^\p{Letter}$/u;
const MARK_CHARACTER = /^\p{Mark}$/u;
type GraphemeSegmenter = {
  segment(text: string): Iterable<{ segment: string; index: number }>;
};
type GraphemeSegmenterConstructor = new (
  locale?: string | string[],
  options?: { granularity: 'grapheme' },
) => GraphemeSegmenter;
const Segmenter = (Intl as typeof Intl & { Segmenter?: GraphemeSegmenterConstructor }).Segmenter;
const GRAPHEME_SEGMENTER =
  typeof Segmenter === 'function' ? new Segmenter(undefined, { granularity: 'grapheme' }) : undefined;

const isCjkGrapheme = (grapheme: string): boolean => {
  let hasCjkLetter = false;
  for (const character of grapheme) {
    if (LETTER_CHARACTER.test(character) && CJK_JUSTIFICATION_SCRIPT.test(character)) {
      hasCjkLetter = true;
      continue;
    }
    if (!MARK_CHARACTER.test(character)) return false;
  }
  return hasCjkLetter;
};

/**
 * Collects paintable inter-character opportunities for an entirely CJK-script line.
 * These offsets are independent of the kinsoku boundaries used for wrapping.
 */
export const collectCjkJustificationBoundaries = (runs: readonly Run[]): number[] | undefined => {
  if (!GRAPHEME_SEGMENTER) return undefined;
  const textParts: string[] = [];
  const runEndOffsets = new Set<number>();
  let offset = 0;

  for (const run of runs) {
    if ((run.kind !== 'text' && run.kind !== undefined) || !('text' in run)) return undefined;
    const textRun = run as TextRun;
    if (
      textRun.vanish ||
      textRun.visualPlaceholder != null ||
      textRun.token != null ||
      (textRun.letterSpacing ?? 0) !== 0 ||
      (textRun.horizontalScale ?? 1) !== 1 ||
      textRun.bidi?.rtl === true
    ) {
      return undefined;
    }

    textParts.push(textRun.text);
    offset += textRun.text.length;
    runEndOffsets.add(offset);
  }

  const text = textParts.join('');
  const boundaries: number[] = [];
  for (const { segment, index } of GRAPHEME_SEGMENTER.segment(text)) {
    if (!isCjkGrapheme(segment)) return undefined;
    boundaries.push(index + segment.length);
  }
  if (boundaries.length < 2) return undefined;
  if ([...runEndOffsets].some((runEnd) => runEnd < text.length && !boundaries.includes(runEnd))) return undefined;
  boundaries.pop();
  return boundaries;
};
