import { describe, expect, it } from 'vite-plus/test';
import {
  formatIntegerWithNumericPicture,
  formatPageNumber,
  formatPageNumberFieldValue,
} from './page-number-formatting.js';

describe('page number formatting', () => {
  it('formats the supported Word page number formats', () => {
    expect(formatPageNumber(5, 'decimal')).toBe('5');
    expect(formatPageNumber(5, 'upperRoman')).toBe('V');
    expect(formatPageNumber(5, 'lowerRoman')).toBe('v');
    expect(formatPageNumber(27, 'upperLetter')).toBe('AA');
    expect(formatPageNumber(28, 'upperLetter')).toBe('BB');
    expect(formatPageNumber(703, 'lowerLetter')).toBe('a'.repeat(28));
    expect(formatPageNumber(12, 'numberInDash')).toBe('- 12 -');
    expect(formatPageNumber(1, 'ordinal')).toBe('1st');
    expect(formatPageNumber(2, 'ordinal')).toBe('2nd');
    expect(formatPageNumber(3, 'ordinal')).toBe('3rd');
    expect(formatPageNumber(4, 'ordinal')).toBe('4th');
    expect(formatPageNumber(11, 'ordinal')).toBe('11th');
    expect(formatPageNumber(12, 'ordinal')).toBe('12th');
    expect(formatPageNumber(13, 'ordinal')).toBe('13th');
    expect(formatPageNumber(21, 'ordinal')).toBe('21st');
    expect(formatPageNumber(22, 'ordinal')).toBe('22nd');
    expect(formatPageNumber(23, 'ordinal')).toBe('23rd');
    expect(formatPageNumber(111, 'ordinal')).toBe('111th');
    expect(formatPageNumber(112, 'ordinal')).toBe('112th');
    expect(formatPageNumber(113, 'ordinal')).toBe('113th');
  });

  it('normalizes page numbers before formatting', () => {
    expect(formatPageNumber(4.9, 'decimal')).toBe('4');
    expect(formatPageNumber(0, 'upperLetter')).toBe('A');
    expect(formatPageNumber(Number.NaN, 'decimal')).toBe('1');
  });

  it('falls back to decimal for unsupported runtime formats', () => {
    expect(formatPageNumber(5, 'chicago' as never)).toBe('5');
  });

  it('falls back to decimal for roman numerals beyond 3999', () => {
    expect(formatPageNumber(4000, 'upperRoman')).toBe('4000');
  });

  // Pinned to Word 16, read from a PAGE field in a document whose sectPr
  // carries <w:pgNumType w:fmt="hebrew1"/> (and hebrew2). 15 and 16 are טו and
  // טז at every hundreds level so they do not spell the divine names יה and יו.
  it('formats hebrew1 page numbers as gematria', () => {
    expect(formatPageNumber(1, 'hebrew1')).toBe('א');
    expect(formatPageNumber(10, 'hebrew1')).toBe('י');
    expect(formatPageNumber(15, 'hebrew1')).toBe('טו');
    expect(formatPageNumber(16, 'hebrew1')).toBe('טז');
    expect(formatPageNumber(115, 'hebrew1')).toBe('קטו');
    expect(formatPageNumber(388, 'hebrew1')).toBe('שפח');
    expect(formatPageNumber(390, 'hebrew1')).toBe('שצ');
    expect(formatPageNumber(392, 'hebrew1')).toBe('שצב');
  });

  // hebrew2 counts the 22-letter alphabet and carries a leading U+200F that
  // hebrew1 does not.
  it('formats hebrew2 page numbers as alphabet counting', () => {
    expect(formatPageNumber(1, 'hebrew2')).toBe('\u200fא');
    expect(formatPageNumber(11, 'hebrew2')).toBe('\u200fכ');
    expect(formatPageNumber(22, 'hebrew2')).toBe('\u200fת');
    expect(formatPageNumber(23, 'hebrew2')).toBe('\u200fתא');
    expect(formatPageNumber(392, 'hebrew2')).toBe('\u200fתתתתתתתתתתתתתתתתתצ');
  });

  // Word stops representing Hebrew numerals above 392. On a PAGE field it
  // substitutes a localized error string rather than wrapping the way a list
  // marker does, and that string cannot be reproduced outside Word's own UI
  // language, so the page keeps a readable decimal instead.
  it('falls back to decimal for Hebrew page numbers beyond 392', () => {
    expect(formatPageNumber(393, 'hebrew1')).toBe('393');
    expect(formatPageNumber(393, 'hebrew2')).toBe('393');
    expect(formatPageNumber(1000, 'hebrew1')).toBe('1000');
  });

  it('normalizes non-positive page numbers before Hebrew formatting', () => {
    expect(formatPageNumber(0, 'hebrew1')).toBe('א');
    expect(formatPageNumber(Number.NaN, 'hebrew2')).toBe('\u200fא');
  });

  it('leaves Hebrew field values unpadded', () => {
    expect(formatPageNumberFieldValue(7, { format: 'hebrew1', zeroPadding: 3 })).toBe('ז');
  });

  it('applies decimal zero padding for field values', () => {
    expect(formatPageNumberFieldValue(7, { format: 'decimal', zeroPadding: 3 })).toBe('007');
    expect(formatPageNumberFieldValue(7, { format: 'lowerRoman', zeroPadding: 3 })).toBe('vii');
  });

  it('formats ordinal field values', () => {
    expect(formatPageNumberFieldValue(32, { format: 'ordinal' })).toBe('32nd');
  });

  it('uses numeric pictures before enum format and zero padding', () => {
    expect(formatPageNumberFieldValue(1234, { numericPicture: '#,##0' })).toBe('1,234');
    expect(formatPageNumberFieldValue(7, { format: 'ordinal', zeroPadding: 3, numericPicture: '00' })).toBe('07');
    expect(formatPageNumberFieldValue(0, { numericPicture: '00' })).toBe('01');
  });

  it('formats integer values with numeric pictures', () => {
    expect(formatIntegerWithNumericPicture(5, '00')).toBe('05');
    expect(formatIntegerWithNumericPicture(1234, '#,##0')).toBe('1,234');
    expect(formatIntegerWithNumericPicture(5, '##%')).toBe('5%');
    expect(formatIntegerWithNumericPicture(5, "00 'pages'")).toBe('05 pages');
    expect(formatIntegerWithNumericPicture(1234, 'x##')).toBe('34');
    expect(formatIntegerWithNumericPicture(5, '0.00')).toBe('5.00');
  });

  it('selects numeric picture sections for positive, negative, and zero values', () => {
    expect(formatIntegerWithNumericPicture(5, '0;minus 0;zero')).toBe('5');
    expect(formatIntegerWithNumericPicture(-5, '0;minus 0;zero')).toBe('minus 5');
    expect(formatIntegerWithNumericPicture(0, '0;minus 0;zero')).toBe('zero');
  });

  it('documents unsupported numeric picture features for PAGEREF page values', () => {
    // PAGEREF only formats integer page numbers here. Backtick numbered-item
    // references, localized separators, and fractional rounding are out of
    // scope for this numeric-picture subset.
    expect(formatIntegerWithNumericPicture(5, '`1`')).toBe('`1`');
    expect(formatIntegerWithNumericPicture(1234, '#.##0')).toBe('1234.0');
    expect(formatIntegerWithNumericPicture(5, '0.9')).toBe('5.9');
  });
});
