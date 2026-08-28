import { SuperDoc } from 'superdoc';
import type { BrowserDocumentApi, ContentControlInfo, SelectionSlice } from 'superdoc/ui';

const addInlineButton = requireElement<HTMLButtonElement>('#add-inline-field');
const addBlockButton = requireElement<HTMLButtonElement>('#add-block-field');
const controlsList = requireElement<HTMLUListElement>('#detected-controls');
const exportButton = requireElement<HTMLButtonElement>('#export-docx');
const status = requireElement<HTMLParagraphElement>('#authoring-status');

let documentApi: BrowserDocumentApi | null = null;
let latestSelection: SelectionSlice | null = null;
let detectedControls: readonly ContentControlInfo[] = [];
let selectionCleanup: (() => void) | null = null;
const clientName = 'Acme Products, Inc.';
const confidentialitySlotBlockId = 'A100000B';
const selectionSettleTimeoutMs = 2_000;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}.`);
  return element;
}

function hasTag(tag: string): boolean {
  return detectedControls.some((control) => control.properties.tag === tag);
}

function renderControls(items: readonly ContentControlInfo[]): void {
  controlsList.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No fields yet.';
    controlsList.append(empty);
  } else {
    for (const control of items) {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      const tag = document.createElement('code');
      const shape = document.createElement('span');
      name.textContent = control.properties.alias ?? 'Untitled field';
      tag.textContent = control.properties.tag ?? 'No tag';
      shape.textContent = `${control.kind} · ${control.controlType}`;
      item.append(name, tag, shape);
      controlsList.append(item);
    }
  }

  addInlineButton.disabled = !documentApi || hasTag('client.legalName');
  addBlockButton.disabled = !documentApi || hasTag('agreement.confidentiality');
  exportButton.disabled = !documentApi || items.length === 0;
}

function mutationFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The field could not be added.';
}

async function refreshControls(): Promise<void> {
  if (!documentApi) return;
  const result = await documentApi.contentControls.list();
  detectedControls = result.items;
  renderControls(result.items);
}

async function readReadySelection(): Promise<SelectionSlice | null> {
  if (latestSelection?.status === 'ready') return latestSelection;

  const current = superdoc.ui.selection.getSnapshot();
  if (current.status === 'ready') return current;
  const requiresTarget = Boolean(latestSelection?.selectionTarget ?? current.selectionTarget);

  return new Promise((resolve) => {
    let unsubscribe = (): void => {};
    let settled = false;
    const finish = (selection: SelectionSlice | null): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(selection);
    };
    const timeout = window.setTimeout(() => finish(latestSelection), selectionSettleTimeoutMs);

    unsubscribe = superdoc.ui.selection.observe((snapshot) => {
      if (snapshot.selectionTarget) latestSelection = snapshot;
      if (snapshot.status === 'ready' && (!requiresTarget || snapshot.selectionTarget)) finish(snapshot);
    });
    if (settled) unsubscribe();
  });
}

addInlineButton.addEventListener('click', async () => {
  const selection = await readReadySelection();
  const target =
    selection?.status === 'ready' && selection.empty === false && selection.quotedText === clientName
      ? selection.selectionTarget
      : null;
  if (!documentApi || !target) {
    status.textContent = 'Select the client name in the document first.';
    return;
  }

  addInlineButton.disabled = true;
  try {
    const receipt = await documentApi.create.contentControl({
      kind: 'inline',
      controlType: 'text',
      tag: 'client.legalName',
      alias: 'Client legal name',
      at: target,
    });
    if (receipt.success) {
      await refreshControls();
      status.textContent = 'Added the client name field.';
    } else {
      status.textContent = receipt.failure.message;
    }
  } catch (error) {
    status.textContent = mutationFailure(error);
  } finally {
    renderControls(detectedControls);
  }
});

addBlockButton.addEventListener('click', async () => {
  const selection = await readReadySelection();
  const target = selection?.status === 'ready' && selection.empty === true ? selection.selectionTarget : null;
  const isConfidentialitySlot =
    target?.start.kind === 'text' &&
    target.end.kind === 'text' &&
    target.start.blockId === confidentialitySlotBlockId &&
    target.end.blockId === confidentialitySlotBlockId;
  if (!documentApi || !target || !isConfidentialitySlot) {
    status.textContent = 'Place the caret on the empty line under Confidentiality first.';
    return;
  }

  addBlockButton.disabled = true;
  try {
    const receipt = await documentApi.create.contentControl({
      kind: 'block',
      controlType: 'richText',
      tag: 'agreement.confidentiality',
      alias: 'Confidentiality clause',
      html: '<p>Each party will protect confidential information with reasonable care and use it only to perform this agreement.</p>',
      at: target,
    });
    if (receipt.success) {
      await refreshControls();
      status.textContent = 'Added the confidentiality clause field.';
    } else {
      status.textContent = receipt.failure.message;
    }
  } catch (error) {
    status.textContent = mutationFailure(error);
  } finally {
    renderControls(detectedControls);
  }
});

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/service-agreement-draft.docx',
  ui: {
    comments: false,
    toolbar: false,
  },
  onReady: ({ superdoc: readySuperDoc }) => {
    documentApi = readySuperDoc.activeEditor?.doc ?? null;
    if (!documentApi) {
      status.textContent = 'The Document API is not ready.';
      return;
    }

    selectionCleanup = readySuperDoc.ui.selection.observe((snapshot) => {
      if (snapshot.selectionTarget) latestSelection = snapshot;
    });
    void refreshControls()
      .then(() => {
        status.textContent = 'Select the client name to add the first field.';
      })
      .catch((error: unknown) => {
        status.textContent = mutationFailure(error);
      });
  },
  onException: ({ error }) => {
    status.textContent = 'The document could not be opened.';
    console.error(error);
  },
});

exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  try {
    await superdoc.export({ exportType: ['docx'], exportedName: 'service-agreement-template' });
  } catch {
    status.textContent = 'The template could not be exported.';
  } finally {
    renderControls(detectedControls);
  }
});

window.addEventListener('beforeunload', () => {
  selectionCleanup?.();
  superdoc.destroy();
});
