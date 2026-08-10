import { describe, expect, it } from 'vite-plus/test';

import { createGradient } from './svg-utils.js';

describe('createGradient', () => {
  it('maps DrawingML clockwise gradient angles into SVG page coordinates', () => {
    const horizontal = createGradient(
      {
        type: 'gradient',
        gradientType: 'linear',
        angle: 0,
        stops: [
          { position: 0, color: '#000000' },
          { position: 1, color: '#FFFFFF' },
        ],
      },
      'horizontal',
    );
    const vertical = createGradient(
      {
        type: 'gradient',
        gradientType: 'linear',
        angle: 90,
        stops: [
          { position: 0, color: '#000000' },
          { position: 1, color: '#FFFFFF' },
        ],
      },
      'vertical',
    );

    expect(horizontal?.getAttribute('x1')).toBe('0%');
    expect(horizontal?.getAttribute('x2')).toBe('100%');
    expect(vertical?.getAttribute('y1')).toBe('0%');
    expect(vertical?.getAttribute('y2')).toBe('100%');
  });
});
