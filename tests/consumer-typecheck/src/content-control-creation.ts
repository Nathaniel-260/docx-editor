import type { BrowserDocumentApi } from 'superdoc/ui';

declare const doc: BrowserDocumentApi;
declare const kind: 'block' | 'inline';

doc.create.contentControl({
  kind: 'inline',
  controlType: 'text',
  tag: 'client.legalName',
  content: 'Acme Products, Inc.',
});

doc.create.contentControl({ kind, content: 'Plain text for either field shape' });

doc.create.contentControl({
  kind: 'block',
  controlType: 'richText',
  tag: 'agreement.confidentiality',
  html: '<p>Confidentiality clause</p>',
});

// @ts-expect-error Structured HTML content requires a block content control.
doc.create.contentControl({ kind: 'inline', html: '<p>Invalid inline block</p>' });

// @ts-expect-error A content control accepts only one initial content format.
doc.create.contentControl({ kind: 'block', content: 'Text', html: '<p>HTML</p>' });

// @ts-expect-error A content control accepts only one initial content format.
doc.create.contentControl({ kind: 'block', content: 'Text', json: { type: 'paragraph' } });

// @ts-expect-error A content control accepts only one initial content format.
doc.create.contentControl({ kind: 'block', html: '<p>HTML</p>', json: { type: 'paragraph' } });

// @ts-expect-error Structured JSON content requires a block content control.
doc.create.contentControl({ kind: 'inline', json: { type: 'paragraph' } });

// @ts-expect-error Choose a selection or an existing content-control target, not both.
doc.create.contentControl({
  kind: 'inline',
  at: {
    kind: 'selection',
    start: { kind: 'text', blockId: 'p1', offset: 0 },
    end: { kind: 'text', blockId: 'p1', offset: 4 },
  },
  target: { kind: 'inline', nodeType: 'sdt', nodeId: 'field-1' },
});
