import { describe, expect, it } from 'vite-plus/test';
import type { FlowBlock, Measure, ParagraphMeasure, TextRun } from '@superdoc/contracts';
import { measureBlock } from './index.js';

const expectParagraphMeasure = (measure: Measure): ParagraphMeasure => {
  expect(measure.kind).toBe('paragraph');
  return measure as ParagraphMeasure;
};

const textRun = (text: string): TextRun => ({
  text,
  fontFamily: 'Arial',
  fontSize: 16,
});

const tokenBetween = async (narrowWidth: number, wideWidth: number): Promise<string> => {
  const unit = expectParagraphMeasure(
    await measureBlock(
      {
        kind: 'paragraph',
        id: 'continuation-token-unit',
        runs: [textRun('W')],
        attrs: {},
      },
      wideWidth * 2,
    ),
  ).lines[0].width;
  const token = 'W'.repeat(Math.floor(narrowWidth / unit) + 1);
  const measured = expectParagraphMeasure(
    await measureBlock(
      {
        kind: 'paragraph',
        id: 'continuation-token-probe',
        runs: [textRun(token)],
        attrs: {},
      },
      wideWidth * 2,
    ),
  ).lines[0].width;

  expect(measured).toBeGreaterThan(narrowWidth + 0.5);
  expect(measured).toBeLessThan(wideWidth - 0.5);
  return token;
};

const expectTokenFitsEveryLine = async (block: FlowBlock, token: string): Promise<void> => {
  const measure = expectParagraphMeasure(await measureBlock(block, 672));
  const tokenCharacters = measure.lines.reduce(
    (count, line) =>
      count +
      (line.segments ?? [])
        .filter((segment) => segment.runIndex === 2)
        .reduce((lineCount, segment) => lineCount + segment.toChar - segment.fromChar, 0),
    0,
  );

  expect(measure.lines.length).toBeGreaterThan(2);
  expect(measure.lines[0].maxWidth).toBe(672);
  for (const line of measure.lines.slice(1)) {
    expect(line.maxWidth).toBe(624);
  }
  for (const line of measure.lines) {
    expect(line.width).toBeLessThanOrEqual(line.maxWidth + 0.5);
  }
  expect(tokenCharacters).toBe(token.length);
};

describe('continuation-line long-word measurement', () => {
  it('chunks a default-tab token against the hanging-indent continuation width', async () => {
    const token = await tokenBetween(624, 672);
    await expectTokenFitsEveryLine(
      {
        kind: 'paragraph',
        id: 'default-tab-continuation-token',
        runs: [textRun('1.'), { kind: 'tab', text: '\t', tabIndex: 0, pmStart: 2, pmEnd: 3 }, textRun(token)],
        attrs: { indent: { left: 48, hanging: 48 } },
      },
      token,
    );
  });

  it('chunks an explicit-tab token against the hanging-indent continuation width', async () => {
    const token = await tokenBetween(624, 672);
    await expectTokenFitsEveryLine(
      {
        kind: 'paragraph',
        id: 'explicit-tab-continuation-token',
        runs: [textRun('1.'), { kind: 'tab', text: '\t', tabIndex: 0, pmStart: 2, pmEnd: 3 }, textRun(token)],
        attrs: {
          indent: { left: 48, hanging: 48 },
          tabs: [{ val: 'start', pos: 720 }],
        },
      },
      token,
    );
  });

  it('does not split the same token when the full paragraph width is available', async () => {
    const token = await tokenBetween(624, 672);
    const measure = expectParagraphMeasure(
      await measureBlock(
        {
          kind: 'paragraph',
          id: 'unindented-continuation-token-control',
          runs: [textRun(token)],
          attrs: {},
        },
        672,
      ),
    );

    expect(measure.lines).toHaveLength(1);
    expect(measure.lines[0].width).toBeLessThan(measure.lines[0].maxWidth);
  });

  for (const tabAlignment of ['start', 'center'] as const) {
    it(`keeps a word intact when it fits the line after a ${tabAlignment} tab`, async () => {
      const token = 'W'.repeat(10);
      const probe = expectParagraphMeasure(
        await measureBlock(
          {
            kind: 'paragraph',
            id: `${tabAlignment}-tab-word-probe`,
            runs: [textRun(token)],
            attrs: {},
          },
          600,
        ),
      );
      expect(probe.lines[0].width).toBeGreaterThan(60);
      expect(probe.lines[0].width).toBeLessThan(300);

      const measure = expectParagraphMeasure(
        await measureBlock(
          {
            kind: 'paragraph',
            id: `${tabAlignment}-tab-intact-word`,
            runs: [{ kind: 'tab', text: '\t', tabIndex: 0, pmStart: 0, pmEnd: 1 }, textRun(token)],
            attrs: { tabs: [{ val: tabAlignment, pos: 3600 }] },
          },
          300,
        ),
      );
      const tokenSegments = measure.lines.flatMap((line) =>
        (line.segments ?? []).filter((segment) => segment.runIndex === 1),
      );

      expect(tokenSegments).toHaveLength(1);
      expect(tokenSegments[0]).toMatchObject({ fromChar: 0, toChar: token.length });
    });
  }
});
