/**
 * Consumer typecheck: `doc.metadata.attach`/`resolve` accept a multi-paragraph
 * `TextTarget` in addition to the original same-paragraph `SelectionTarget`.
 *
 * Proves the widened `MetadataTarget`/`AnchoredMetadataResolveInfo.target`
 * union (`SelectionTarget | TextTarget`) is visible to consumers through
 * `superdoc/ui`'s `DocumentApi`, and that a single-segment attach still
 * resolves to a plain `SelectionTarget` — the same shape v1 callers already
 * depend on.
 */
import type { DocumentApi, SelectionTarget, TextTarget } from 'superdoc/ui';

declare const doc: DocumentApi;

const singleBlockTarget: SelectionTarget = {
  kind: 'selection',
  start: { kind: 'text', blockId: 'paragraph-1', offset: 0 },
  end: { kind: 'text', blockId: 'paragraph-1', offset: 4 },
};

const multiBlockTarget: TextTarget = {
  kind: 'text',
  segments: [
    { blockId: 'paragraph-1', range: { start: 10, end: 22 } },
    { blockId: 'paragraph-2', range: { start: 0, end: 6 } },
  ],
};

// attach() accepts either shape.
const attachSingle = doc.metadata.attach({
  namespace: 'urn:example:citations',
  target: singleBlockTarget,
  payload: { sourceId: 'source-1' },
});
const attachMulti = doc.metadata.attach({
  namespace: 'urn:example:citations',
  target: multiBlockTarget,
  payload: { sourceId: 'source-2' },
});
void [attachSingle, attachMulti];

// list({ within }) accepts either shape too.
void doc.metadata.list({ within: singleBlockTarget });
void doc.metadata.list({ within: multiBlockTarget });

// resolve() returns a union — narrow on `kind` to read either shape.
const resolved = doc.metadata.resolve({ id: 'source-2' });
if (resolved) {
  const target: SelectionTarget | TextTarget = resolved.target;
  if (target.kind === 'text') {
    const segments: TextTarget['segments'] = target.segments;
    void segments;
  } else {
    const start: SelectionTarget['start'] = target.start;
    void start;
  }
}
