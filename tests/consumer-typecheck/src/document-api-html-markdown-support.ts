import type {
  BrowserDocumentApi,
  DocumentApi,
  RichContentInsertInput,
  SDHtmlMarkdownSupportCheckResult,
} from 'superdoc/ui';

declare const doc: DocumentApi;
declare const browserDoc: BrowserDocumentApi;

const richInsert: RichContentInsertInput = {
  type: 'markdown',
  value: '# Checked content',
  target: { kind: 'block', nodeType: 'paragraph', nodeId: 'paragraph-1' },
  placement: 'after',
};

async function checkThenApply(): Promise<void> {
  const check: SDHtmlMarkdownSupportCheckResult = await doc.capabilities.check({
    operation: 'insert',
    input: richInsert,
    options: { changeMode: 'tracked' },
  });

  if (check.operation === 'insert' && check.supported && check.guard) {
    const receipt = doc.insert(richInsert, { changeMode: 'tracked', supportCheck: check.guard });
    const outcome = receipt.outcome;
    void outcome;
  }

  const projected = await doc.capabilities.check({
    operation: 'projectHtml',
    input: { reviewMode: 'redline', includeSourceMap: true },
  });
  if (projected.operation === 'projectHtml' && projected.projection) {
    const sameOutcome = projected.outcome === projected.projection.outcome;
    void sameOutcome;
  }
}

const browserCheck: ReturnType<BrowserDocumentApi['capabilities']['check']> = browserDoc.capabilities.check({
  operation: 'projectMarkdown',
  input: { reviewMode: 'final' },
});

void [checkThenApply, browserCheck];
