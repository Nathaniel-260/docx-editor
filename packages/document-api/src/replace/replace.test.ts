import { describe, expect, it, vi } from 'vite-plus/test';
import type { SelectionMutationAdapter } from '../selection-mutation.js';
import type { WriteAdapter } from '../write/write.js';
import { executeReplace, type ReplaceInput } from './replace.js';

function selectionAdapter(): SelectionMutationAdapter {
  return {
    execute: vi.fn(() => ({
      success: true as const,
      resolution: {
        target: { kind: 'text' as const, blockId: 'p1', range: { start: 0, end: 4 } },
        range: { from: 0, to: 4 },
        text: 'old',
      },
    })),
  };
}

function writeAdapter(): WriteAdapter {
  return { write: vi.fn(), insertStructured: vi.fn(), replaceStructured: vi.fn() } as unknown as WriteAdapter;
}

function execute(input: unknown): void {
  executeReplace(selectionAdapter(), writeAdapter(), input as ReplaceInput);
}

const selectionTarget = {
  kind: 'selection' as const,
  start: { kind: 'text' as const, blockId: 'p1', offset: 0 },
  end: { kind: 'text' as const, blockId: 'p1', offset: 4 },
};

const blockTarget = { kind: 'block' as const, nodeType: 'paragraph' as const, nodeId: 'p1' };
const fragment = [{ kind: 'paragraph' as const, paragraph: { inlines: [] } }];

describe('executeReplace input union', () => {
  it('requires exactly one content discriminator', () => {
    expect(() => execute({ target: selectionTarget })).toThrow('exactly one');
    expect(() => execute({ target: selectionTarget, text: 'a', content: fragment })).toThrow('exactly one');
    expect(() => execute({ target: selectionTarget, text: 'a', value: 'b', type: 'html' })).toThrow('exactly one');
    expect(() => execute({ target: selectionTarget, content: fragment, value: 'b', type: 'html' })).toThrow(
      'exactly one',
    );
  });

  it('preserves the existing text and structural shapes', () => {
    const selection = selectionAdapter();
    const write = writeAdapter();

    executeReplace(selection, write, { target: selectionTarget, text: 'replacement' });
    executeReplace(selection, write, { target: blockTarget, content: fragment });

    expect(selection.execute).toHaveBeenCalledTimes(1);
    expect(write.replaceStructured).toHaveBeenCalledWith(
      { target: blockTarget, content: fragment },
      expect.objectContaining({ changeMode: 'direct', dryRun: false }),
    );
  });
});

describe('executeReplace rich content', () => {
  it('routes HTML and Markdown through the structured adapter with normalized options', () => {
    const selection = selectionAdapter();
    const write = writeAdapter();
    const htmlInput = { target: blockTarget, value: '<p>Replacement</p>', type: 'html' as const };
    const markdownInput = {
      ref: 'match-1',
      value: '**Replacement**',
      type: 'markdown' as const,
      nestingPolicy: { tables: 'forbid' as const },
    };

    executeReplace(selection, write, htmlInput, { changeMode: 'tracked', expectedRevision: 'r1' });
    executeReplace(selection, write, markdownInput, { dryRun: true });

    expect(write.replaceStructured).toHaveBeenNthCalledWith(
      1,
      htmlInput,
      expect.objectContaining({ changeMode: 'tracked', dryRun: false, expectedRevision: 'r1' }),
    );
    expect(write.replaceStructured).toHaveBeenNthCalledWith(
      2,
      markdownInput,
      expect.objectContaining({ changeMode: 'direct', dryRun: true }),
    );
    expect(selection.execute).not.toHaveBeenCalled();
  });

  it('requires exactly one target or ref', () => {
    expect(() => execute({ value: '<p>x</p>', type: 'html' })).toThrow('exactly one of "target" or "ref"');
    expect(() => execute({ target: blockTarget, ref: 'r1', value: '<p>x</p>', type: 'html' })).toThrow(
      'exactly one of "target" or "ref"',
    );
  });

  it('accepts selection and block targets and rejects malformed locators', () => {
    const write = writeAdapter();
    expect(() =>
      executeReplace(selectionAdapter(), write, { target: selectionTarget, value: '# Title', type: 'markdown' }),
    ).not.toThrow();
    expect(() =>
      executeReplace(selectionAdapter(), write, { target: blockTarget, value: '# Title', type: 'markdown' }),
    ).not.toThrow();
    expect(() => execute({ target: { kind: 'node' }, value: '<p>x</p>', type: 'html' })).toThrow(
      'SelectionTarget or BlockNodeAddress',
    );
    expect(() => execute({ ref: '', value: '<p>x</p>', type: 'html' })).toThrow('non-empty string');
  });

  it('requires a rich format and rejects unknown or cross-variant fields', () => {
    expect(() => execute({ ref: 'r1', value: '<p>x</p>' })).toThrow('html, markdown');
    expect(() => execute({ ref: 'r1', value: '<p>x</p>', type: 'text' })).toThrow('html, markdown');
    expect(() => execute({ ref: 'r1', value: '<p>x</p>', type: 'html', placement: 'after' })).toThrow('placement');
    expect(() => execute({ target: selectionTarget, text: 'x', type: 'html' })).toThrow('type');
    expect(() => execute({ target: blockTarget, content: fragment, type: 'html' })).toThrow('type');
  });
});
