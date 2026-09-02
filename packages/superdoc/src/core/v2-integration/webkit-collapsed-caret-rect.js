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

/** Marks a patched `Range.prototype` so a second install is a no-op. */
const INSTALLED_FLAG = '__superdocWebkitCollapsedCaretRectFix';

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
 * Blocks whose *letters* are written right-to-left: Hebrew, Arabic and their
 * neighbours, the Arabic/Hebrew presentation forms, and the two supplementary
 * planes holding the remaining RTL scripts (Phoenician, Kharoshthi, Old
 * Hungarian, Adlam, Hanifi Rohingya, Arabic mathematical letters).
 *
 * Consulted only for letters and marks. These blocks also contain digits and
 * punctuation that are NOT laid out right-to-left, so membership on its own
 * would misplace the caret after an Arabic-Indic digit.
 */
const RTL_LETTER_BLOCK = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;

/** Letters and combining marks — the characters that carry a script direction. */
const LETTER_OR_MARK_CHAR = /[\p{L}\p{M}]/u;

/**
 * Characters laid out as part of a number, and so left-to-right whichever
 * direction surrounds them: the Unicode Bidirectional Algorithm raises both
 * European and Arabic numbers to an even embedding level (rules I1/I2). Arabic-
 * Indic digits are numbers exactly like Latin ones, plus the two Arabic
 * separators that sit inside a number without being `\p{N}`.
 */
const NUMBER_ORDERED_CHAR = /[\p{N}\u066B\u066C]/u;

/**
 * Arabic-Indic digits and the separators that belong with them. They are
 * numbers, but a terminator next to one does NOT join it: UBA rule W5 attaches
 * terminators to *European* numbers only, and W6 then leaves the terminator
 * neutral. Extended Arabic-Indic digits are deliberately absent — those are
 * European numbers and a terminator does join them.
 */
const ARABIC_NUMBER_CHAR = /[\u0660-\u0669\u066B\u066C\u{10E60}-\u{10E7E}]/u;

/**
 * Terminators that join an adjacent European number's run (UBA rule W5), so
 * "50%" and "100" with a currency sign stay one left-to-right run inside an RTL
 * paragraph. Separators such as `,` and `.` are deliberately absent: a trailing
 * one is not part of the number and takes the paragraph direction.
 */
const NUMBER_TERMINATOR_CHAR = /[\p{Sc}%#\u2030\u2031\u00B0\u2032\u2033\u060A\u066A]/u;

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
 * The whole character at `index`, so a surrogate pair is classified as the
 * character it encodes rather than as half of one.
 *
 * @param {string} text
 * @param {number} index
 * @returns {string}
 */
function characterAt(text, index) {
  const code = text.codePointAt(index);
  if (code === undefined) return '';
  const landedInsidePair = code >= 0xdc00 && code <= 0xdfff && index > 0;
  return String.fromCodePoint(landedInsidePair ? (text.codePointAt(index - 1) ?? code) : code);
}

/**
 * Whether the character at `index` is laid out right-to-left.
 *
 * A letter or mark carries its script's direction wherever it sits, which is
 * the case geometry alone cannot recover: a lone Latin letter at the end of an
 * RTL paragraph is a one-character left-to-right run whose rect sits exactly
 * where a continuing right-to-left run's rect would sit.
 *
 * Numbers are the reason this cannot be a plain block test. Arabic-Indic digits
 * live inside the Arabic block but are laid out left-to-right like any other
 * number, so an Arabic page number ("صفحة ٥") ends in a left-to-right run.
 *
 * Everything left is neutral, and a neutral at the end of a line takes the
 * paragraph's direction (UBA rule L1) — except a terminator glued to a European
 * number, which joins that number's run.
 *
 * @param {string} text
 * @param {number} index
 * @param {() => boolean} resolveParagraphIsRtl Paragraph direction, read only for neutrals since it forces a style recalc.
 * @returns {boolean}
 */
function characterIsRtl(text, index, resolveParagraphIsRtl) {
  const char = characterAt(text, index);
  if (NUMBER_ORDERED_CHAR.test(char)) return false;
  if (NUMBER_TERMINATOR_CHAR.test(char) && index > 0) {
    const before = characterAt(text, index - 1);
    if (NUMBER_ORDERED_CHAR.test(before) && !ARABIC_NUMBER_CHAR.test(before)) return false;
  }
  if (LETTER_OR_MARK_CHAR.test(char)) return RTL_LETTER_BLOCK.test(char);
  return resolveParagraphIsRtl();
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
 * @param {(index: number) => DOMRect | null} measureCharRect Rect of the single character at `index`.
 * @param {() => boolean} resolveParagraphIsRtl Direction of the containing paragraph, for neutral characters.
 * @returns {{ x: number, top: number, height: number } | null}
 */
export function resolveCollapsedCaretGeometry(offset, text, measureCharRect, resolveParagraphIsRtl) {
  const textLength = text?.length ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > textLength) return null;

  const previous = offset > 0 ? measureCharRect(offset - 1) : null;
  if (previous) {
    const runIsRtl = characterIsRtl(text, offset - 1, resolveParagraphIsRtl);
    return { x: runIsRtl ? previous.left : previous.right, top: previous.top, height: previous.height };
  }

  const next = offset < textLength ? measureCharRect(offset) : null;
  if (next) {
    const runIsRtl = characterIsRtl(text, offset, resolveParagraphIsRtl);
    return { x: runIsRtl ? next.right : next.left, top: next.top, height: next.height };
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
  const parent = node.parentElement;
  return typeof parent?.closest === 'function' && parent.closest(RUNTIME_ROOT_SELECTOR) != null;
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
    if (measured.has(index)) return measured.get(index) ?? null;
    let rect = null;
    try {
      probe.setStart(node, index);
      probe.setEnd(node, index + 1);
      rect = firstGlyphRect(nativeGetClientRects.call(probe));
    } catch {
      rect = null;
    }
    measured.set(index, rect);
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
    length: 1,
    0: rect,
    item: (index) => (index === 0 ? rect : null),
    [Symbol.iterator]: function* iterate() {
      yield rect;
    },
  };
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
    if (rangePrototype[INSTALLED_FLAG]) return () => {};
    if (measuredCleanWindows.has(win)) return null;

    const status = detectCollapsedCaretRectQuirk(win.document);
    if (status === 'clean') measuredCleanWindows.add(win);
    if (status !== 'quirk') return null;

    const nativeGetClientRects = rangePrototype.getClientRects;
    const nativeGetBoundingClientRect = rangePrototype.getBoundingClientRect;

    /** @this {Range} */
    function patchedGetClientRects() {
      const native = nativeGetClientRects.call(this);
      if (firstRectWithHeight(native)) return native;
      if (!isOwnedCollapsedTextRange(this)) return native;
      const rect = synthesizeCollapsedCaretRect(this, nativeGetClientRects);
      return rect ? toRectList(rect) : native;
    }

    /** @this {Range} */
    function patchedGetBoundingClientRect() {
      const native = nativeGetBoundingClientRect.call(this);
      if (native && native.height > 0) return native;
      if (!isOwnedCollapsedTextRange(this)) return native;
      return synthesizeCollapsedCaretRect(this, nativeGetClientRects) ?? native;
    }

    const restore = () => {
      try {
        rangePrototype.getClientRects = nativeGetClientRects;
        rangePrototype.getBoundingClientRect = nativeGetBoundingClientRect;
        delete rangePrototype[INSTALLED_FLAG];
      } catch {
        /* Nothing left to do: the realm refuses writes. */
      }
    };

    try {
      rangePrototype.getClientRects = patchedGetClientRects;
      rangePrototype.getBoundingClientRect = patchedGetBoundingClientRect;
      Object.defineProperty(rangePrototype, INSTALLED_FLAG, { value: true, configurable: true });
    } catch {
      restore();
      return null;
    }

    return restore;
  } catch {
    return null;
  }
}
