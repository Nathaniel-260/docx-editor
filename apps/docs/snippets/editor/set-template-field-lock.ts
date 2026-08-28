import type { LockMode } from '@superdoc/document-api';
import type { BrowserDocumentApi } from 'superdoc/ui';

export async function setTemplateFieldLock(doc: BrowserDocumentApi, tag: string, lockMode: LockMode) {
  const { items } = await doc.contentControls.selectByTag({ tag });

  if (items.length !== 1) {
    throw new Error(`Expected one content control tagged "${tag}", found ${items.length}.`);
  }

  return doc.contentControls.setLockMode({
    target: items[0].target,
    lockMode,
  });
}
