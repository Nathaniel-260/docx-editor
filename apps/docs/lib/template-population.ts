export const templatePopulationFields = {
  clientLegalName: {
    key: 'clientLegalName',
    label: 'Client legal name',
    occurrences: 3,
    tag: 'client.legalName',
    type: 'text',
  },
  autoRenew: {
    key: 'autoRenew',
    label: 'Auto-renew',
    occurrences: 1,
    tag: 'agreement.autoRenew',
    type: 'checkbox',
  },
} as const;

export type TemplatePopulationField = (typeof templatePopulationFields)[keyof typeof templatePopulationFields];
export type TemplatePopulationFieldKey = TemplatePopulationField['key'];

export type TemplatePopulationUpdateContext<TDocument> = {
  document: TDocument;
  isCurrent(): boolean;
};

export function createTemplatePopulationUpdateQueue<TDocument>() {
  let activeDocument: TDocument | null = null;
  let generation = 0;
  let queue = Promise.resolve();
  const failedFields = new Set<TemplatePopulationFieldKey>();

  function activate(document: TDocument) {
    generation += 1;
    activeDocument = document;
    queue = Promise.resolve();
    failedFields.clear();
  }

  function invalidate() {
    generation += 1;
    activeDocument = null;
    queue = Promise.resolve();
    failedFields.clear();
  }

  function enqueue(
    field: TemplatePopulationFieldKey,
    update: (context: TemplatePopulationUpdateContext<TDocument>) => Promise<boolean>,
  ) {
    const document = activeDocument;
    const updateGeneration = generation;
    if (document === null) {
      failedFields.add(field);
      return Promise.resolve();
    }

    const context: TemplatePopulationUpdateContext<TDocument> = {
      document,
      isCurrent: () => activeDocument === document && generation === updateGeneration,
    };
    const pending = queue.then(async () => {
      if (!context.isCurrent()) return;

      let succeeded = false;
      try {
        succeeded = await update(context);
      } catch {
        succeeded = false;
      }
      if (!context.isCurrent()) return;

      if (succeeded) failedFields.delete(field);
      else failedFields.add(field);
    });
    queue = pending;
    return pending;
  }

  return {
    activate,
    enqueue,
    hasFailures: () => failedFields.size > 0,
    invalidate,
    wait: () => queue,
  };
}

export function renderTemplatePopulationMarkdown() {
  const { autoRenew, clientLegalName } = templatePopulationFields;

  return [
    '> **Interactive editor: Fill the template**',
    '>',
    '> The application form updates real Word content controls in the service-agreement DOCX.',
    '>',
    `> - ${clientLegalName.label} (\`${clientLegalName.tag}\`): one form value updates ${clientLegalName.occurrences} document occurrences.`,
    `> - ${autoRenew.label} (\`${autoRenew.tag}\`): the checkbox updates the Word checkbox control.`,
    '>',
    '> The demo reports how many matching controls changed. Reset restores the prepared template, and Export DOCX downloads the filled document.',
    '',
  ].join('\n');
}
