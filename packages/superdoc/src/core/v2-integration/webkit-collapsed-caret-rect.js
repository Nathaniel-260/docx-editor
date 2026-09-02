// WebKit browser-bug workaround for the V2 caret.
//
// WebKit returns an EMPTY client-rect list for a **collapsed** `Range` placed at
// the end of a text node, in a range of situations where Chromium and Firefox
// both report the caret correctly. `Range.getBoundingClientRect()` is no better
// in that state: it reports an all-zero rect. A *non-collapsed* range over the
// same character is measured correctly by every engine, WebKit included, which
// is what makes a repair possible at all.
//
// Measured triggers (`dir` x `white-space` x trailing character sweep), all at
// the end-of-text-node boundary:
//   - RTL text with preserved whitespace ending in a space or tab,
//   - RTL text ending in a digit or a Latin letter, in ANY white-space mode,
//   - LTR text ending in a digit, in ANY white-space mode.
// A trailing NBSP is measured correctly everywhere. What these share is a
// boundary the bidi algorithm treats as a level or whitespace edge, so
// installation keys off the *measurement failing*, never off a character class.
//
// The engine's caret layer resolves the caret from that collapsed range and,
// when it comes back empty, falls back to an adjacent character's rect. Its
// fallback picks LTR edges (the *right* edge of the preceding character), so in
// an RTL paragraph the caret is painted at the boundary *before* the trailing
// space — one position behind where typing actually continues. Hebrew and Arabic
// authors hit this between every two words, which is most of the time they are
// typing. See https://github.com/superdoc/docx-editor/issues/3943. (The LTR
// trailing-digit case is invisible only because the LTR edge happens to be the
// right answer there.)
//
// This module restores the missing measurement at its source: it wraps
// `Range.getClientRects` / `Range.getBoundingClientRect` so that a collapsed
// range inside a text node the browser refuses to measure is answered from the
// neighbouring character's rect plus that character's own bidi direction.
//
// Three deliberate choices, because this patches a DOM built-in in a library
// that is embedded in someone else's page:
//   - It only ever answers for text inside a mounted SuperDoc runtime. A range
//     anywhere else in the host page gets the browser's own result, byte for
//     byte, so host code that reads "no rects" as "not rendered" keeps seeing
//     exactly what it sees today.
//   - It is installed only after the quirk is observed in the live browser, so
//     Chromium, Firefox, a fixed future WebKit, and non-layout environments
//     (jsdom, SSR) run entirely unpatched.
//   - Installation can never throw. A caret nicety must not be able to reject
//     the engine-load promise and drop the editor to its fail-closed stub, so
//     every step is guarded and failure degrades to "not installed".
//
// Once installed it stays for the page's lifetime rather than being undone on
// `destroy()`: the patch belongs to the realm, not to one editor, and tearing it
// down would regress any other live instance. The returned uninstall exists for
// tests and for a host that wants explicit control.
//
// The durable fix belongs in the engine's caret resolver, which should pick the
// *logical* edge of the neighbouring glyph instead of assuming LTR. This shim
// can be deleted once that ships and the engine floor is raised past it.

import { RUNTIME_ROOT_ATTRIBUTE } from '../editor-runtime/root-marker.js';

/**
 * Boundaries to probe for the defect, each `[direction, whiteSpace, text]`.
 *
 * Detecting only the reported RTL trailing-space case would silently drop the
 * workaround for the others the moment WebKit fixes that one boundary alone, so
 * every measured trigger family is probed and any single failure installs.
 */
const PROBE_CASES = [
  ['rtl', 'pre', 'שלום '],
  ['rtl', 'normal', 'שלום 1'],
  ['ltr', 'normal', 'abc 1'],
];

/** Marks this module's own patched methods, so a second install is a no-op. */
const INSTALLED_FLAG = '__superdocWebkitCollapsedCaretRectFix';

/**
 * How many times a window that cannot be measured at all is re-probed before the
 * workaround gives up on it.
 *
 * A window is deliberately not cached as clean while it answers "unknown": it
 * may simply have had no layout yet, and re-probing costs less than never
 * installing. But each probe forces a layout and delivers two childList records
 * to any host observing `document.body`, so a page that constructs many editors
 * in an environment without layout should not pay it indefinitely.
 */
const MAX_UNKNOWN_PROBES = 4;

/** @type {WeakMap<object, number>} Unmeasurable probes spent per window. */
const probeCounts = new WeakMap();

/** Selector for the shell-owned wrapper around a mounted runtime. */
const RUNTIME_ROOT_SELECTOR = `[${RUNTIME_ROOT_ATTRIBUTE}]`;

/**
 * Windows already measured and found correct, so repeated editor construction
 * on Chromium does not re-probe — each probe costs a forced layout and delivers
 * mutation records to any host observing `document.body`. A window that could
 * not be measured at all is deliberately NOT cached: it may simply have had no
 * layout yet, and re-probing costs less than never installing.
 *
 * @type {WeakSet<object>}
 */
const measuredCleanWindows = new WeakSet();

/**
 * First rect with height, read by index so a long list is never copied — this
 * runs on every `getClientRects()` call in the page once installed.
 *
 * A zero-*width* rect is legitimate here: a caret rect has no width.
 *
 * @param {DOMRectList | DOMRect[] | null | undefined} rects
 * @returns {DOMRect | null}
 */
const firstRectWithHeight = (rects) => {
  const length = rects?.length ?? 0;
  for (let index = 0; index < length; index += 1) {
    const rect = rects[index];
    if (rect && rect.height > 0) return rect;
  }
  return null;
};

/**
 * First rect that can be a *glyph*, which additionally requires width.
 *
 * A one-character range whose glyph opens a new line or a new bidi run returns
 * two rects in WebKit: a zero-width sentinel parked at the end of the previous
 * line, then the glyph itself. Accepting the sentinel would take its edges and
 * its `top`, painting the caret on the wrong line.
 *
 * @param {DOMRectList | DOMRect[] | null | undefined} rects
 * @returns {DOMRect | null}
 */
const firstGlyphRect = (rects) => {
  const length = rects?.length ?? 0;
  for (let index = 0; index < length; index += 1) {
    const rect = rects[index];
    if (rect && rect.height > 0 && rect.width > 0) return rect;
  }
  return null;
};

/**
 * Character sets for the Unicode Bidirectional Algorithm classes this module
 * has to tell apart. Each is mechanically derived from `DerivedBidiClass.txt`
 * (Unicode 17.0.0) rather than approximated by a general category, because the
 * two disagree in exactly the places that matter here: Arabic-Indic digits are
 * numbers inside a right-to-left block, NKo and Adlam digits are right-to-left
 * despite being digits, and `½` is a number that is not ordered as one.
 *
 * `֐-ࣿ` and the other block ranges are a superset of Bidi_Class R and AL,
 * narrowed by RTL_BLOCK_NEUTRAL below. Every character they cover that is not
 * R or AL is either resolved before the block is consulted (marks, numbers,
 * terminators) or listed there; that has been checked against the whole of
 * Unicode, so the pair is exact.
 */
const RTL_SCRIPT_BLOCK = /[\u0590-\u08FF\u200F\uFB1D-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;

/**
 * The 46 assigned code points inside those blocks that are NOT Bidi_Class R or
 * AL: the Arabic comma, the ornate parentheses, the Arabic ligature symbols,
 * the NKo punctuation, and a handful of others. They are neutral, so they take
 * the paragraph's direction like any other neutral.
 */
const RTL_BLOCK_NEUTRAL =
  /[\u0606-\u0607\u060C\u060E-\u060F\u06DE\u06E9\u07F6-\u07F9\uFB29\uFD3E-\uFD4F\uFDCF\uFDFD-\uFDFF\uFEFF\u{1091F}\u{10B39}-\u{10B3F}\u{10D6E}\u{1EEF0}-\u{1EEF1}]/u;

/** Bidi_Class EN — European numbers, ordered left-to-right at any embedding level. */
const EUROPEAN_NUMBER_CHAR =
  /[\u0030-\u0039\u00B2-\u00B3\u00B9\u06F0-\u06F9\u2070\u2074-\u2079\u2080-\u2089\u2488-\u249B\uFF10-\uFF19\u{102E1}-\u{102FB}\u{1CCF0}-\u{1CCF9}\u{1D7CE}-\u{1D7FF}\u{1F100}-\u{1F10A}\u{1FBF0}-\u{1FBF9}]/u;

/** Bidi_Class AN — Arabic numbers, also ordered left-to-right (rules I1/I2). */
const ARABIC_NUMBER_CHAR =
  /[\u0600-\u0605\u0660-\u0669\u066B-\u066C\u06DD\u0890-\u0891\u08E2\u{10D30}-\u{10D39}\u{10D40}-\u{10D49}\u{10E60}-\u{10E7E}]/u;

/** Bidi_Class ET — terminators that a neighbouring European number absorbs (rule W5). */
const NUMBER_TERMINATOR_CHAR =
  /[\u0023-\u0025\u00A2-\u00A5\u00B0-\u00B1\u058F\u0609-\u060A\u066A\u09F2-\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u2030-\u2034\u20A0-\u20C1\u212E\u2213\uA838-\uA839\uFE5F\uFE69-\uFE6A\uFF03-\uFF05\uFFE0-\uFFE1\uFFE5-\uFFE6\u{11FDD}-\u{11FE0}\u{1E2FF}]/u;

/** Bidi_Class AL — Arabic letters, which turn a following European number Arabic (rule W2). */
const ARABIC_LETTER_CHAR =
  /[\u0608-\u060B\u060D\u061B-\u06D5\u06E5-\u06E6\u06EE-\u07B1\u0860-\u08C9\uFB50-\uFD3D\uFD50-\uFDC7\uFDF0-\uFDFC\uFE70-\uFEFC\u{10D00}-\u{10D23}\u{10EC2}-\u{10EC7}\u{10F30}-\u{10F59}\u{1EC71}-\u{1EEBB}]/u;

/**
 * Bidi_Class NSM — non-spacing marks, which take the class of the character
 * before them (rule W1). The Unicode Character Database defines NSM as exactly
 * the characters of general category Mn or Me, so this needs no table.
 */
const MARK_CHAR = /[\p{Mn}\p{Me}]/u;

/**
 * Bidi_Class L, for what is left once the classes above are resolved: letters,
 * letter numbers, spacing marks, and private use.
 *
 * Private use earns its place: a .docx symbol run (Wingdings, Symbol) maps to
 * U+F0xx, the Unicode default for private use is left-to-right, and Chromium
 * lays it out that way. What remains misread as neutral is punctuation and
 * symbols belonging to left-to-right scripts — 1.3% of assigned code points,
 * and visible only inside a right-to-left paragraph.
 */
const STRONG_LTR_CHAR = /[\p{L}\p{Nl}\p{Mc}\p{Co}]/u;

const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

/**
 * Index of the first UTF-16 unit of the code point covering `index`, so an
 * offset that lands on a low surrogate refers to the whole pair.
 *
 * @param {string} text
 * @param {number} index
 * @returns {number}
 */
function codePointStart(text, index) {
  const unit = text.charCodeAt(index);
  if (!(unit >= LOW_SURROGATE_START && unit <= LOW_SURROGATE_END) || index <= 0) return index;
  const before = text.charCodeAt(index - 1);
  return before >= HIGH_SURROGATE_START && before <= HIGH_SURROGATE_END ? index - 1 : index;
}

/**
 * Index just past the code point covering `index`.
 *
 * @param {string} text
 * @param {number} index
 * @returns {number}
 */
function codePointEnd(text, index) {
  const start = codePointStart(text, index);
  const code = text.codePointAt(start);
  return start + (code !== undefined && code > 0xffff ? 2 : 1);
}

/**
 * The whole character at `index`, so a surrogate pair is classified as the
 * character it encodes rather than as half of one.
 *
 * @param {string} text
 * @param {number} index
 * @returns {string}
 */
function characterAt(text, index) {
  const code = text.codePointAt(codePointStart(text, index));
  return code === undefined ? '' : String.fromCodePoint(code);
}

const CLASS_RTL = 1;
const CLASS_LTR = 2;
const CLASS_NUMBER = 3;
const CLASS_TERMINATOR = 4;
const CLASS_NEUTRAL = 5;
const CLASS_MARK = 6;

/**
 * Coarse Bidi_Class of one character: the six groups this module has to
 * distinguish, in the order the algorithm resolves them.
 *
 * @param {string} char
 * @returns {number}
 */
function classOf(char) {
  if (MARK_CHAR.test(char)) return CLASS_MARK;
  if (EUROPEAN_NUMBER_CHAR.test(char) || ARABIC_NUMBER_CHAR.test(char)) return CLASS_NUMBER;
  if (NUMBER_TERMINATOR_CHAR.test(char)) return CLASS_TERMINATOR;
  if (RTL_SCRIPT_BLOCK.test(char)) return RTL_BLOCK_NEUTRAL.test(char) ? CLASS_NEUTRAL : CLASS_RTL;
  if (STRONG_LTR_CHAR.test(char)) return CLASS_LTR;
  return CLASS_NEUTRAL;
}

/**
 * Rule W2: a European number is re-read as an Arabic number when the nearest
 * strong character before it is an Arabic letter. Only European numbers absorb
 * a terminator, so this is what makes "%" part of the number in Hebrew
 * ("שלום 50%") but not in Arabic ("مرحبا 50%"), which both engines confirm.
 *
 * @param {string} text
 * @param {number} index Index of the European number.
 * @returns {boolean}
 */
function europeanNumberKeepsEuropeanRun(text, index) {
  for (let at = index; at > 0;) {
    at = codePointStart(text, at - 1);
    const char = characterAt(text, at);
    const charClass = classOf(char);
    if (charClass === CLASS_RTL) return !ARABIC_LETTER_CHAR.test(char);
    if (charClass === CLASS_LTR) return true;
  }
  return true;
}

/**
 * Rule W5: a run of terminators touching a European number joins that number,
 * on either side, so both "$50" and "50%" stay one left-to-right run.
 *
 * @param {string} text
 * @param {number} index Index of the terminator.
 * @returns {boolean}
 */
function terminatorTouchesEuropeanNumber(text, index) {
  for (const step of [-1, 1]) {
    for (let at = index; ;) {
      if (step < 0) {
        if (at === 0) break;
        at = codePointStart(text, at - 1);
      } else {
        at = codePointEnd(text, at);
        if (at >= text.length) break;
      }
      const char = characterAt(text, at);
      const charClass = classOf(char);
      if (charClass === CLASS_TERMINATOR || charClass === CLASS_MARK) continue;
      if (charClass !== CLASS_NUMBER || !EUROPEAN_NUMBER_CHAR.test(char)) break;
      if (europeanNumberKeepsEuropeanRun(text, at)) return true;
      break;
    }
  }
  return false;
}

/**
 * Direction of the nearest strong character on one side of a neutral, with the
 * paragraph direction standing in past either end of the text (sor / eor).
 * Rule N1 has numbers influence a neighbouring neutral as though they were
 * right-to-left, which is why CLASS_NUMBER answers `true` here even though a
 * number is itself ordered left-to-right.
 *
 * @param {string} text
 * @param {number} index
 * @param {number} step -1 to look back, 1 to look forward.
 * @param {boolean} paragraphIsRtl
 * @returns {boolean}
 */
function strongSideIsRtl(text, index, step, paragraphIsRtl) {
  for (let at = index; ;) {
    if (step < 0) {
      if (at === 0) return paragraphIsRtl;
      at = codePointStart(text, at - 1);
    } else {
      at = codePointEnd(text, at);
      if (at >= text.length) return paragraphIsRtl;
    }
    const charClass = classOf(characterAt(text, at));
    if (charClass === CLASS_RTL || charClass === CLASS_NUMBER) return true;
    if (charClass === CLASS_LTR) return false;
  }
}

/**
 * The 64 bracket pairs of `BidiBrackets.txt` (Unicode 17.0.0), index-aligned:
 * the closing bracket for `BRACKET_OPENINGS[i]` is `BRACKET_CLOSINGS[i]`.
 */
const BRACKET_OPENINGS =
  '\u0028\u005B\u007B\u0F3A\u0F3C\u169B\u2045\u207D\u208D\u2308\u230A\u2329\u2768\u276A\u276C\u276E\u2770\u2772\u2774\u27C5\u27E6\u27E8\u27EA\u27EC\u27EE\u2983\u2985\u2987\u2989\u298B\u298D\u298F\u2991\u2993\u2995\u2997\u29D8\u29DA\u29FC\u2E22\u2E24\u2E26\u2E28\u2E55\u2E57\u2E59\u2E5B\u3008\u300A\u300C\u300E\u3010\u3014\u3016\u3018\u301A\uFE59\uFE5B\uFE5D\uFF08\uFF3B\uFF5B\uFF5F\uFF62';
const BRACKET_CLOSINGS =
  '\u0029\u005D\u007D\u0F3B\u0F3D\u169C\u2046\u207E\u208E\u2309\u230B\u232A\u2769\u276B\u276D\u276F\u2771\u2773\u2775\u27C6\u27E7\u27E9\u27EB\u27ED\u27EF\u2984\u2986\u2988\u298A\u298C\u2990\u298E\u2992\u2994\u2996\u2998\u29D9\u29DB\u29FD\u2E23\u2E25\u2E27\u2E29\u2E56\u2E58\u2E5A\u2E5C\u3009\u300B\u300D\u300F\u3011\u3015\u3017\u3019\u301B\uFE5A\uFE5C\uFE5E\uFF09\uFF3D\uFF5D\uFF60\uFF63';

/** BD16 caps its stack at 63 pairs and stops looking for pairs beyond that. */
const MAX_BRACKET_PAIRS = 63;

/**
 * U+2329 and U+232A are canonically equivalent to U+3008 and U+3009, and BD16
 * matches brackets across that equivalence. They are the only two in the table.
 *
 * @param {string} char
 * @returns {string}
 */
function canonicalBracket(char) {
  if (char === '\u2329') return '\u3008';
  if (char === '\u232A') return '\u3009';
  return char;
}

/**
 * BD16: the bracket pair that `index` belongs to, or null when it is in none.
 *
 * @param {string} text
 * @param {number} index
 * @returns {{ open: number, close: number } | null}
 */
function bracketPairAt(text, index) {
  /** @type {{ closing: string, at: number }[]} */
  const stack = [];
  for (let at = 0; at < text.length; at = codePointEnd(text, at)) {
    const char = characterAt(text, at);
    // Only a bracket that is still neutral takes part; one that a preceding rule
    // already resolved is not a bracket for N0's purposes.
    if (classOf(char) !== CLASS_NEUTRAL) continue;
    const canonical = canonicalBracket(char);
    const opening = BRACKET_OPENINGS.indexOf(canonical);
    if (opening >= 0) {
      if (stack.length >= MAX_BRACKET_PAIRS) return null;
      stack.push({ closing: BRACKET_CLOSINGS[opening], at });
      continue;
    }
    if (BRACKET_CLOSINGS.indexOf(canonical) < 0) continue;
    for (let depth = stack.length - 1; depth >= 0; depth -= 1) {
      if (stack[depth].closing !== canonical) continue;
      const pair = { open: stack[depth].at, close: at };
      if (pair.open === index || pair.close === index) return pair;
      stack.length = depth;
      break;
    }
  }
  return null;
}

/**
 * N0: a bracket pair takes the direction of the strong text it encloses.
 *
 * "שלום abc(def)" is the case that matters — a Latin parenthetical inside Hebrew,
 * which Hebrew technical and legal writing is full of. The brackets enclose
 * left-to-right text and follow left-to-right text, so they join it; without this
 * they would be neutrals taking the paragraph's direction, and the caret after
 * the closing bracket would sit on its other edge.
 *
 * Returns null when the rule does not apply — an unpaired bracket, or a pair
 * enclosing nothing strong — leaving the character neutral for N1/N2.
 *
 * @param {string} text
 * @param {number} index
 * @param {boolean} paragraphIsRtl
 * @returns {boolean | null}
 */
function bracketPairIsRtl(text, index, paragraphIsRtl) {
  const pair = bracketPairAt(text, index);
  if (!pair) return null;

  let enclosesParagraphDirection = false;
  let enclosesOppositeDirection = false;
  for (let at = codePointEnd(text, pair.open); at < pair.close; at = codePointEnd(text, at)) {
    const charClass = classOf(characterAt(text, at));
    // N0 counts numbers as right-to-left, exactly as N1 does.
    const isRtl = charClass === CLASS_RTL || charClass === CLASS_NUMBER;
    if (!isRtl && charClass !== CLASS_LTR) continue;
    if (isRtl === paragraphIsRtl) enclosesParagraphDirection = true;
    else enclosesOppositeDirection = true;
  }

  if (enclosesParagraphDirection) return paragraphIsRtl;
  if (!enclosesOppositeDirection) return null;
  // The pair runs against the paragraph, so the text before it decides whether
  // the brackets join that run or fall back to the paragraph.
  const opposite = !paragraphIsRtl;
  return strongSideIsRtl(text, pair.open, -1, paragraphIsRtl) === opposite ? opposite : paragraphIsRtl;
}

/**
 * Whether the character at `index` is laid out right-to-left, following the
 * Unicode Bidirectional Algorithm.
 *
 * Direction has to come from the character because neighbouring rects cannot
 * distinguish a one-character run from a continuing run of the opposite
 * direction — they are geometrically identical — and it cannot come from the
 * paragraph alone, because a right-to-left paragraph ending in a Latin word or
 * a number has its last characters laid out left-to-right. Reading the
 * character keeps the answer independent of zoom, of sub-pixel rounding, and of
 * how the browser rounds adjacent glyph rects.
 *
 * The rules applied, in order: W1 (a mark inherits from the character before
 * it), I1/I2 (numbers are raised to an even, left-to-right level at both
 * paragraph directions), W2 and W5 (a terminator joins an adjacent European
 * number), N0 for a paired bracket, then N1/N2 and L1 for anything neutral,
 * which at the end of the text is always the paragraph's own direction.
 *
 * @param {string} text
 * @param {number} index
 * @param {() => boolean} resolveParagraphIsRtl Paragraph direction, read only when needed since it forces a style recalc.
 * @returns {boolean}
 */
function characterIsRtl(text, index, resolveParagraphIsRtl) {
  let at = codePointStart(text, index);
  let char = characterAt(text, at);

  // W1: a non-spacing mark takes the class of the character before it, and the
  // paragraph direction when there is none.
  while (classOf(char) === CLASS_MARK) {
    if (at === 0) return resolveParagraphIsRtl();
    at = codePointStart(text, at - 1);
    char = characterAt(text, at);
  }

  const charClass = classOf(char);
  if (charClass === CLASS_RTL) return true;
  if (charClass === CLASS_LTR) return false;
  if (charClass === CLASS_NUMBER) return false;
  if (charClass === CLASS_TERMINATOR && terminatorTouchesEuropeanNumber(text, at)) return false;

  const paragraphIsRtl = resolveParagraphIsRtl();

  // N0: a paired bracket resolves from what its pair encloses, before the
  // general neutral rules see it.
  const canonical = canonicalBracket(char);
  if (BRACKET_OPENINGS.indexOf(canonical) >= 0 || BRACKET_CLOSINGS.indexOf(canonical) >= 0) {
    const paired = bracketPairIsRtl(text, at, paragraphIsRtl);
    if (paired !== null) return paired;
  }

  const before = strongSideIsRtl(text, at, -1, paragraphIsRtl);
  const after = strongSideIsRtl(text, at, 1, paragraphIsRtl);
  return before === after ? before : paragraphIsRtl;
}

/**
 * How far to look past characters that have no glyph box — a zero-width space, a
 * bidi mark, a joiner, a soft hyphen — for the neighbour whose edge the caret
 * sits on.
 *
 * WebKit refuses the caret after "שלום " followed by any of those, and the
 * character immediately before it then has nothing to measure, so without this
 * the repair would decline and leave the caret where the bug put it. Chromium
 * places it at the logical end of the space, which is the first neighbour that
 * does have a box.
 *
 * Bounded because every step is a forced layout, and a text node made only of
 * format controls would otherwise turn one caret into thousands of them. Past
 * the bound the workaround declines, which is the behaviour it has for every
 * boundary it cannot measure.
 */
const MAX_INVISIBLE_NEIGHBOURS = 16;

/**
 * The nearest character on one side of `offset` that has a glyph box, together
 * with the index it was found at.
 *
 * Both neighbours are addressed by the first UTF-16 unit of their code point, so
 * a caller measuring the character never receives half a surrogate pair.
 *
 * @param {number} offset Caret offset within the text node.
 * @param {string} text The text node's data.
 * @param {(index: number) => DOMRect | null} measureCharRect
 * @param {number} step -1 to look back from the caret, 1 to look forward.
 * @returns {{ index: number, rect: DOMRect } | null}
 */
function nearestMeasuredCharacter(offset, text, measureCharRect, step) {
  let index = step < 0 ? (offset > 0 ? codePointStart(text, offset - 1) : -1) : codePointStart(text, offset);
  for (let steps = 0; steps < MAX_INVISIBLE_NEIGHBOURS; steps += 1) {
    if (index < 0 || index >= text.length) return null;
    const rect = measureCharRect(index);
    if (rect) return { index, rect };
    index = step < 0 ? (index > 0 ? codePointStart(text, index - 1) : -1) : codePointEnd(text, index);
  }
  return null;
}

/**
 * Resolve the caret x for a boundary the browser would not measure, from the
 * rect of the character next to it and that character's direction.
 *
 * A caret sits at the *logical end* of the character before it — the right edge
 * of a left-to-right character, the left edge of a right-to-left one — or, at
 * the very start of the text, at the logical start of the character after it.
 *
 * The direction comes from the character rather than from the rects because
 * neighbouring rects cannot distinguish a one-character run from a continuing
 * run of the opposite direction: they are geometrically identical. It also
 * cannot come from the paragraph alone, because an RTL paragraph ending in a
 * Latin word or a digit has its last characters laid out left-to-right. Reading
 * the character keeps the answer independent of zoom, of sub-pixel rounding, and
 * of how the browser rounds adjacent glyph rects.
 *
 * @param {number} offset Caret offset within the text node.
 * @param {string} text The text node's data.
 * @param {(index: number) => DOMRect | null} measureCharRect Rect of the whole code point starting at `index`.
 * @param {() => boolean} resolveParagraphIsRtl Direction of the containing paragraph, for neutral characters.
 * @returns {{ x: number, top: number, height: number } | null}
 */
export function resolveCollapsedCaretGeometry(offset, text, measureCharRect, resolveParagraphIsRtl) {
  const textLength = text?.length ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > textLength) return null;

  const previous = nearestMeasuredCharacter(offset, text, measureCharRect, -1);
  if (previous) {
    const runIsRtl = characterIsRtl(text, previous.index, resolveParagraphIsRtl);
    const rect = previous.rect;
    return { x: runIsRtl ? rect.left : rect.right, top: rect.top, height: rect.height };
  }

  const next = nearestMeasuredCharacter(offset, text, measureCharRect, 1);
  if (next) {
    const runIsRtl = characterIsRtl(text, next.index, resolveParagraphIsRtl);
    const rect = next.rect;
    return { x: runIsRtl ? rect.right : rect.left, top: rect.top, height: rect.height };
  }

  return null;
}

/**
 * Whether a range is a collapsed caret inside a text node that a mounted
 * SuperDoc runtime owns — the only shape this workaround ever answers for.
 *
 * Everything else in the host page, including SuperDoc's own chrome outside a
 * runtime root, keeps the browser's native answer.
 *
 * @param {Range} range
 * @returns {boolean}
 */
const isOwnedCollapsedTextRange = (range) => {
  if (!range?.collapsed) return false;
  const node = range.startContainer;
  if (node?.nodeType !== 3 /* Node.TEXT_NODE */) return false;

  // `closest()` stops at a shadow boundary, and SuperDoc mounts painter content
  // inside one in at least one supported embedding — which is why the shell
  // reads pointer targets through `composedPath()`. Climb out through each
  // shadow host so text in that tree is recognised as the runtime's own; without
  // this the workaround would quietly decline exactly there.
  for (let element = node.parentElement; element;) {
    if (typeof element.closest !== 'function') return false;
    if (element.closest(RUNTIME_ROOT_SELECTOR)) return true;
    const root = typeof element.getRootNode === 'function' ? element.getRootNode() : null;
    const host = root && root !== element.ownerDocument ? root.host : null;
    element = host?.nodeType === 1 /* Node.ELEMENT_NODE */ ? host : null;
  }
  return false;
};

/**
 * Build the caret rect for a collapsed text range using only native measurement.
 *
 * @param {Range} range
 * @param {(this: Range) => DOMRectList} nativeGetClientRects Unpatched accessor, so measurement cannot recurse.
 * @returns {DOMRect | null}
 */
function synthesizeCollapsedCaretRect(range, nativeGetClientRects) {
  const node = /** @type {Text} */ (range.startContainer);
  const doc = node.ownerDocument;
  const view = doc?.defaultView;
  if (!doc || typeof doc.createRange !== 'function' || typeof view?.DOMRect !== 'function') return null;

  const text = node.data ?? '';
  if (text.length === 0) return null;

  const probe = doc.createRange();
  /** @type {Map<number, DOMRect | null>} */
  const measured = new Map();
  const measureCharRect = (index) => {
    // Measure the whole code point. Both engines widen a range that splits a
    // surrogate pair, but the DOM counts range offsets in UTF-16 units and is
    // not obliged to, so the pair is spanned explicitly.
    const start = codePointStart(text, index);
    if (measured.has(start)) return measured.get(start) ?? null;
    let rect = null;
    try {
      probe.setStart(node, start);
      probe.setEnd(node, codePointEnd(text, start));
      rect = firstGlyphRect(nativeGetClientRects.call(probe));
    } catch {
      rect = null;
    }
    measured.set(start, rect);
    return rect;
  };

  /** @type {boolean | undefined} */
  let paragraphIsRtl;
  const resolveParagraphIsRtl = () => {
    if (paragraphIsRtl === undefined) {
      // Climb past inline wrappers. The painter puts `dir` on individual run
      // spans, but a neutral at the end of a line takes the direction of the
      // block that contains it, not of the span it happens to sit in.
      let element = node.parentElement;
      let style = element ? view.getComputedStyle(element) : null;
      while (element && (style?.display === 'inline' || style?.display === 'contents')) {
        element = element.parentElement;
        style = element ? view.getComputedStyle(element) : null;
      }
      paragraphIsRtl = style ? style.direction === 'rtl' : false;
    }
    return paragraphIsRtl;
  };

  const geometry = resolveCollapsedCaretGeometry(range.startOffset, text, measureCharRect, resolveParagraphIsRtl);
  if (!geometry) return null;
  return new view.DOMRect(geometry.x, geometry.top, 0, geometry.height);
}

/**
 * Present a single rect the way callers read a `DOMRectList`: by `length`, by
 * index, through `item()`, and by iteration.
 *
 * Deliberately not an `Array`. The patch is global, so host code that branches
 * on the shape of the result should not suddenly see `Array.isArray` pass.
 *
 * @param {DOMRect} rect
 * @returns {DOMRectList}
 */
function toRectList(rect) {
  const list = {
    0: rect,
    [Symbol.iterator]: function* iterate() {
      yield rect;
    },
  };
  // On a real DOMRectList `length` is a non-enumerable accessor and `item` lives
  // on the prototype, so neither shows up in `Object.keys` or `JSON.stringify`.
  // Defining them the same way keeps host logging and deep-equality assertions
  // seeing the shape this API has everywhere else.
  Object.defineProperty(list, 'length', { value: 1 });
  Object.defineProperty(list, 'item', { value: (index) => (index === 0 ? rect : null) });
  return /** @type {unknown} */ (list);
}

/**
 * Detect the quirk by measuring it, never by sniffing the user agent.
 *
 * Each probed boundary is paired with a *control* one character earlier, which
 * no engine gets wrong. Environments with no layout — jsdom, SSR, a detached
 * document — fail every control and are reported as `'unknown'` rather than as
 * a quirk.
 *
 * @param {Document | null | undefined} doc
 * @returns {'quirk' | 'clean' | 'unknown'}
 */
export function detectCollapsedCaretRectQuirk(doc) {
  let container = null;
  try {
    const host = doc?.body ?? doc?.documentElement;
    if (!doc || !host || typeof doc.createRange !== 'function') return 'unknown';

    container = doc.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;font:16px sans-serif;';

    const probes = PROBE_CASES.map(([direction, whiteSpace, text]) => {
      const probe = doc.createElement('div');
      probe.style.cssText = `direction:${direction};white-space:${whiteSpace};`;
      probe.textContent = text;
      container.appendChild(probe);
      return { probe, length: text.length };
    });
    host.appendChild(container);

    const range = doc.createRange();
    const boundaryIsMeasurable = (node, offset) => {
      range.setStart(node, offset);
      range.collapse(true);
      return firstRectWithHeight(range.getClientRects()) != null;
    };

    let sawLayout = false;
    for (const { probe, length } of probes) {
      const node = probe.firstChild;
      if (!node || !boundaryIsMeasurable(node, length - 1)) continue; // No layout: cannot tell.
      sawLayout = true;
      if (!boundaryIsMeasurable(node, length)) return 'quirk';
    }
    return sawLayout ? 'clean' : 'unknown';
  } catch {
    return 'unknown';
  } finally {
    try {
      container?.remove();
    } catch {
      /* A host that broke `remove()` must not break editor startup. */
    }
  }
}

/**
 * Install the workaround on a window, if that window needs it.
 *
 * Never throws: a frozen `Range.prototype` (SES/Lockdown), an instrumented
 * `createElement`/`appendChild`, or a non-HTML document all resolve to "not
 * installed" rather than to a rejected engine load.
 *
 * Safe to call repeatedly: an already-patched realm returns the no-op uninstall,
 * and a realm already measured as correct is not probed again. Takes the window
 * explicitly so a future iframe-hosted surface can install into its own realm.
 *
 * @param {(Window & typeof globalThis) | null | undefined} win
 * @returns {(() => void) | null} Uninstall function, or `null` when not installed.
 */
export function installWebKitCollapsedCaretRectFix(win) {
  try {
    const rangePrototype = win?.Range?.prototype;
    if (!rangePrototype || typeof rangePrototype.getClientRects !== 'function') return null;
    // The mark goes on the function rather than on the prototype, so that a
    // host which replaces `getClientRects` outright — rather than wrapping it —
    // is noticed and the workaround reinstates itself. Reinstating over a host's
    // own wrapper is harmless: the inner patch has already answered, so the
    // outer one sees rects and passes them through.
    if (rangePrototype.getClientRects[INSTALLED_FLAG]) return () => {};
    if (measuredCleanWindows.has(win)) return null;
    const probesSoFar = probeCounts.get(win) ?? 0;
    if (probesSoFar >= MAX_UNKNOWN_PROBES) return null;

    const status = detectCollapsedCaretRectQuirk(win.document);
    if (status === 'clean') measuredCleanWindows.add(win);
    if (status === 'unknown') probeCounts.set(win, probesSoFar + 1);
    if (status !== 'quirk') return null;

    const nativeGetClientRects = rangePrototype.getClientRects;
    const nativeGetBoundingClientRect = rangePrototype.getBoundingClientRect;

    // The native call stays outside the guard so that a range the browser
    // itself rejects fails exactly as it does unpatched. Everything after it is
    // guarded: `getClientRects` is specified never to throw for a valid range,
    // and a host that has instrumented `closest` or `getComputedStyle` — an
    // extension, a hardened realm, a test stub — must not be able to turn every
    // Range on the page into a throwing API. Failure falls back to the
    // browser's own answer, which is the unpatched behaviour.

    /** @this {Range} */
    function patchedGetClientRects() {
      const native = nativeGetClientRects.call(this);
      try {
        if (firstRectWithHeight(native)) return native;
        if (!isOwnedCollapsedTextRange(this)) return native;
        const rect = synthesizeCollapsedCaretRect(this, nativeGetClientRects);
        return rect ? toRectList(rect) : native;
      } catch {
        return native;
      }
    }

    /** @this {Range} */
    function patchedGetBoundingClientRect() {
      const native = nativeGetBoundingClientRect.call(this);
      try {
        if (native && native.height > 0) return native;
        if (!isOwnedCollapsedTextRange(this)) return native;
        return synthesizeCollapsedCaretRect(this, nativeGetClientRects) ?? native;
      } catch {
        return native;
      }
    }

    const restore = () => {
      try {
        rangePrototype.getClientRects = nativeGetClientRects;
        rangePrototype.getBoundingClientRect = nativeGetBoundingClientRect;
      } catch {
        /* Nothing left to do: the realm refuses writes. */
      }
    };

    try {
      Object.defineProperty(patchedGetClientRects, INSTALLED_FLAG, { value: true });
      Object.defineProperty(patchedGetBoundingClientRect, INSTALLED_FLAG, { value: true });
      rangePrototype.getClientRects = patchedGetClientRects;
      rangePrototype.getBoundingClientRect = patchedGetBoundingClientRect;
    } catch {
      restore();
      return null;
    }

    return restore;
  } catch {
    return null;
  }
}
