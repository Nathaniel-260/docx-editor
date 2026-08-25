import type { BrowserDocumentApi, DocumentApi } from 'superdoc/ui';

declare const doc: DocumentApi;
declare const browserDoc: BrowserDocumentApi;

const finalResult = doc.blocks.list({ reviewMode: 'final' });
const originalResult = doc.blocks.list({ reviewMode: 'original', offset: 2, limit: 5 });
const redlineResult = doc.blocks.list({ reviewMode: 'redline', nodeTypes: ['listItem'] });
const invokedResult = doc.invoke<'blocks.list'>({
  operationId: 'blocks.list',
  input: { reviewMode: 'original', includeText: true },
});
const browserRequest = browserDoc.blocks.list({ reviewMode: 'redline' });

const finalMode: 'final' | 'original' | 'redline' = finalResult.reviewMode;
const originalMode: 'final' | 'original' | 'redline' = originalResult.reviewMode;
const redlineMode: 'final' | 'original' | 'redline' = redlineResult.reviewMode;
const invokedMode: 'final' | 'original' | 'redline' = invokedResult.reviewMode;

type BrowserBlocksListResult = Awaited<ReturnType<BrowserDocumentApi['blocks']['list']>>;
declare const browserResult: BrowserBlocksListResult;
const browserMode: 'final' | 'original' | 'redline' = browserResult.reviewMode;

void [finalMode, originalMode, redlineMode, invokedMode, browserMode, browserRequest];
