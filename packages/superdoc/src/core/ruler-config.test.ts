import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { SuperDocPageMarginsChangePayload } from './types/index.js';

vi.mock('./v2-integration/v2-integration.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./v2-integration/v2-integration.js')>()),
  loadDefaultV2IntegrationOrFallback: () => Promise.resolve(),
}));

const { SuperDoc } = await import('./SuperDoc.js');

const instances: InstanceType<typeof SuperDoc>[] = [];

afterEach(() => {
  for (const instance of instances.splice(0)) instance.destroy();
  document.body.innerHTML = '';
});

describe('ruler configuration', () => {
  it('routes page margin changes to the configured callback', async () => {
    const selector = document.createElement('div');
    document.body.append(selector);
    const onPageMarginsChange = vi.fn();
    const superdoc = new SuperDoc({
      selector,
      document: new File(
        [readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../shared/common/data/blank.docx'))],
        'blank.docx',
        {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ),
      telemetry: { enabled: false },
      onPageMarginsChange,
    });
    instances.push(superdoc);

    const payload: SuperDocPageMarginsChangePayload = {
      documentId: 'document-1',
      editorVersion: 2,
      sectionId: 'section-1',
      sectionIndex: 0,
      side: 'left',
      value: 1.25,
      pageMargins: { top: 1, right: 1, bottom: 1, left: 1.25 },
    };

    await vi.waitFor(() => expect(superdoc.listenerCount('page-margins-change')).toBe(1));
    superdoc.emit('page-margins-change', payload);

    expect(onPageMarginsChange).toHaveBeenCalledOnce();
    expect(onPageMarginsChange).toHaveBeenCalledWith(payload);
  });
});
