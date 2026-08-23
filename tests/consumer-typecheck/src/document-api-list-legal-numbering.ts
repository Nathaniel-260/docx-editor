import type { DocumentApi } from 'superdoc/ui';

declare const doc: DocumentApi;

const input: Parameters<DocumentApi['lists']['setLevelNumbering']>[0] = {
  target: { kind: 'block', nodeType: 'listItem', nodeId: 'section-1' },
  level: 1,
  numFmt: 'decimal',
  lvlText: '%1.%2',
  isLgl: true,
};

const result: ReturnType<DocumentApi['lists']['setLevelNumbering']> = doc.lists.setLevelNumbering(input);
void result;
