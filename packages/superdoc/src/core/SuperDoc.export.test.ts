/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SuperDoc } from './SuperDoc.js';
import type { ExportParams } from './types/index.js';

const mountedInstances: SuperDoc[] = [];

function createInstance(): SuperDoc {
  const selector = document.createElement('div');
  document.body.append(selector);

  const instance = new SuperDoc({ selector, telemetry: { enabled: false } });
  mountedInstances.push(instance);
  return instance;
}

function createDocxBlob(): Blob {
  return new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

afterEach(() => {
  for (const instance of mountedInstances.splice(0)) instance.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('SuperDoc.export', () => {
  it.each([
    ['pdf only', ['pdf']],
    ['HTML only', ['html']],
    ['an empty list', []],
    ['mixed supported and unsupported types', ['docx', 'pdf']],
  ])('rejects %s before exporting DOCX', async (_label, exportType) => {
    const instance = createInstance();
    const exportDocx = vi.spyOn(instance, 'exportEditorsToDOCX').mockResolvedValue([createDocxBlob()]);

    await expect(
      instance.export({
        exportType: exportType as unknown as ExportParams['exportType'],
        triggerDownload: false,
      }),
    ).rejects.toThrow('SuperDoc.export() only supports exportType: ["docx"].');
    expect(exportDocx).not.toHaveBeenCalled();
  });

  it('rejects unsupported output before downloading an additional file', async () => {
    const instance = createInstance();
    const exportDocx = vi.spyOn(instance, 'exportEditorsToDOCX').mockResolvedValue([createDocxBlob()]);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(
      instance.export({
        exportType: ['pdf'] as unknown as ExportParams['exportType'],
        additionalFiles: [new Blob(['audit'])],
        additionalFileNames: ['audit.json'],
      }),
    ).rejects.toThrow('SuperDoc.export() only supports exportType: ["docx"].');
    expect(exportDocx).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it.each([
    ['the default export type', undefined],
    ['DOCX', ['docx']],
  ])('keeps %s working', async (_label, exportType) => {
    const instance = createInstance();
    const docx = createDocxBlob();
    const exportDocx = vi.spyOn(instance, 'exportEditorsToDOCX').mockResolvedValue([docx]);

    const result = await instance.export({
      exportType: exportType as unknown as ExportParams['exportType'],
      triggerDownload: false,
    });

    expect(result).toBe(docx);
    expect(exportDocx).toHaveBeenCalledOnce();
  });
});
