import { rebaseWebFlowItemNode, renderWebFlowItem, webFlowItemIdentityFingerprint } from './render.js';
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

interface Entry extends WebFlowDomBinding {
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
    const beforeNodes = beforeEntries?.map((entry) => entry.node) ?? null;
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
        this.#mount.replaceChildren(...this.#entries.map((entry) => entry.node));
      } else {
        this.#mount.replaceChildren(...beforeNodes!);
        this.#entries = beforeEntries!;
      }
      this.#rebuildEntryIndexes();
      this.#epoch = beforeEpoch;
      this.#version = beforeVersion;
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
        } else this.#mount.replaceChildren(...prepared.entries.map((entry) => entry.node));
        rollbackRebases = prepared.rebases.map(({ previous, next, node }) =>
          rebaseWebFlowItemNode(node, previous, next),
        );
        const touchedEntries = prepared.kind === 'localized-splice' ? prepared.inserted : prepared.entries;
        const rebasedNodes = new Set(prepared.rebases.map((rebase) => rebase.node));
        const changedEntries =
          prepared.kind === 'localized-splice'
            ? prepared.inserted.filter(
                (entry, index) => entry.node !== prepared.previous[index]?.node || rebasedNodes.has(entry.node),
              )
            : prepared.entries;
        if (prepared.kind === 'localized-splice') {
          prepared.inserted.forEach((entry, index) => {
            const entryIndex = prepared.start + index;
            this.#entries[entryIndex] = entry;
            this.#entryByKey.set(entry.key, entry);
            this.#indexByKey.set(entry.key, entryIndex);
          });
        } else {
          this.#entries = prepared.entries;
          this.#rebuildEntryIndexes();
        }
        this.#epoch = command.epoch;
        this.#version += 1;
        state = 'applied';
        applied = {
          work: prepared.work,
          touchedBindings: touchedEntries.map(({ key, renderFingerprint, blockId, node }) => ({
            key,
            renderFingerprint,
            blockId,
            node,
          })),
          changedBindings: changedEntries.map(({ key, renderFingerprint, blockId, node }) => ({
            key,
            renderFingerprint,
            blockId,
            node,
          })),
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
      bindings: this.#entries.map(({ key, renderFingerprint, blockId, node }) => ({
        key,
        renderFingerprint,
        blockId,
        node,
      })),
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
      this.#mount.replaceChildren(...entries.map((entry) => entry.node));
      this.#entries = entries;
      this.#rebuildEntryIndexes();
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
    if (this.#mount.childNodes.length !== this.#entries.length) fail('unowned root mutation detected');
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
      if (existing?.renderFingerprint === item.renderFingerprint) {
        if (webFlowItemIdentityFingerprint(existing.item) !== webFlowItemIdentityFingerprint(item)) {
          replacementRebases.push({ previous: existing.item, next: item, node: existing.node });
        }
        return {
          ...existing,
          blockId: item.block.id,
          item,
        };
      }
      const node = renderWebFlowItem(item, this.#mount.ownerDocument, this.#options);
      return {
        key: item.stableDomKey,
        renderFingerprint: item.renderFingerprint,
        blockId: item.block.id,
        node,
        item,
      };
    };

    if (command.kind === 'replace-all') {
      const entries = command.items.map(createEntry);
      const retainedNodes = entries.filter((entry) => oldByKey.get(entry.key)?.node === entry.node).length;
      const nextNodes = new Set(entries.map((entry) => entry.node));
      return {
        kind: 'full',
        entries,
        start: 0,
        deleteCount: this.#entries.length,
        work: {
          kind: command.kind,
          retainedNodes,
          createdNodes: entries.length - retainedNodes,
          removedNodes: this.#entries.filter((entry) => !nextNodes.has(entry.node)).length,
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
      const retainedNodes = inserted.filter((entry, index) => entry.node === removedEntries[index]?.node).length;
      return {
        kind: 'localized-splice',
        start,
        previous: removedEntries,
        inserted,
        work: {
          kind: command.kind,
          retainedNodes,
          createdNodes: inserted.length - retainedNodes,
          removedNodes: removedEntries.filter((entry, index) => entry.node !== inserted[index]?.node).length,
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
      rebases.push({ previous: entry.item, next, node: entry.node });
      return {
        ...entry,
        renderFingerprint: next.renderFingerprint,
        blockId: next.block.id,
        item: next,
      };
    });
    const retainedNodes = inserted.filter((entry) => oldByKey.get(entry.key)?.node === entry.node).length;
    return {
      kind: 'full',
      entries,
      start,
      deleteCount: command.expectedRemovedKeys.length,
      work: {
        kind: command.kind,
        retainedNodes,
        createdNodes: inserted.length - retainedNodes,
        removedNodes: removedEntries.filter((entry) => !inserted.includes(entry)).length,
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
    let anchor = this.#entries[start + previous.length]?.node ?? null;
    for (let index = inserted.length - 1; index >= 0; index -= 1) {
      const node = inserted[index]!.node;
      if (node.parentNode !== this.#mount || node.nextSibling !== anchor) {
        this.#mount.insertBefore(node, anchor);
      }
      anchor = node;
    }
    previous.forEach((entry, index) => {
      if (entry.node !== inserted[index]?.node) entry.node.remove();
    });
  }

  #applySplice(entries: readonly Entry[], start: number, deleteCount: number): void {
    const oldNodes = this.#entries.slice(start, start + deleteCount).map((entry) => entry.node);
    const nextNode = this.#entries[start + deleteCount]?.node ?? null;
    const inserted = entries.slice(start, entries.length - (this.#entries.length - start - deleteCount));
    let anchor = nextNode;
    for (let index = inserted.length - 1; index >= 0; index -= 1) {
      const node = inserted[index]!.node;
      if (node.parentNode !== this.#mount || node.nextSibling !== anchor) {
        this.#mount.insertBefore(node, anchor);
      }
      anchor = node;
    }
    oldNodes.forEach((node) => {
      if (!inserted.some((entry) => entry.node === node)) node.remove();
    });
  }
}

export function createWebFlowPainter(mount: HTMLElement, options: WebFlowPainterOptions = {}): WebFlowPainterHandle {
  return new WebFlowPainter(mount, options);
}
