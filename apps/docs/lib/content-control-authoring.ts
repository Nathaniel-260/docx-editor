import type { SelectionSlice } from 'superdoc/ui';

export function getReadyAuthoringTarget(selection: SelectionSlice | null, expectedEmpty: boolean) {
  if (selection?.status !== 'ready' || selection.empty !== expectedEmpty) return null;
  return selection.selectionTarget;
}

export function renderContentControlAuthoringMarkdown() {
  return [
    '> **Interactive editor: add template fields**',
    '>',
    '> Select “Acme Products, Inc.” and add an inline text field tagged `client.legalName`. Then place the caret on the empty line below Confidentiality and add a block rich-text field tagged `agreement.confidentiality`. The detected-fields list reports each field’s alias, tag, placement, and control type. Export downloads the authored DOCX.',
    '',
  ].join('\n');
}
