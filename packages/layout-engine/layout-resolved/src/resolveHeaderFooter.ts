import type {
  FlowBlock,
  HeaderFooterLayout,
  Measure,
  ResolvedHeaderFooterLayout,
  ResolvedHeaderFooterPage,
  LayoutStoryLocator,
} from '@superdoc/contracts';
import { buildBlockMap, resolveFragmentItem } from './resolveLayout.js';

const V2_RENDER_DIAGNOSTIC_RESOLVE_OWNER = Symbol.for('superdoc.v2.render-diagnostic.resolve-owner');

type V2RenderDiagnosticResolveOwner = (input: {
  blockIds: readonly string[];
  debugDetail: unknown;
  sourcePageRange: { firstPage: number; lastPage: number };
}) => Error | null;

function headerFooterFragmentPageRange(
  layout: HeaderFooterLayout,
  pageIndex: number,
  blockId: string,
): { firstPage: number; lastPage: number } {
  const contains = (index: number): boolean =>
    layout.pages[index]?.fragments.some((fragment) => fragment.blockId === blockId) === true;
  let firstPage = pageIndex;
  let lastPage = pageIndex;
  while (firstPage > 0 && contains(firstPage - 1)) firstPage -= 1;
  while (lastPage + 1 < layout.pages.length && contains(lastPage + 1)) lastPage += 1;
  return { firstPage, lastPage };
}

/**
 * Resolves a header/footer layout into a `ResolvedHeaderFooterLayout`.
 *
 * Standalone helper invoked per `HeaderFooterLayoutResult` from `incrementalLayout`.
 * The caller stores results indexed by the same key (type or rId) as the originals;
 * alignment between fragments and resolved items is guaranteed by construction.
 */
export function resolveHeaderFooterLayout(
  layout: HeaderFooterLayout,
  blocks: FlowBlock[],
  measures: Measure[],
  story?: LayoutStoryLocator,
  // Folded into each header/footer block's paint-reuse version (see resolveLayout). '' for default.
  fontSignature = '',
): ResolvedHeaderFooterLayout {
  const renderDiagnosticOwner = (
    layout as HeaderFooterLayout & {
      [V2_RENDER_DIAGNOSTIC_RESOLVE_OWNER]?: V2RenderDiagnosticResolveOwner;
    }
  )[V2_RENDER_DIAGNOSTIC_RESOLVE_OWNER];
  const pages: ResolvedHeaderFooterPage[] = layout.pages.map((page, pageIndex) => {
    const pageBlocks = page.blocks ?? blocks;
    const pageMeasures = page.measures ?? measures;
    const blockMap = buildBlockMap(pageBlocks, pageMeasures);
    const blockVersionCache = new Map<string, string>();

    return {
      number: page.number,
      measurementHeight: page.measurementHeight,
      minY: page.minY,
      maxY: page.maxY,
      renderHeight: page.renderHeight,
      displayNumber: page.displayNumber,
      numberText: page.numberText,
      pageNumberFormat: page.pageNumberFormat,
      pageNumberChapterText: page.pageNumberChapterText,
      pageNumberChapterSeparator: page.pageNumberChapterSeparator,
      items: page.fragments.map((fragment, fragmentIndex) => {
        try {
          return resolveFragmentItem(
            fragment,
            fragmentIndex,
            page.number - 1,
            blockMap,
            blockVersionCache,
            story,
            fontSignature,
          );
        } catch (error) {
          const owned = renderDiagnosticOwner?.({
            blockIds: [fragment.blockId],
            debugDetail: error,
            sourcePageRange: headerFooterFragmentPageRange(layout, pageIndex, fragment.blockId),
          });
          if (owned) throw owned;
          throw error;
        }
      }),
    };
  });

  return {
    height: layout.height,
    minY: layout.minY,
    maxY: layout.maxY,
    renderHeight: layout.renderHeight,
    pages,
  };
}
