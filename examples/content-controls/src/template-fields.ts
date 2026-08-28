import type { BrowserDocumentApi, ContentControlInfo } from 'superdoc/ui';

export type FieldUpdateResult = {
  failures: string[];
  matched: number;
  unchanged: number;
  updated: number;
};

type ControlType = 'checkbox' | 'text';

async function updateControls(
  doc: BrowserDocumentApi,
  tag: string,
  expectedType: ControlType,
  mutate: (control: ContentControlInfo) => Promise<{ success: boolean; failure?: { code?: string; message?: string } }>,
): Promise<FieldUpdateResult> {
  let items: readonly ContentControlInfo[];
  try {
    ({ items } = await doc.contentControls.selectByTag({ tag }));
  } catch (error) {
    return {
      failures: [error instanceof Error ? error.message : `Could not find controls for ${tag}.`],
      matched: 0,
      unchanged: 0,
      updated: 0,
    };
  }
  const result: FieldUpdateResult = { failures: [], matched: items.length, unchanged: 0, updated: 0 };

  for (const control of items) {
    if (control.controlType !== expectedType) {
      result.failures.push(`${control.id} is ${control.controlType}, not ${expectedType}.`);
      continue;
    }

    try {
      const receipt = await mutate(control);
      if (receipt.success) result.updated += 1;
      else if (receipt.failure?.code === 'NO_OP') result.unchanged += 1;
      else result.failures.push(receipt.failure?.message ?? `Could not update ${control.id}.`);
    } catch (error) {
      result.failures.push(error instanceof Error ? error.message : `Could not update ${control.id}.`);
    }
  }

  return result;
}

export function updateTextField(doc: BrowserDocumentApi, tag: string, value: string) {
  return updateControls(doc, tag, 'text', (control) =>
    Promise.resolve(doc.contentControls.text.setValue({ target: control.target, value })),
  );
}

export function updateCheckboxField(doc: BrowserDocumentApi, tag: string, checked: boolean) {
  return updateControls(doc, tag, 'checkbox', (control) =>
    Promise.resolve(doc.contentControls.checkbox.setState({ target: control.target, checked })),
  );
}

export function didUpdateEveryMatch(result: { failures: readonly string[]; matched: number }) {
  return result.matched > 0 && result.failures.length === 0;
}

export function describeUpdate(result: FieldUpdateResult) {
  if (result.failures.length > 0 && result.matched === 0) return 'The document could not be updated.';
  if (result.matched === 0) return 'No matching controls.';
  if (result.failures.length > 0) return `Updated ${result.updated} of ${result.matched} locations.`;
  if (result.updated === 0) return `${result.matched} locations already match.`;
  return `Updated ${result.updated} ${result.updated === 1 ? 'location' : 'locations'}.`;
}
