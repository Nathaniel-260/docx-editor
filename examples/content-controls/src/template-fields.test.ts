import { describe, expect, it, vi } from 'vitest';
import type { BrowserDocumentApi } from 'superdoc/ui';

import { hasCompatibleTemplateFields, templateFields } from './field-schema';
import { describeUpdate, didUpdateEveryMatch, updateTextField } from './template-fields';

function makeDoc(
  controls: Array<{ id: string; controlType: 'checkbox' | 'text' }>,
  setValue: ReturnType<typeof vi.fn>,
) {
  return {
    contentControls: {
      selectByTag: vi.fn().mockResolvedValue({
        items: controls.map((control) => ({
          ...control,
          target: { kind: 'inline', nodeId: control.id, nodeType: 'sdt' },
        })),
      }),
      text: { setValue },
    },
  } as unknown as BrowserDocumentApi;
}

describe('updateTextField', () => {
  it('updates every occurrence returned for a tag', async () => {
    const setValue = vi.fn().mockResolvedValue({ success: true });
    const result = await updateTextField(
      makeDoc(
        [
          { id: 'one', controlType: 'text' },
          { id: 'two', controlType: 'text' },
          { id: 'three', controlType: 'text' },
        ],
        setValue,
      ),
      'client.legalName',
      'Northstar Labs LLC',
    );

    expect(setValue).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ failures: [], matched: 3, unchanged: 0, updated: 3 });
    expect(describeUpdate(result)).toBe('Updated 3 locations.');
  });

  it('reports a partial update instead of hiding a failed occurrence', async () => {
    const setValue = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, failure: { code: 'LOCK_VIOLATION', message: 'Locked.' } })
      .mockResolvedValueOnce({ success: true });
    const result = await updateTextField(
      makeDoc(
        [
          { id: 'one', controlType: 'text' },
          { id: 'two', controlType: 'text' },
          { id: 'three', controlType: 'text' },
        ],
        setValue,
      ),
      'client.legalName',
      'Northstar Labs LLC',
    );

    expect(result).toEqual({ failures: ['Locked.'], matched: 3, unchanged: 0, updated: 2 });
    expect(describeUpdate(result)).toBe('Updated 2 of 3 locations.');
  });

  it('reports a failed content-control lookup as a field update failure', async () => {
    const doc = makeDoc([], vi.fn());
    vi.mocked(doc.contentControls.selectByTag).mockRejectedValueOnce(new Error('Document API unavailable.'));

    const result = await updateTextField(doc, 'client.legalName', 'Northstar Labs LLC');

    expect(result).toEqual({
      failures: ['Document API unavailable.'],
      matched: 0,
      unchanged: 0,
      updated: 0,
    });
    expect(describeUpdate(result)).toBe('The document could not be updated.');
  });

  it('does not treat an empty match as a complete update', () => {
    expect(didUpdateEveryMatch({ failures: [], matched: 0 })).toBe(false);
  });
});

describe('template readiness', () => {
  const matchingControls = templateFields.map((field, index) => ({
    controlType: field.type,
    id: String(index),
    properties: { tag: field.tag },
  }));

  it('revokes readiness when a later snapshot loses a compatible field', () => {
    expect(hasCompatibleTemplateFields(matchingControls)).toBe(true);
    expect(hasCompatibleTemplateFields(matchingControls.slice(0, -1))).toBe(false);
    expect(
      hasCompatibleTemplateFields([
        ...matchingControls.slice(0, -1),
        { ...matchingControls.at(-1)!, controlType: 'text' },
      ]),
    ).toBe(false);
  });
});
