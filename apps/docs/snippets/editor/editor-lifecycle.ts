import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

function requireElement<ElementType extends Element>(selector: string) {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`${selector} not found.`);
  return element;
}

const status = requireElement<HTMLOutputElement>('#editor-status');
const saveButton = requireElement<HTMLButtonElement>('#save-docx');

let isReady = false;
let editRevision = 0;

function showLoadError(error: unknown) {
  console.error('SuperDoc error', error);
  if (isReady) return;

  status.value = 'Could not open the document';
  saveButton.disabled = true;
}

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
  onReady: () => {
    isReady = true;
    status.value = 'Ready';
    saveButton.disabled = false;
  },
  onEditorUpdate: () => {
    editRevision += 1;
    status.value = 'Unsaved changes';
  },
  onContentError: ({ error }) => showLoadError(error),
  onException: ({ error }) => showLoadError(error),
});

async function saveDocument() {
  if (!isReady) return;

  const savedRevision = editRevision;
  saveButton.disabled = true;
  status.value = 'Saving…';
  try {
    const file = await superdoc.export({
      exportType: ['docx'],
      triggerDownload: false,
    });
    if (!(file instanceof Blob)) throw new Error('Expected one DOCX file.');

    const response = await fetch('/api/documents/42', {
      method: 'PUT',
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      body: file,
    });
    if (!response.ok) throw new Error(`Save failed with ${response.status}.`);
    status.value = editRevision === savedRevision ? 'Saved' : 'Unsaved changes';
  } catch (error) {
    status.value = 'Save failed';
    console.error('The document was not saved.', error);
  } finally {
    saveButton.disabled = false;
  }
}

saveButton.addEventListener('click', saveDocument);

export function unmountEditor() {
  saveButton.removeEventListener('click', saveDocument);
  superdoc.destroy();
}
