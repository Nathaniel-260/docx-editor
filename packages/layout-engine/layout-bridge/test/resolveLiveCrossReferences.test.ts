import { describe, expect, it } from 'vitest';
import type { FlowBlock, Layout, ParagraphBlock, TextRun } from '@superdoc/contracts';
import { buildPageStyleReferenceResolver, resolveLiveCrossReferences } from '../src/resolveLiveCrossReferences';

const textRun = (text: string, extra: Partial<TextRun> = {}): TextRun => ({
  kind: 'text',
  text,
  fontFamily: 'Arial',
  fontSize: 16,
  ...extra,
});

const paragraph = (id: string, runs: TextRun[], styleId?: string): ParagraphBlock => ({
  kind: 'paragraph',
  id,
  runs,
  ...(styleId ? { attrs: { styleId } } : {}),
});

describe('resolveLiveCrossReferences', () => {
  it('re-evaluates REF content from current bookmark text and reports a deleted target truthfully', () => {
    const metadata = {
      kind: 'ref' as const,
      instruction: 'REF Target \\h',
      target: 'Target',
    };
    const field = paragraph('field', [textRun('stale', { crossReferenceMetadata: metadata })]);
    const target = paragraph('target', [
      textRun('', {
        dataAttrs: {
          'data-bookmark-marker': 'start',
          'data-bookmark-id': '7',
          'data-bookmark-name': 'Target',
        },
      }),
      textRun('Current target'),
      textRun('', {
        dataAttrs: {
          'data-bookmark-marker': 'end',
          'data-bookmark-id': '7',
        },
      }),
    ]);

    resolveLiveCrossReferences([field, target]);
    expect(field.runs[0]?.text).toBe('Current target');

    resolveLiveCrossReferences([field]);
    expect(field.runs[0]?.text).toBe('Error! Reference source not found.');
  });

  it('projects the full contextual paragraph number for a REF \\w field', () => {
    const outer = paragraph('outer', [textRun('Definitions')]);
    outer.attrs = {
      numberingProperties: { numId: 10, ilvl: 0 },
      wordLayout: {
        marker: {
          markerText: '2.',
          run: { fontFamily: 'Arial', fontSize: 16 },
        },
      },
    };
    const section = paragraph('section', [textRun('Descendants')]);
    section.attrs = {
      numberingProperties: { numId: 10, ilvl: 1 },
      wordLayout: {
        marker: {
          markerText: '(s)',
          run: { fontFamily: 'Arial', fontSize: 16 },
        },
      },
    };
    const field = paragraph('field', [
      textRun('', {
        crossReferenceMetadata: {
          kind: 'ref',
          instruction: 'REF Target \\w \\h',
          target: 'Target',
        },
      }),
    ]);
    field.attrs = {
      numberingProperties: { numId: 10, ilvl: 2 },
      wordLayout: {
        marker: {
          markerText: '(3)',
          run: { fontFamily: 'Arial', fontSize: 16 },
        },
      },
    };
    const target = paragraph('target', [
      textRun('', {
        dataAttrs: {
          'data-bookmark-marker': 'start',
          'data-bookmark-id': '7',
          'data-bookmark-name': 'Target',
        },
      }),
      textRun('', {
        dataAttrs: {
          'data-bookmark-marker': 'end',
          'data-bookmark-id': '7',
        },
      }),
      textRun('Target paragraph'),
    ]);
    target.attrs = {
      wordLayout: {
        marker: {
          markerText: '(4)',
          run: { fontFamily: 'Arial', fontSize: 16 },
        },
      },
      numberingProperties: { numId: 10, ilvl: 2 },
    };

    resolveLiveCrossReferences([outer, section, field, target]);

    expect(field.runs[0]?.text).toBe('2.(s)(4)');
  });

  it('re-evaluates NOTEREF from a Word bookmark around the current note-reference marker', () => {
    const field = paragraph('field', [
      textRun('3', {
        crossReferenceMetadata: {
          kind: 'noteRef',
          instruction: 'NOTEREF NoteTarget \\h',
          target: 'NoteTarget',
        },
      }),
    ]);
    const markerOwner = paragraph('marker-owner', [
      textRun('', {
        dataAttrs: {
          'data-bookmark-marker': 'start',
          'data-bookmark-id': '12',
          'data-bookmark-name': 'NoteTarget',
        },
      }),
      textRun('4', { dataAttrs: { 'data-v2-note-ref': 'footnote:note-7' } }),
      textRun('', {
        dataAttrs: {
          'data-bookmark-marker': 'end',
          'data-bookmark-id': '12',
        },
      }),
    ]);

    resolveLiveCrossReferences([field, markerOwner]);
    expect(field.runs[0]?.text).toBe('4');
  });

  it('does not resolve NOTEREF when the body note-reference marker is not bookmarked', () => {
    const field = paragraph('field', [
      textRun('3', {
        crossReferenceMetadata: {
          kind: 'noteRef',
          instruction: 'NOTEREF NoteTarget \\h',
          target: 'NoteTarget',
        },
      }),
    ]);
    const markerOwner = paragraph('marker-owner', [
      textRun('4', { dataAttrs: { 'data-v2-note-ref': 'footnote:note-7' } }),
    ]);
    resolveLiveCrossReferences([field, markerOwner]);
    expect(field.runs[0]?.text).toBe('Error! Reference source not found.');
  });

  it('re-evaluates body STYLEREF using the nearest matching paragraph in the requested direction', () => {
    const before = paragraph('before', [textRun('Earlier heading')], 'Heading1');
    const defaultField = paragraph('default-field', [
      textRun('stale', {
        crossReferenceMetadata: {
          kind: 'styleRef',
          instruction: 'STYLEREF "Heading 1"',
          target: 'Heading 1',
        },
      }),
    ]);
    const lowerField = paragraph('lower-field', [
      textRun('stale', {
        crossReferenceMetadata: {
          kind: 'styleRef',
          instruction: 'STYLEREF "Heading 1" \\l',
          target: 'Heading 1',
          preferFollowing: true,
        },
      }),
    ]);
    const after = paragraph('after', [textRun('Later heading')], 'Heading1');
    const blocks: FlowBlock[] = [before, defaultField, lowerField, after];

    resolveLiveCrossReferences(blocks);

    expect(defaultField.runs[0]?.text).toBe('Earlier heading');
    expect(lowerField.runs[0]?.text).toBe('Later heading');
  });

  it('preserves cached multi-paragraph REF results until paragraph-structure projection is available', () => {
    const metadata = {
      kind: 'ref' as const,
      instruction: 'REF MultiParagraph',
      target: 'MultiParagraph',
    };
    const first = paragraph('field-1', [textRun('First cached', { crossReferenceMetadata: metadata })]);
    const second = paragraph('field-2', [textRun('Second cached', { crossReferenceMetadata: metadata })]);
    const target = paragraph('target', [
      textRun('', {
        dataAttrs: {
          'data-bookmark-marker': 'start',
          'data-bookmark-id': '9',
          'data-bookmark-name': 'MultiParagraph',
        },
      }),
      textRun('Current target'),
      textRun('', { dataAttrs: { 'data-bookmark-marker': 'end', 'data-bookmark-id': '9' } }),
    ]);

    resolveLiveCrossReferences([first, second, target]);

    expect(first.runs[0]?.text).toBe('First cached');
    expect(second.runs[0]?.text).toBe('Second cached');
  });
});

describe('buildPageStyleReferenceResolver', () => {
  it('selects the first or last matching styled paragraph on each physical page', () => {
    const blocks: FlowBlock[] = [
      paragraph('heading-1', [textRun('Page one')], 'Heading1'),
      paragraph('body', [textRun('Body')]),
      paragraph('heading-2a', [textRun('Page two first')], 'Heading1'),
      paragraph('heading-2b', [textRun('Page two last')], 'Heading1'),
    ];
    const layout = {
      pages: [
        {
          fragments: [
            { kind: 'para', blockId: 'heading-1' },
            { kind: 'para', blockId: 'body' },
          ],
        },
        {
          fragments: [
            { kind: 'para', blockId: 'heading-2a' },
            { kind: 'para', blockId: 'heading-2b' },
          ],
        },
      ],
    } as Layout;
    const resolve = buildPageStyleReferenceResolver(blocks, layout);

    expect(resolve({ pageNumber: 2, styleName: 'Heading 1', preferFollowing: false })).toBe('Page two first');
    expect(resolve({ pageNumber: 2, styleName: 'Heading 1', preferFollowing: true })).toBe('Page two last');
  });
});
