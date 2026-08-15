import {
  doesWebFlowBlockProduceDom,
  rebaseWebFlowItemNode,
  renderWebFlowItem,
  webFlowItemIdentityFingerprint,
} from './render.js';
import { ensureWebFlowStyles, WEB_FLOW_CLASS_NAMES } from './styles.js';
import type {
  WebFlowAppliedPaint,
  WebFlowDomBinding,
  WebFlowPaintCommand,
  WebFlowPaintItem,
  WebFlowPaintSnapshot,
  WebFlowPaintTransaction,
  WebFlowPainterHandle,
  WebFlowPainterOptions,
  WebFlowPaintWorkSummary,
} from './types.js';

interface Entry {
  readonly key: string;
  readonly renderFingerprint: string;
  readonly blockId: string;
  readonly node: HTMLElement | null;
  readonly item: WebFlowPaintItem;
}

type PreparedEntries =
  | {
      kind: 'localized-splice';
      start: number;
      previous: Entry[];
      inserted: Entry[];
      work: WebFlowPaintWorkSummary;
      rebases: Array<{ previous: WebFlowPaintItem; next: WebFlowPaintItem; node: HTMLElement }>;
    }
  | {
      kind: 'full';
      entries: Entry[];
      start: number;
      deleteCount: number;
      work: WebFlowPaintWorkSummary;
      rebases: Array<{ previous: WebFlowPaintItem; next: WebFlowPaintItem; node: HTMLElement }>;
    };

const fail = (message: string): never => {
  throw new Error(`WebFlowPainter: ${message}`);
};

const entryNodes = (entries: readonly Entry[]): HTMLElement[] =>
  entries.flatMap((entry) => (entry.node ? [entry.node] : []));

const entryBinding = (entry: Entry): WebFlowDomBinding | null =>
  entry.node
    ? {
        key: entry.key,
        renderFingerprint: entry.renderFingerprint,
        blockId: entry.blockId,
        node: entry.node,
      }
    : null;

const entryBindings = (entries: readonly Entry[]): WebFlowDomBinding[] =>
  entries.flatMap((entry) => {
    const binding = entryBinding(entry);
    return binding ? [binding] : [];
  });

const assertUniqueItems = (items: readonly WebFlowPaintItem[]): void => {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.stableDomKey) fail('empty stable DOM key');
    if (!item.renderFingerprint) fail(`missing render fingerprint for ${item.stableDomKey}`);
    if (keys.has(item.stableDomKey)) fail(`duplicate stable DOM key ${item.stableDomKey}`);
    keys.add(item.stableDomKey);
  }
};

class WebFlowPainter implements WebFlowPainterHandle {
  readonly #mount: HTMLElement;
  readonly #options: WebFlowPainterOptions;
  #entries: Entry[] = [];
  #entryByKey = new Map<string, Entry>();
  #indexByKey = new Map<string, number>();
  #epoch: number | null = null;
  #version = 0;
  #mountedNodeCount = 0;
  #active: symbol | null = null;
  #disposed = false;
  #unownedMutation: 'text' | 'dom' | null = null;
  readonly #textMutationObserver: MutationObserver | null;

  constructor(mount: HTMLElement, options: WebFlowPainterOptions) {
    this.#mount = mount;
    this.#options = options;
    ensureWebFlowStyles(mount.ownerDocument);
    mount.classList.add(WEB_FLOW_CLASS_NAMES.root);
    mount.dataset.webFlowOwner = 'retained-web-flow';
    const MutationObserverConstructor = mount.ownerDocument.defaultView?.MutationObserver;
    this.#textMutationObserver = MutationObserverConstructor
      ? new MutationObserverConstructor((mutations) => {
          this.#recordUnownedMutations(mutations);
        })
      : null;
    this.#observeMount();
  }

  prepare(command: WebFlowPaintCommand): WebFlowPaintTransaction {
    this.#assertLive();
    if (this.#active) fail('a paint transaction is already active');
    assertUniqueItems(command.items);
    this.#assertMountedState();
    if (command.kind === 'splice') this.#validateSplice(command);

    const token = Symbol('web-flow-paint');
    this.#active = token;
    const prepared = this.#prepareEntries(command);
    const beforeEntries = prepared.kind === 'full' ? this.#entries : null;
    const beforeEpoch = this.#epoch;
    const beforeVersion = this.#version;
    const beforeMountedNodeCount = this.#mountedNodeCount;
    const beforeNodes = beforeEntries ? entryNodes(beforeEntries) : null;
    let state: 'prepared' | 'applied' | 'finalized' | 'rolled-back' = 'prepared';
    let applied: WebFlowAppliedPaint | null = null;
    let rollbackRebases: Array<() => void> = [];

    const restoreBeforeState = (): void => {
      rollbackRebases.reverse().forEach((restore) => restore());
      rollbackRebases = [];
      if (prepared.kind === 'localized-splice') {
        prepared.previous.forEach((entry, index) => {
          this.#entries[prepared.start + index] = entry;
        });
        this.#mount.replaceChildren(...entryNodes(this.#entries));
      } else {
        this.#mount.replaceChildren(...beforeNodes!);
        this.#entries = beforeEntries!;
      }
      this.#rebuildEntryIndexes();
      this.#epoch = beforeEpoch;
      this.#version = beforeVersion;
      this.#mountedNodeCount = beforeMountedNodeCount;
    };

    const apply = (): WebFlowAppliedPaint => {
      if (state !== 'prepared') fail(`cannot apply transaction in ${state} state`);
      if (this.#active !== token) fail('paint transaction lost ownership');
      this.#assertMountedState();
      this.#textMutationObserver?.disconnect();
      try {
        if (prepared.kind === 'localized-splice') {
          this.#applyLocalizedSplice(prepared.start, prepared.previous, prepared.inserted);
        } else if (command.kind === 'splice') {
          this.#applySplice(prepared.entries, prepared.start, prepared.deleteCount);
        } else this.#mount.replaceChildren(...entryNodes(prepared.entries));
        rollbackRebases = prepared.rebases.map(({ previous, next, node }) =>
          rebaseWebFlowItemNode(node, previous, next),
        );
        const touchedEntries = prepared.kind === 'localized-splice' ? prepared.inserted : prepared.entries;
        const rebasedNodes = new Set(prepared.rebases.map((rebase) => rebase.node));
        const changedEntries =
          prepared.kind === 'localized-splice'
            ? prepared.inserted.filter(
                (entry, index) =>
                  entry.node !== prepared.previous[index]?.node || (entry.node != null && rebasedNodes.has(entry.node)),
              )
            : prepared.entries;
        if (prepared.kind === 'localized-splice') {
          prepared.inserted.forEach((entry, index) => {
            const entryIndex = prepared.start + index;
            this.#entries[entryIndex] = entry;
            this.#entryByKey.set(entry.key, entry);
            this.#indexByKey.set(entry.key, entryIndex);
          });
          this.#mountedNodeCount += entryNodes(prepared.inserted).length - entryNodes(prepared.previous).length;
        } else {
          this.#entries = prepared.entries;
          this.#rebuildEntryIndexes();
          this.#mountedNodeCount = entryNodes(prepared.entries).length;
        }
        this.#epoch = command.epoch;
        this.#version += 1;
        state = 'applied';
        applied = {
          work: prepared.work,
          touchedBindings: entryBindings(touchedEntries),
          changedBindings: entryBindings(changedEntries),
        };
        return applied;
      } catch (error) {
        restoreBeforeState();
        state = 'rolled-back';
        if (this.#active === token) this.#active = null;
        throw error;
      } finally {
        this.#observeMount();
      }
    };

    const rollback = (): void => {
      if (state === 'finalized' || state === 'rolled-back') return;
      if (state === 'applied') {
        this.#textMutationObserver?.disconnect();
        try {
          restoreBeforeState();
        } finally {
          this.#observeMount();
        }
      }
      state = 'rolled-back';
      if (this.#active === token) this.#active = null;
    };

    return {
      command,
      apply,
      finalize: (): WebFlowAppliedPaint => {
        if (state !== 'applied' || !applied) {
          throw new Error(`WebFlowPainter: cannot finalize transaction in ${state} state`);
        }
        const result = applied;
        state = 'finalized';
        if (this.#active === token) this.#active = null;
        return result;
      },
      rollback,
    };
  }

  snapshot(): WebFlowPaintSnapshot {
    return {
      epoch: this.#epoch,
      version: this.#version,
      bindings: entryBindings(this.#entries),
    };
  }

  restoreCommittedDomAfterUnownedMutation(): WebFlowPaintSnapshot {
    this.#assertLive();
    if (this.#active) fail('cannot restore committed DOM with an active paint transaction');
    this.#recordUnownedMutations(this.#textMutationObserver?.takeRecords() ?? []);
    if (!this.#unownedMutation) return this.snapshot();
    this.#textMutationObserver?.disconnect();
    try {
      const entries = this.#entries.map((entry) => {
        const node = renderWebFlowItem(entry.item, this.#mount.ownerDocument, this.#options);
        return { ...entry, node };
      });
      this.#mount.replaceChildren(...entryNodes(entries));
      this.#entries = entries;
      this.#rebuildEntryIndexes();
      this.#mountedNodeCount = entryNodes(entries).length;
      this.#unownedMutation = null;
      this.#version += 1;
      return this.snapshot();
    } finally {
      this.#observeMount();
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    if (this.#active) fail('cannot dispose with an active paint transaction');
    this.#disposed = true;
    this.#textMutationObserver?.disconnect();
    this.#entries = [];
    this.#entryByKey.clear();
    this.#indexByKey.clear();
    this.#epoch = null;
    this.#mountedNodeCount = 0;
    this.#mount.replaceChildren();
    this.#mount.classList.remove(WEB_FLOW_CLASS_NAMES.root);
    delete this.#mount.dataset.webFlowOwner;
  }

  #assertLive(): void {
    if (this.#disposed) fail('painter is disposed');
  }

  #assertMountedState(): void {
    this.#recordUnownedMutations(this.#textMutationObserver?.takeRecords() ?? []);
    if (this.#unownedMutation === 'text') fail('unowned text mutation detected');
    if (this.#unownedMutation === 'dom') fail('unowned DOM mutation detected');
    if (this.#mount.childNodes.length !== this.#mountedNodeCount) fail('unowned root mutation detected');
  }

  #observeMount(): void {
    if (this.#disposed) return;
    this.#textMutationObserver?.observe(this.#mount, {
      subtree: true,
      characterData: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-web-flow-key',
        'data-flow-block-id',
        'data-layout-block-ref',
        'data-layout-fragment-id',
        'data-layout-story',
        'data-pm-start',
        'data-pm-end',
        'data-web-flow-run-index',
      ],
    });
  }

  #recordUnownedMutations(mutations: readonly MutationRecord[]): void {
    let detected: 'text' | 'dom' | null = null;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        detected = 'text';
        break;
      }
      detected ??= 'dom';
    }
    if (!detected || this.#unownedMutation) return;
    this.#unownedMutation = detected;
    this.#options.onUnownedMutation?.(detected);
  }

  #validateSplice(command: Extract<WebFlowPaintCommand, { kind: 'splice' }>): void {
    if (this.#epoch !== command.expectedBaseEpoch) fail('splice base epoch is stale');
    if (command.epoch <= command.expectedBaseEpoch) fail('splice epoch must advance');
    const leftIndex = command.expectedLeftKey == null ? -1 : (this.#indexByKey.get(command.expectedLeftKey) ?? -1);
    if (command.expectedLeftKey != null && leftIndex < 0) fail('splice left anchor is missing');
    const start = leftIndex + 1;
    if (command.expectedRemovedKeys.some((key, index) => this.#entries[start + index]?.key !== key)) {
      fail('splice removed-key sequence does not match');
    }
    const actualRight = this.#entries[start + command.expectedRemovedKeys.length]?.key ?? null;
    if (actualRight !== command.expectedRightKey) fail('splice right anchor does not match');
    const removedEnd = start + command.expectedRemovedKeys.length;
    if (
      command.items.some((item) => {
        const index = this.#indexByKey.get(item.stableDomKey);
        return index != null && (index < start || index >= removedEnd);
      })
    ) {
      fail('splice would duplicate a retained key');
    }
    const rebaseKeys = new Set<string>();
    for (const item of command.retainedRebases ?? []) {
      const index = this.#indexByKey.get(item.stableDomKey);
      if (index == null || (index >= start && index < removedEnd)) {
        fail('splice rebase key is not retained');
      }
      if (rebaseKeys.has(item.stableDomKey)) fail('splice has duplicate rebase keys');
      rebaseKeys.add(item.stableDomKey);
    }
  }

  #prepareEntries(command: WebFlowPaintCommand): PreparedEntries {
    const oldByKey = this.#entryByKey;
    const replacementRebases: Array<{
      previous: WebFlowPaintItem;
      next: WebFlowPaintItem;
      node: HTMLElement;
    }> = [];
    const createEntry = (item: WebFlowPaintItem): Entry => {
      const existing = oldByKey.get(item.stableDomKey);
      const producesDom = doesWebFlowBlockProduceDom(item.block);
      const hasMatchingDomDisposition = existing != null && (existing.node != null) === producesDom;
      if (existing?.renderFingerprint === item.renderFingerprint && hasMatchingDomDisposition) {
        if (existing.node && webFlowItemIdentityFingerprint(existing.item) !== webFlowItemIdentityFingerprint(item)) {
          replacementRebases.push({ previous: existing.item, next: item, node: existing.node });
        }
        return {
          ...existing,
          blockId: item.block.id,
          item,
        };
      }
      return {
        key: item.stableDomKey,
        renderFingerprint: item.renderFingerprint,
        blockId: item.block.id,
        node: producesDom ? renderWebFlowItem(item, this.#mount.ownerDocument, this.#options) : null,
        item,
      };
    };

    if (command.kind === 'replace-all') {
      const entries = command.items.map(createEntry);
      const retainedNodes = entries.filter(
        (entry) => entry.node != null && oldByKey.get(entry.key)?.node === entry.node,
      ).length;
      const nextNodes = new Set(entryNodes(entries));
      return {
        kind: 'full',
        entries,
        start: 0,
        deleteCount: this.#entries.length,
        work: {
          kind: command.kind,
          retainedNodes,
          createdNodes: entryNodes(entries).length - retainedNodes,
          removedNodes: this.#entries.filter((entry) => entry.node != null && !nextNodes.has(entry.node)).length,
          rebasedNodes: replacementRebases.length,
          touchedItems: entries.length,
        },
        rebases: replacementRebases,
      };
    }

    const start = command.expectedLeftKey == null ? 0 : (this.#indexByKey.get(command.expectedLeftKey) ?? -1) + 1;
    const inserted = command.items.map(createEntry);
    const removedEntries = this.#entries.slice(start, start + command.expectedRemovedKeys.length);
    const localized =
      command.retainedRebases == null &&
      inserted.length === removedEntries.length &&
      inserted.every((entry, index) => entry.key === removedEntries[index]?.key);
    if (localized) {
      const retainedNodes = inserted.filter(
        (entry, index) => entry.node != null && entry.node === removedEntries[index]?.node,
      ).length;
      return {
        kind: 'localized-splice',
        start,
        previous: removedEntries,
        inserted,
        work: {
          kind: command.kind,
          retainedNodes,
          createdNodes: inserted.filter((entry) => entry.node != null).length - retainedNodes,
          removedNodes: removedEntries.filter(
            (entry, index) => entry.node != null && entry.node !== inserted[index]?.node,
          ).length,
          rebasedNodes: replacementRebases.length,
          touchedItems: inserted.length,
        },
        rebases: replacementRebases,
      };
    }
    let entries = [
      ...this.#entries.slice(0, start),
      ...inserted,
      ...this.#entries.slice(start + command.expectedRemovedKeys.length),
    ];
    const rebaseByKey = new Map((command.retainedRebases ?? []).map((item) => [item.stableDomKey, item]));
    const rebases: Array<{ previous: WebFlowPaintItem; next: WebFlowPaintItem; node: HTMLElement }> = [
      ...replacementRebases,
    ];
    entries = entries.map((entry) => {
      const next = rebaseByKey.get(entry.key);
      if (!next) return entry;
      if (entry.node) rebases.push({ previous: entry.item, next, node: entry.node });
      return {
        ...entry,
        renderFingerprint: next.renderFingerprint,
        blockId: next.block.id,
        item: next,
      };
    });
    const retainedNodes = inserted.filter(
      (entry) => entry.node != null && oldByKey.get(entry.key)?.node === entry.node,
    ).length;
    return {
      kind: 'full',
      entries,
      start,
      deleteCount: command.expectedRemovedKeys.length,
      work: {
        kind: command.kind,
        retainedNodes,
        createdNodes: inserted.filter((entry) => entry.node != null).length - retainedNodes,
        removedNodes: removedEntries.filter(
          (entry) => entry.node != null && !inserted.some((insertedEntry) => insertedEntry.node === entry.node),
        ).length,
        rebasedNodes: rebases.length,
        touchedItems: Math.max(command.expectedRemovedKeys.length, inserted.length) + rebases.length,
      },
      rebases,
    };
  }

  #rebuildEntryIndexes(): void {
    this.#entryByKey.clear();
    this.#indexByKey.clear();
    this.#entries.forEach((entry, index) => {
      this.#entryByKey.set(entry.key, entry);
      this.#indexByKey.set(entry.key, index);
    });
  }

  #applyLocalizedSplice(start: number, previous: readonly Entry[], inserted: readonly Entry[]): void {
    let anchor = this.#nextMountedNode(start + previous.length);
    for (let index = inserted.length - 1; index >= 0; index -= 1) {
      const node = inserted[index]!.node;
      if (!node) continue;
      if (node.parentNode !== this.#mount || node.nextSibling !== anchor) {
        this.#mount.insertBefore(node, anchor);
      }
      anchor = node;
    }
    previous.forEach((entry, index) => {
      if (entry.node && entry.node !== inserted[index]?.node) entry.node.remove();
    });
  }

  #applySplice(entries: readonly Entry[], start: number, deleteCount: number): void {
    const oldNodes = entryNodes(this.#entries.slice(start, start + deleteCount));
    const nextNode = this.#nextMountedNode(start + deleteCount);
    const inserted = entries.slice(start, entries.length - (this.#entries.length - start - deleteCount));
    let anchor = nextNode;
    for (let index = inserted.length - 1; index >= 0; index -= 1) {
      const node = inserted[index]!.node;
      if (!node) continue;
      if (node.parentNode !== this.#mount || node.nextSibling !== anchor) {
        this.#mount.insertBefore(node, anchor);
      }
      anchor = node;
    }
    oldNodes.forEach((node) => {
      if (!inserted.some((entry) => entry.node === node)) node.remove();
    });
  }

  #nextMountedNode(start: number): HTMLElement | null {
    for (let index = start; index < this.#entries.length; index += 1) {
      const node = this.#entries[index]?.node;
      if (node) return node;
    }
    return null;
  }
}

export function createWebFlowPainter(mount: HTMLElement, options: WebFlowPainterOptions = {}): WebFlowPainterHandle {
  return new WebFlowPainter(mount, options);
}
