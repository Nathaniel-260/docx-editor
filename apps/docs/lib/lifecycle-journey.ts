export type LifecycleStageId = 'mount' | 'ready' | 'edit' | 'save' | 'unmount';

export type LifecycleStage = {
  id: LifecycleStageId;
  label: string;
  signal: string;
  title: string;
  description: string;
  code: string;
  appStatus: string;
  appTone: 'neutral' | 'ready' | 'dirty';
  appView: 'loading' | 'document' | 'edited' | 'saved' | 'unmounted';
  actionsEnabled: boolean;
};

export const lifecycleStages: readonly LifecycleStage[] = [
  {
    id: 'mount',
    label: 'Mount',
    signal: 'new SuperDoc()',
    title: 'Show a loading state',
    description: 'Keep document actions disabled while the DOCX opens.',
    code: `const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
});`,
    appStatus: 'Opening…',
    appTone: 'neutral',
    appView: 'loading',
    actionsEnabled: false,
  },
  {
    id: 'ready',
    label: 'Ready',
    signal: 'onReady',
    title: 'Enable document actions',
    description: 'The document is available. Enable Save or Export and run document queries.',
    code: `onReady: () => {
  saveButton.disabled = false;
  setStatus('Ready');
},`,
    appStatus: 'Ready',
    appTone: 'ready',
    appView: 'document',
    actionsEnabled: true,
  },
  {
    id: 'edit',
    label: 'Edit',
    signal: 'onEditorUpdate',
    title: 'Mark the document unsaved',
    description: 'Update your dirty state after an edit. Debounce autosave work if you start it here.',
    code: `onEditorUpdate: () => {
  setStatus('Unsaved changes');
},`,
    appStatus: 'Unsaved changes',
    appTone: 'dirty',
    appView: 'edited',
    actionsEnabled: true,
  },
  {
    id: 'save',
    label: 'Save',
    signal: 'export() + fetch()',
    title: 'Wait for storage',
    description: 'Export produces DOCX bytes. Mark the document saved only after your backend accepts them.',
    code: `const file = await superdoc.export({
  triggerDownload: false,
});
if (!(file instanceof Blob)) throw new Error('Export failed.');
const response = await fetch('/api/documents/42', {
  method: 'PUT',
  body: file,
});
if (!response.ok) throw new Error('Save failed.');
setStatus('Saved');`,
    appStatus: 'Saved',
    appTone: 'ready',
    appView: 'saved',
    actionsEnabled: true,
  },
  {
    id: 'unmount',
    label: 'Unmount',
    signal: 'destroy()',
    title: 'Release the Editor',
    description: 'Call destroy() when the route or component that owns the Editor unmounts.',
    code: `function cleanup() {
  superdoc.destroy();
}`,
    appStatus: 'Unmounted',
    appTone: 'neutral',
    appView: 'unmounted',
    actionsEnabled: false,
  },
] as const;

export const lifecycleFailure = {
  id: 'failure',
  label: 'Load fails',
  signal: 'onContentError / onException',
  title: 'Show a useful error',
  description: 'Keep document actions disabled. Show a retry path instead of an empty mount point.',
  code: `onContentError: ({ error }) => showLoadError(error),
onException: ({ error }) => showLoadError(error),`,
  appStatus: 'Could not open',
  appTone: 'error',
  appView: 'error',
  actionsEnabled: false,
} as const;

export function renderLifecycleJourneyMarkdown() {
  const stages = lifecycleStages.map(
    (stage, index) => `${index + 1}. **${stage.label} — \`${stage.signal}\`:** ${stage.title}. ${stage.description}`,
  );

  return [
    '> **Interactive model: the Editor lifecycle in your application**',
    '>',
    '> The preview moves `/sample.docx` through the application states that matter to a user.',
    '>',
    ...stages.map((stage) => `> ${stage}`),
    '>',
    `> **${lifecycleFailure.label} — \`${lifecycleFailure.signal}\`:** ${lifecycleFailure.title}. ${lifecycleFailure.description}`,
    '',
  ].join('\n');
}
