import { describe, expect, it } from 'vite-plus/test';
import { parseUnicodeCoverage, unicodeCoverageIncludes } from './unicode-coverage';

type CmapSubtable = { platform: number; encoding: number; bytes: Uint8Array };

function format4(ranges: Array<{ start: number; end: number }>): Uint8Array {
  const segments = [...ranges, { start: 0xffff, end: 0xffff }];
  const segCount = segments.length;
  const length = 16 + segCount * 8;
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 4);
  view.setUint16(2, length);
  view.setUint16(6, segCount * 2);
  const maxPower = 2 ** Math.floor(Math.log2(segCount));
  view.setUint16(8, maxPower * 2);
  view.setUint16(10, Math.log2(maxPower));
  view.setUint16(12, segCount * 2 - maxPower * 2);
  const endCodes = 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const deltas = startCodes + segCount * 2;
  const rangeOffsets = deltas + segCount * 2;
  for (let i = 0; i < segCount; i += 1) {
    view.setUint16(endCodes + i * 2, segments[i].end);
    view.setUint16(startCodes + i * 2, segments[i].start);
    view.setInt16(deltas + i * 2, 1);
    view.setUint16(rangeOffsets + i * 2, 0);
  }
  return bytes;
}

function format12(ranges: Array<{ start: number; end: number }>): Uint8Array {
  const bytes = new Uint8Array(16 + ranges.length * 12);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 12);
  view.setUint32(4, bytes.length);
  view.setUint32(12, ranges.length);
  ranges.forEach((range, index) => {
    const offset = 16 + index * 12;
    view.setUint32(offset, range.start);
    view.setUint32(offset + 4, range.end);
    view.setUint32(offset + 8, 1);
  });
  return bytes;
}

function makeFont(subtables: CmapSubtable[]): ArrayBuffer {
  const sfntHeaderLength = 12;
  const tableRecordLength = 16;
  const cmapOffset = sfntHeaderLength + tableRecordLength;
  const cmapHeaderLength = 4 + subtables.length * 8;
  const cmapLength = cmapHeaderLength + subtables.reduce((sum, subtable) => sum + subtable.bytes.length, 0);
  const buffer = new ArrayBuffer(cmapOffset + cmapLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 1);
  for (const [index, char] of [...'cmap'].entries()) view.setUint8(12 + index, char.charCodeAt(0));
  view.setUint32(20, cmapOffset);
  view.setUint32(24, cmapLength);
  view.setUint16(cmapOffset + 2, subtables.length);
  let subtableOffset = cmapHeaderLength;
  subtables.forEach((subtable, index) => {
    const record = cmapOffset + 4 + index * 8;
    view.setUint16(record, subtable.platform);
    view.setUint16(record + 2, subtable.encoding);
    view.setUint32(record + 4, subtableOffset);
    new Uint8Array(buffer, cmapOffset + subtableOffset, subtable.bytes.length).set(subtable.bytes);
    subtableOffset += subtable.bytes.length;
  });
  return buffer;
}

describe('parseUnicodeCoverage', () => {
  it('combines BMP format 4 and supplementary format 12 coverage into canonical CSS ranges', () => {
    const font = makeFont([
      {
        platform: 3,
        encoding: 1,
        bytes: format4([
          { start: 0x41, end: 0x43 },
          { start: 0x2610, end: 0x2612 },
        ]),
      },
      { platform: 3, encoding: 10, bytes: format12([{ start: 0x1f5f9, end: 0x1f5f9 }]) },
    ]);

    const coverage = parseUnicodeCoverage(font);

    expect(coverage?.cssUnicodeRange).toBe('U+41-43, U+2610-2612, U+1F5F9');
    expect(unicodeCoverageIncludes(coverage, 0x41)).toBe(true);
    expect(unicodeCoverageIncludes(coverage, 0x2611)).toBe(true);
    expect(unicodeCoverageIncludes(coverage, 0x1f5f9)).toBe(true);
    expect(unicodeCoverageIncludes(coverage, 0x44)).toBe(false);
  });

  it('ignores non-Unicode cmap records and returns null when no supported Unicode table is usable', () => {
    const legacyOnly = makeFont([{ platform: 1, encoding: 0, bytes: format4([{ start: 0x41, end: 0x41 }]) }]);
    expect(parseUnicodeCoverage(legacyOnly)).toBeNull();
    expect(parseUnicodeCoverage(new ArrayBuffer(8))).toBeNull();
  });

  it('does not retain partial ranges from a malformed subtable', () => {
    const malformed = format4([
      { start: 0x41, end: 0x41 },
      { start: 0x42, end: 0x42 },
    ]);
    new DataView(malformed.buffer).setUint16(36, 0xffff);
    const coverage = parseUnicodeCoverage(
      makeFont([
        { platform: 3, encoding: 1, bytes: malformed },
        { platform: 3, encoding: 10, bytes: format12([{ start: 0x1f5f9, end: 0x1f5f9 }]) },
      ]),
    );
    expect(coverage?.cssUnicodeRange).toBe('U+1F5F9');
  });

  it('honors typed-array byte offsets', () => {
    const font = makeFont([{ platform: 0, encoding: 4, bytes: format12([{ start: 0x1f5f9, end: 0x1f5f9 }]) }]);
    const padded = new Uint8Array(font.byteLength + 32);
    padded.set(new Uint8Array(font), 16);
    const coverage = parseUnicodeCoverage(padded.subarray(16, 16 + font.byteLength));
    expect(coverage?.cssUnicodeRange).toBe('U+1F5F9');
  });
});
