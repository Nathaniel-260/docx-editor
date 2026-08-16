import type { BrowserDocumentApi, DocumentApi } from 'superdoc/ui';

declare const doc: DocumentApi;
declare const browserDoc: BrowserDocumentApi;
type ReplaceInput = Parameters<DocumentApi['replace']>[0];

const body = { kind: 'story', storyType: 'body' } as const;
const fragment = [
  {
    kind: 'paragraph' as const,
    paragraph: { inlines: [{ kind: 'run' as const, run: { text: 'Replacement' } }] },
  },
];

const inputs: ReplaceInput[] = [
  { target: body, text: 'Plain replacement' },
  { target: body, type: 'html', value: '<p>HTML replacement</p>' },
  { target: body, type: 'markdown', value: 'Markdown replacement' },
  { target: body, content: fragment },
];

for (const input of inputs) {
  doc.replace(input, { changeMode: 'direct' });
  browserDoc.replace(input, { changeMode: 'direct' });
}

// @ts-expect-error Complete-body replacement is unambiguous and cannot also target a ref.
const bodyWithRef: ReplaceInput = { target: body, ref: 'opaque', text: 'invalid' };
// @ts-expect-error A body target already identifies the story and cannot be nested in another story.
const bodyWithStory: ReplaceInput = { target: body, in: body, content: fragment };
// @ts-expect-error A complete-body fragment cannot use block nesting policy.
const bodyWithNesting: ReplaceInput = { target: body, nestingPolicy: { tables: 'forbid' }, content: fragment };

void [bodyWithRef, bodyWithStory, bodyWithNesting];
