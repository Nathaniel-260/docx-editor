import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DOCX = path.resolve(__dirname, 'fixtures/sample-review.docx');
const PDF = path.resolve(__dirname, '../../src/components/PdfViewer/fixtures/sd-3497-two-page.pdf');

const PAGE = `<!DOCTYPE html><html><head>
<link href="/dist-cdn/superdoc.min.css" rel="stylesheet"/>
<script>window.SUPERDOC_ENGINE_CDN_BASE_URL='/node_modules/@superdoc/docx-engine';</script>
<script src="/dist-cdn/superdoc.min.js"></script>
</head><body><div id="editor"></div></body></html>`;

async function open(page: Page): Promise<void> {
  await page.route('**/document-source-compatibility.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: PAGE }),
  );
  await page.goto('/document-source-compatibility.html');
  await page.waitForFunction(() => (window as never as { SuperDoc?: unknown }).SuperDoc !== undefined);
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('opens a DOCX URL in the document editor', async ({ page }) => {
  test.setTimeout(90_000);
  const docx = await readFile(DOCX);
  await page.route('**/contract.docx', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: docx,
    }),
  );

  await page.evaluate(() => {
    const SuperDoc = (window as never as { SuperDoc: new (config: unknown) => unknown }).SuperDoc;
    new SuperDoc({ selector: '#editor', document: '/contract.docx' });
  });

  await expect(page.locator('[data-editor-host="v2"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.superdoc-page').first()).toBeVisible({ timeout: 60_000 });
});

test('opens a PDF File in the PDF viewer', async ({ page }) => {
  test.setTimeout(90_000);
  const pdf = await readFile(PDF);
  await page.route('**/contract.pdf', (route) =>
    route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf }),
  );

  await page.evaluate(async () => {
    const response = await fetch('/contract.pdf');
    const data = new File([await response.arrayBuffer()], 'contract.pdf', { type: 'application/pdf' });
    const pdfLib = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    const SuperDoc = (window as never as { SuperDoc: new (config: unknown) => unknown }).SuperDoc;
    new SuperDoc({
      selector: '#editor',
      document: data,
      modules: {
        pdf: {
          pdfLib,
          setWorker: true,
          workerSrc: '/node_modules/pdfjs-dist/build/pdf.worker.mjs',
        },
      },
    });
  });

  await expect(page.locator('.sd-pdf-viewer')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-pdf-page]').first()).toBeVisible({ timeout: 60_000 });
});

test('opens an HTML Blob in the HTML viewer', async ({ page }) => {
  await page.evaluate(() => {
    const data = new Blob(['<p>Compatibility document</p>'], { type: 'text/html' });
    const SuperDoc = (window as never as { SuperDoc: new (config: unknown) => unknown }).SuperDoc;
    new SuperDoc({ selector: '#editor', document: data });
  });

  const content = page.locator('.superdoc-html-viewer__content');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Compatibility document');
});
