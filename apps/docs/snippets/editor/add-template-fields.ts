import type { BrowserDocumentApi, SelectionTarget } from 'superdoc/ui';

export async function addClientNameField(doc: BrowserDocumentApi, selection: SelectionTarget) {
  return doc.create.contentControl({
    kind: 'inline',
    controlType: 'text',
    tag: 'client.legalName',
    alias: 'Client legal name',
    at: selection,
  });
}

export async function addConfidentialityField(doc: BrowserDocumentApi, caret: SelectionTarget) {
  return doc.create.contentControl({
    kind: 'block',
    controlType: 'richText',
    tag: 'agreement.confidentiality',
    alias: 'Confidentiality clause',
    html: '<p>Each party will protect confidential information with reasonable care.</p>',
    at: caret,
  });
}
