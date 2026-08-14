export type HeaderFooterKind = 'header' | 'footer';
export type HeaderFooterVariant = 'default' | 'first' | 'even' | 'odd';

export type HeaderFooterSectionRefs = Partial<Record<HeaderFooterVariant, string | null>>;

export type HeaderFooterResolutionSection = {
  sectionIndex: number;
  titlePg?: boolean;
  headerRefs?: HeaderFooterSectionRefs | null;
  footerRefs?: HeaderFooterSectionRefs | null;
};

export type HeaderFooterVariantSelectionInput = {
  documentPageNumber: number;
  sectionPageNumber: number;
  titlePg?: boolean;
  alternateHeaders?: boolean;
};

export type HeaderFooterEffectiveRefInput = {
  sections: readonly HeaderFooterResolutionSection[];
  sectionIndex: number;
  kind: HeaderFooterKind;
  variant: HeaderFooterVariant;
};

export type HeaderFooterEffectiveRefResult = {
  refId: string;
  matchedSectionIndex: number;
  matchedVariant: HeaderFooterVariant;
};

const HEADER_FOOTER_VARIANTS: readonly HeaderFooterVariant[] = ['default', 'first', 'even', 'odd'];

type VariantResolutionCache = {
  values: Map<number, HeaderFooterEffectiveRefResult | null>;
  sectionIndices: number[];
};

type ResolutionCache = Record<HeaderFooterKind, Record<HeaderFooterVariant, VariantResolutionCache>>;

function createResolutionCache(): ResolutionCache {
  const createVariantCache = (): VariantResolutionCache => ({ values: new Map(), sectionIndices: [] });
  const createKindCache = (): Record<HeaderFooterVariant, VariantResolutionCache> => ({
    default: createVariantCache(),
    first: createVariantCache(),
    even: createVariantCache(),
    odd: createVariantCache(),
  });

  return {
    header: createKindCache(),
    footer: createKindCache(),
  };
}

function normalizeRefs(refs: HeaderFooterSectionRefs | null | undefined): HeaderFooterSectionRefs | undefined {
  if (!refs) return undefined;

  const normalized: HeaderFooterSectionRefs = {};
  for (const variant of HEADER_FOOTER_VARIANTS) {
    const refId = refs[variant];
    if (refId) normalized[variant] = refId;
  }
  return Object.keys(normalized).length > 0 ? Object.freeze(normalized) : undefined;
}

function refsEqual(left: HeaderFooterSectionRefs | undefined, right: HeaderFooterSectionRefs | undefined): boolean {
  return HEADER_FOOTER_VARIANTS.every((variant) => left?.[variant] === right?.[variant]);
}

function hasRefs(refs: HeaderFooterSectionRefs | undefined): boolean {
  return refs != null && HEADER_FOOTER_VARIANTS.some((variant) => Boolean(refs[variant]));
}

function snapshotSection(section: HeaderFooterResolutionSection): HeaderFooterResolutionSection {
  return Object.freeze({
    sectionIndex: section.sectionIndex,
    titlePg: section.titlePg === true,
    headerRefs: normalizeRefs(section.headerRefs),
    footerRefs: normalizeRefs(section.footerRefs),
  });
}

function findSectionPositionAtOrBefore(sectionIndices: readonly number[], sectionIndex: number): number {
  let low = 0;
  let high = sectionIndices.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (sectionIndices[middle]! <= sectionIndex) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function findSectionPositionAtOrAfter(sectionIndices: readonly number[], sectionIndex: number): number {
  let low = 0;
  let high = sectionIndices.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (sectionIndices[middle]! < sectionIndex) low = middle + 1;
    else high = middle;
  }
  return low;
}

function cacheResolution(
  cache: VariantResolutionCache,
  sectionIndex: number,
  result: HeaderFooterEffectiveRefResult | null,
): void {
  if (!cache.values.has(sectionIndex)) {
    const insertionIndex = findSectionPositionAtOrAfter(cache.sectionIndices, sectionIndex);
    cache.sectionIndices.splice(insertionIndex, 0, sectionIndex);
  }
  cache.values.set(sectionIndex, result);
}

/**
 * Ordered, snapshot-backed resolver for repeated header/footer lookups.
 * Runtime section updates must go through `updateSection` so cached inherited
 * results cannot outlive a reference change.
 */
export class HeaderFooterResolutionIndex {
  readonly #sectionsByIndex = new Map<number, HeaderFooterResolutionSection>();
  readonly #cache = createResolutionCache();
  #sectionIndices: number[] = [];
  #headerSectionsWithRefs = 0;
  #footerSectionsWithRefs = 0;
  #revision = 0;

  constructor(sections: readonly HeaderFooterResolutionSection[]) {
    for (const section of sections) {
      if (!Number.isInteger(section.sectionIndex) || section.sectionIndex < 0) continue;
      this.#sectionsByIndex.set(section.sectionIndex, snapshotSection(section));
    }

    this.#sectionIndices = Array.from(this.#sectionsByIndex.keys()).sort((left, right) => left - right);
    for (const section of this.#sectionsByIndex.values()) {
      if (hasRefs(section.headerRefs ?? undefined)) this.#headerSectionsWithRefs += 1;
      if (hasRefs(section.footerRefs ?? undefined)) this.#footerSectionsWithRefs += 1;
    }
  }

  get revision(): number {
    return this.#revision;
  }

  hasAny(kind: HeaderFooterKind): boolean {
    return kind === 'header' ? this.#headerSectionsWithRefs > 0 : this.#footerSectionsWithRefs > 0;
  }

  resolve(
    sectionIndex: number,
    kind: HeaderFooterKind,
    variant: HeaderFooterVariant,
  ): HeaderFooterEffectiveRefResult | null {
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0) return null;

    const cache = this.#cache[kind][variant];
    const cached = cache.values.get(sectionIndex);
    if (cached !== undefined || cache.values.has(sectionIndex)) return cached ?? null;

    const candidates = candidateVariantsFor(variant);
    for (
      let position = findSectionPositionAtOrBefore(this.#sectionIndices, sectionIndex);
      position >= 0;
      position -= 1
    ) {
      const matchedSectionIndex = this.#sectionIndices[position]!;
      const refs = sectionRefsFor(this.#sectionsByIndex.get(matchedSectionIndex), kind);
      if (!refs) continue;

      for (const matchedVariant of candidates) {
        const refId = refs[matchedVariant];
        if (!refId) continue;

        const result = Object.freeze({ refId, matchedSectionIndex, matchedVariant });
        cacheResolution(cache, sectionIndex, result);
        return result;
      }
    }

    cacheResolution(cache, sectionIndex, null);
    return null;
  }

  updateSection(section: HeaderFooterResolutionSection): boolean {
    const sectionIndex = section.sectionIndex;
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0) return false;

    const previous = this.#sectionsByIndex.get(sectionIndex);
    const next = snapshotSection(section);
    const headerChanged = !refsEqual(previous?.headerRefs ?? undefined, next.headerRefs ?? undefined);
    const footerChanged = !refsEqual(previous?.footerRefs ?? undefined, next.footerRefs ?? undefined);

    if (!previous) {
      const insertionIndex = findSectionPositionAtOrBefore(this.#sectionIndices, sectionIndex) + 1;
      this.#sectionIndices.splice(insertionIndex, 0, sectionIndex);
    }
    this.#sectionsByIndex.set(sectionIndex, next);

    if (!headerChanged && !footerChanged) return false;

    if (headerChanged) {
      this.#headerSectionsWithRefs +=
        Number(hasRefs(next.headerRefs ?? undefined)) - Number(hasRefs(previous?.headerRefs ?? undefined));
      this.#invalidateChangedVariants(sectionIndex, 'header', previous?.headerRefs, next.headerRefs);
    }
    if (footerChanged) {
      this.#footerSectionsWithRefs +=
        Number(hasRefs(next.footerRefs ?? undefined)) - Number(hasRefs(previous?.footerRefs ?? undefined));
      this.#invalidateChangedVariants(sectionIndex, 'footer', previous?.footerRefs, next.footerRefs);
    }

    this.#revision += 1;
    return true;
  }

  #invalidateChangedVariants(
    sectionIndex: number,
    kind: HeaderFooterKind,
    previous: HeaderFooterSectionRefs | null | undefined,
    next: HeaderFooterSectionRefs | null | undefined,
  ): void {
    const changedVariants = new Set<HeaderFooterVariant>();
    for (const variant of HEADER_FOOTER_VARIANTS) {
      if (previous?.[variant] === next?.[variant]) continue;
      changedVariants.add(variant);
      if (variant === 'default') changedVariants.add('odd');
    }

    for (const variant of changedVariants) {
      const cache = this.#cache[kind][variant];
      const invalidationIndex = findSectionPositionAtOrAfter(cache.sectionIndices, sectionIndex);
      for (let index = invalidationIndex; index < cache.sectionIndices.length; index += 1) {
        cache.values.delete(cache.sectionIndices[index]!);
      }
      cache.sectionIndices.splice(invalidationIndex);
    }
  }
}

export function createHeaderFooterResolutionIndex(
  sections: readonly HeaderFooterResolutionSection[],
): HeaderFooterResolutionIndex {
  return new HeaderFooterResolutionIndex(sections);
}

export function selectHeaderFooterVariantForPage({
  documentPageNumber,
  sectionPageNumber,
  titlePg,
  alternateHeaders,
}: HeaderFooterVariantSelectionInput): HeaderFooterVariant | null {
  if (!Number.isFinite(documentPageNumber) || !Number.isFinite(sectionPageNumber)) return null;
  if (sectionPageNumber < 1) return null;
  if (sectionPageNumber === 1 && titlePg === true) return 'first';
  if (alternateHeaders === true) return documentPageNumber % 2 === 0 ? 'even' : 'odd';
  return 'default';
}

function candidateVariantsFor(variant: HeaderFooterVariant): readonly HeaderFooterVariant[] {
  return variant === 'odd' ? ['odd', 'default'] : [variant];
}

function sectionRefsFor(
  section: HeaderFooterResolutionSection | undefined,
  kind: HeaderFooterKind,
): HeaderFooterSectionRefs | null | undefined {
  return kind === 'header' ? section?.headerRefs : section?.footerRefs;
}

export function resolveEffectiveHeaderFooterRef({
  sections,
  sectionIndex,
  kind,
  variant,
}: HeaderFooterEffectiveRefInput): HeaderFooterEffectiveRefResult | null {
  if (sectionIndex < 0) return null;

  const sectionsByIndex = new Map<number, HeaderFooterResolutionSection>();
  for (const section of sections) {
    sectionsByIndex.set(section.sectionIndex, section);
  }

  const candidates = candidateVariantsFor(variant);
  for (let currentIndex = sectionIndex; currentIndex >= 0; currentIndex -= 1) {
    const refs = sectionRefsFor(sectionsByIndex.get(currentIndex), kind);
    if (!refs) continue;

    for (const candidate of candidates) {
      const refId = refs[candidate];
      if (refId) {
        return {
          refId,
          matchedSectionIndex: currentIndex,
          matchedVariant: candidate,
        };
      }
    }
  }

  return null;
}
