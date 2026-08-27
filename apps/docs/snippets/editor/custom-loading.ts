import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

function requireElement<ElementType extends HTMLElement>(selector: string) {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`${selector} not found.`);
  return element;
}

const editor = requireElement<HTMLElement>('#editor');
const status = requireElement<HTMLElement>('#document-status');

function showLoading() {
  editor.hidden = true;
  status.hidden = false;
  status.textContent = 'Opening document…';
}

function showEditor() {
  status.hidden = true;
  editor.hidden = false;
}

function showError(error: unknown) {
  console.error('Could not open the document.', error);
  editor.hidden = true;
  status.hidden = false;
  status.textContent = 'Could not open the document. Try again.';
}

const superdoc = new SuperDoc({
  selector: editor,
  document: '/contract.docx',
  ui: { loading: false },
  onReady: showEditor,
  onContentError: ({ error }) => showError(error),
});

async function replaceDocument(file: File) {
  showLoading();
  try {
    const result = await superdoc.replaceFile(file);
    const state = result && typeof result === 'object' ? (result as { state?: unknown }).state : undefined;
    const replaced = state === undefined || state === null || state === 'review-ready' || state === 'editing-ready';
    if (!replaced) throw new Error('SuperDoc could not replace the document.');
    showEditor();
  } catch (error) {
    showError(error);
  }
}

export { replaceDocument };
