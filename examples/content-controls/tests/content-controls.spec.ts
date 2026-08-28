import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

const clientName = 'Acme Products, Inc.';
const confidentialityClause =
  'Each party will protect confidential information with reasonable care and use it only to perform this agreement.';

async function textBoundary(line: Locator, text: string, offset: number): Promise<{ x: number; y: number }> {
  const point = await line.evaluate(
    (element, input) => {
      const fullText = element.textContent ?? '';
      const matchStart = fullText.indexOf(input.text);
      if (matchStart < 0) return null;

      const targetOffset = matchStart + input.offset;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let remaining = targetOffset;
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) {
          const range = document.createRange();
          range.setStart(node, Math.min(remaining, length));
          range.collapse(true);
          const rect = range.getBoundingClientRect();
          return { x: rect.left + 0.5, y: rect.top + rect.height / 2 };
        }
        remaining -= length;
      }
      return null;
    },
    { text, offset },
  );
  if (!point) throw new Error(`Could not find ${text}.`);
  return point;
}

async function selectText(page: Page, text: string): Promise<void> {
  const line = page.locator('.superdoc-line', { hasText: text }).first();
  await expect(line).toBeVisible({ timeout: 120_000 });
  const start = await textBoundary(line, text, 0);
  const end = await textBoundary(line, text, text.length);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function clickEmptyClauseLine(page: Page): Promise<void> {
  const heading = page.locator('.superdoc-line', { hasText: '4. Confidentiality' }).first();
  const nextHeading = page.locator('.superdoc-line', { hasText: '5. Ownership' }).first();
  await expect(heading).toBeVisible({ timeout: 120_000 });
  await expect(nextHeading).toBeVisible({ timeout: 120_000 });
  const [headingBox, nextHeadingBox] = await Promise.all([heading.boundingBox(), nextHeading.boundingBox()]);
  if (!headingBox || !nextHeadingBox) throw new Error('The clause slot is not visible.');
  await page.mouse.click(headingBox.x + 4, (headingBox.y + headingBox.height + nextHeadingBox.y) / 2);
}

test('rejects selections outside the authoring slots', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Select the client name to add the first field.', {
    timeout: 120_000,
  });

  await selectText(page, 'Provider will deliver product design');
  await page.getByRole('button', { name: 'Add inline field' }).click();
  await expect(page.locator('#status')).toHaveText('Select the client name in the document first.');
  await expect(page.locator('#detected-controls')).toHaveText('No fields yet.');

  await page.reload();
  await expect(page.locator('#status')).toHaveText('Select the client name to add the first field.', {
    timeout: 120_000,
  });
  await page.getByRole('button', { name: 'Add inline field' }).click();
  await expect(page.locator('#status')).toHaveText('Select the client name in the document first.');
  await expect(page.locator('#detected-controls')).toHaveText('No fields yet.');

  await page.locator('.superdoc-line', { hasText: 'Provider will deliver product design' }).first().click();
  await page.getByRole('button', { name: 'Add block field' }).click();
  await expect(page.locator('#status')).toHaveText('Place the caret on the empty line under Confidentiality first.');
  await expect(page.locator('#detected-controls')).toHaveText('No fields yet.');
});

test('authors, exports, and reopens inline and block fields', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Select the client name to add the first field.', {
    timeout: 120_000,
  });

  await selectText(page, clientName);
  await page.getByRole('button', { name: 'Add inline field' }).click();
  await expect(page.locator('#status')).toHaveText('Added the client name field.', { timeout: 120_000 });
  await expect(page.locator('#detected-controls')).toContainText('client.legalName');
  await expect(page.locator('#detected-controls')).toContainText('inline · text');
  await expect(page.getByRole('button', { name: 'Add inline field' })).toBeDisabled();
  await expect(page.locator('#detected-controls code', { hasText: 'client.legalName' })).toHaveCount(1);

  await clickEmptyClauseLine(page);
  await page.getByRole('button', { name: 'Add block field' }).click();
  await expect(page.locator('#status')).toHaveText('Added the confidentiality clause field.', { timeout: 120_000 });
  await expect(page.locator('#detected-controls')).toContainText('agreement.confidentiality');
  await expect(page.locator('#detected-controls')).toContainText('block · richText');
  await expect(page.locator('#editor')).toContainText(confidentialityClause);
  await expect(page.getByRole('button', { name: 'Add block field' })).toBeDisabled();
  await expect(page.locator('#detected-controls code', { hasText: 'agreement.confidentiality' })).toHaveCount(1);

  const download = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Export template' }).click();
  const downloadPath = await (await download).path();
  if (!downloadPath) throw new Error('The browser did not save the exported DOCX.');
  const exported = await readFile(downloadPath);

  const zip = await JSZip.loadAsync(exported);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  expect(documentXml).toContain('<w:tag w:val="client.legalName"');
  expect(documentXml).toContain('<w:tag w:val="agreement.confidentiality"');
  expect(documentXml).toMatch(/<w:p[^>]*>[\s\S]*<w:sdt>[\s\S]*client\.legalName[\s\S]*<\/w:sdt>[\s\S]*<\/w:p>/);
  expect(documentXml).toMatch(/<w:body[^>]*>[\s\S]*<w:sdt>[\s\S]*agreement\.confidentiality[\s\S]*<w:sdtContent><w:p/);

  await page.route('**/service-agreement-draft.docx', (route) =>
    route.fulfill({
      body: exported,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
  );
  await page.reload();
  await expect(page.locator('#detected-controls')).toContainText('client.legalName', { timeout: 120_000 });
  await expect(page.locator('#detected-controls')).toContainText('agreement.confidentiality');
  expect(errors).toEqual([]);
});
