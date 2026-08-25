import { describe, expect, it } from 'vite-plus/test';
import { CORE_SYMBOL_FALLBACK_COVERAGE, textForCoreSymbolFallback } from './core-symbol-fallback';

describe('core symbol fallback coverage', () => {
  it('matches provider-backed symbols rather than a checkbox-specific allowlist', () => {
    expect(textForCoreSymbolFallback('plain text 0')).toBe('');
    expect(textForCoreSymbolFallback('flight \u2708 ballot \u2610\u2611\u2612')).toBe('\u2708\u2610\u2611\u2612');
    expect(textForCoreSymbolFallback('Latin Ж →')).toBe('');
  });

  it('deduplicates supplementary-plane characters by code point', () => {
    expect(textForCoreSymbolFallback('\u{1F5F9}\u{1F5F9}')).toBe('\u{1F5F9}');
  });

  it('does not claim ASCII digits', () => {
    const coversCodePoint = (codePoint: number) =>
      CORE_SYMBOL_FALLBACK_COVERAGE.ranges.some((r) => r.start <= codePoint && codePoint <= r.end);
    for (const digit of '0123456789') {
      expect(coversCodePoint(digit.codePointAt(0)!)).toBe(false);
    }
  });
});
