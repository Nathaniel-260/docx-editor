import type { BrowserDocumentApi } from 'superdoc/ui';

export async function replaceClause(doc: BrowserDocumentApi, tag: string, content: string) {
  const { items } = await doc.contentControls.selectByTag({ tag });

  if (items.length !== 1) {
    throw new Error(`Expected one content control tagged "${tag}", found ${items.length}.`);
  }

  const [control] = items;
  if (control.kind !== 'block') {
    throw new Error(`Content control "${tag}" must be block-level.`);
  }

  return doc.contentControls.replaceContent({
    target: control.target,
    content,
    format: 'text',
  });
}
