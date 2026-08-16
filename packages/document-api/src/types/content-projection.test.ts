import { describe, expect, it } from 'bun:test';
import {
  deriveSDHtmlMarkdownOutcome,
  deriveSDProjectionStatus,
  validateSDProjectionSourceMap,
  type SDProjectionDiagnostic,
  type SDProjectionSourceMap,
} from './content-projection.js';

const story = { kind: 'story', storyType: 'body' } as const;

function diagnostic(severity: 'error' | 'warning' | 'info', lossy: boolean): SDProjectionDiagnostic {
  return {
    code: severity === 'error' ? 'projection-malformed-source' : 'projection-downgraded-construct',
    severity,
    message: 'fixture',
    construct: 'paragraph',
    disposition: severity === 'error' ? 'rejected' : 'downgraded',
    lossy,
    source: { story },
  };
}

describe('outbound projection contract', () => {
  it('derives the common HTML/Markdown outcome without hiding warnings or loss', () => {
    expect(deriveSDHtmlMarkdownOutcome([])).toBe('preserved');
    expect(deriveSDHtmlMarkdownOutcome([diagnostic('info', false)])).toBe('preserved-with-warnings');
    expect(deriveSDHtmlMarkdownOutcome([diagnostic('warning', true)])).toBe('simplified');
    expect(deriveSDHtmlMarkdownOutcome([diagnostic('error', false)])).toBe('rejected');
  });

  it('derives status from errors and lossy diagnostics', () => {
    expect(deriveSDProjectionStatus([])).toBe('success');
    expect(deriveSDProjectionStatus([diagnostic('info', false)])).toBe('success');
    expect(deriveSDProjectionStatus([diagnostic('warning', true)])).toBe('warning');
    expect(deriveSDProjectionStatus([diagnostic('error', false)])).toBe('failed');
  });

  it('accepts sorted tracked maps and rejects overlap, bounds, and fabricated coordinate space', () => {
    const map: SDProjectionSourceMap = {
      version: 'sd-projection-source-map/1',
      outputCoordinateSpace: 'utf16',
      sourceCoordinateSpace: 'tracked',
      entries: [
        {
          kind: 'text',
          output: { start: 0, end: 5 },
          source: {
            kind: 'text',
            coordinateSpace: 'tracked',
            segments: [{ blockId: 'p1', range: { start: 0, end: 1 } }],
          },
          blockId: 'p1',
        },
        { kind: 'synthetic', output: { start: 5, end: 7 }, role: 'listLabel', identity: 'public', blockId: 'p1' },
      ],
    };
    expect(validateSDProjectionSourceMap(map, 7)).toBe(true);
    expect(
      validateSDProjectionSourceMap({ ...map, entries: [{ ...map.entries[1]!, output: { start: 4, end: 7 } }] }, 7),
    ).toBe(true);
    expect(
      validateSDProjectionSourceMap({ ...map, entries: [{ ...map.entries[0]!, output: { start: 0, end: 8 } }] }, 7),
    ).toBe(false);
    const overlapping = { ...map, entries: [map.entries[0]!, { ...map.entries[1]!, output: { start: 4, end: 7 } }] };
    expect(validateSDProjectionSourceMap(overlapping, 7)).toBe(false);
    const rawId = {
      ...map,
      entries: [{ ...map.entries[0]!, blockId: 'tbl:p@42' }],
    } as SDProjectionSourceMap;
    expect(validateSDProjectionSourceMap(rawId, 7)).toBe(false);
    const negativeSource = structuredClone(map);
    if (negativeSource.entries[0]?.kind === 'text') negativeSource.entries[0].source.segments[0]!.range.start = -1;
    expect(validateSDProjectionSourceMap(negativeSource, 7)).toBe(false);
    const crossBlockSource = structuredClone(map);
    if (crossBlockSource.entries[0]?.kind === 'text') crossBlockSource.entries[0].source.segments[0]!.blockId = 'p2';
    expect(validateSDProjectionSourceMap(crossBlockSource, 7)).toBe(false);
    const fabricatedSyntheticSource = {
      ...map,
      entries: [{ ...map.entries[1]!, source: map.entries[0]!.kind === 'text' ? map.entries[0]!.source : undefined }],
    } as SDProjectionSourceMap;
    expect(validateSDProjectionSourceMap(fabricatedSyntheticSource, 7)).toBe(false);
  });
});
