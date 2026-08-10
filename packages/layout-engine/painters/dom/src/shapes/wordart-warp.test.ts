import { SHAPE_TEXT_WARP_PRESETS } from '@superdoc/contracts';
import { describe, expect, it } from 'vite-plus/test';

import {
  pointAtWarpParameter,
  resolveWordArtAdjacentBandBaseline,
  resolveWordArtWarpGeometry,
  resolveWordArtWarpPath,
} from './wordart-warp.js';

describe('resolveWordArtWarpPath', () => {
  it('measures warp percentages by distance along the flattened path', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 90 },
    ];

    // Half of the 100px travelled distance is 40px into the long segment.
    // Equal sample-index interpolation would incorrectly return (10, 0).
    expect(pointAtWarpParameter(path, 0.5)).toEqual({ x: 10, y: 40 });
  });

  it('has a deterministic readable strategy for every ST_TextShapeType value', () => {
    for (const preset of SHAPE_TEXT_WARP_PRESETS) {
      const path = resolveWordArtWarpPath({ preset }, 240, 80);
      if (preset === 'textNoShape') {
        expect(path, preset).toBeNull();
      } else {
        expect(path?.d, preset).toMatch(/^M /);
      }
    }
  });

  it('uses valid val guides to adjust warp amplitude and ignores unsafe formulas', () => {
    const defaultPath = resolveWordArtWarpPath({ preset: 'textWave2' }, 200, 100);
    const adjusted = resolveWordArtWarpPath(
      { preset: 'textWave2', adjustments: [{ name: 'adj1', formula: 'val 10000' }] },
      200,
      100,
    );
    const unsafe = resolveWordArtWarpPath(
      { preset: 'textWave2', adjustments: [{ name: 'adj1', formula: '*/ 1 2 3' }] },
      200,
      100,
    );

    expect(adjusted?.d).not.toBe(defaultPath?.d);
    expect(unsafe?.d).toBe(defaultPath?.d);
  });

  it('classifies the ECMA path lists as baselines or two-boundary envelopes', () => {
    expect(resolveWordArtWarpPath({ preset: 'textPlain' }, 200, 80)?.fidelity).toBe('envelope');
    expect(resolveWordArtWarpPath({ preset: 'textStop' }, 200, 80)?.fidelity).toBe('envelope');
    expect(resolveWordArtWarpPath({ preset: 'textInflate' }, 200, 80)?.fidelity).toBe('envelope');
    expect(resolveWordArtWarpPath({ preset: 'textArchUp' }, 200, 80)?.fidelity).toBe('baseline');
  });

  it('resolves the default textPlain preset as the normative rectangular envelope', () => {
    expect(resolveWordArtWarpGeometry({ preset: 'textPlain' }, 240, 80)).toEqual({
      kind: 'envelope',
      paths: [
        [
          { x: 0, y: 0 },
          { x: 240, y: 0 },
        ],
        [
          { x: 0, y: 80 },
          { x: 240, y: 80 },
        ],
      ],
    });
  });

  it('evaluates the normative textStop guide formulas and boundary vertices', () => {
    const geometry = resolveWordArtWarpGeometry({ preset: 'textStop' }, 240, 80);
    expect(geometry?.kind).toBe('envelope');
    expect(geometry?.paths[0]).toEqual([
      { x: 0, y: 20 },
      { x: 80, y: 0 },
      { x: 160, y: 0 },
      { x: 240, y: 20 },
    ]);
    expect(geometry?.paths[1]).toEqual([
      { x: 0, y: 60 },
      { x: 80, y: 80 },
      { x: 160, y: 80 },
      { x: 240, y: 60 },
    ]);
  });

  it('evaluates presets locally before applying the text-inset translation', () => {
    const local = resolveWordArtWarpGeometry({ preset: 'textStop' }, 240, 80, 0);
    const translated = resolveWordArtWarpGeometry({ preset: 'textStop' }, 240, 80, 17);

    expect(translated?.paths).toEqual(
      local?.paths.map((path) => path.map((point) => ({ x: point.x, y: point.y + 17 }))),
    );
  });

  it('resolves successive textButton bands from adjacent authored boundaries', () => {
    const geometry = resolveWordArtWarpGeometry({ preset: 'textButton' }, 200, 80);
    expect(geometry?.paths).toHaveLength(3);

    const upper = geometry && resolveWordArtAdjacentBandBaseline(geometry, 0);
    const lower = geometry && resolveWordArtAdjacentBandBaseline(geometry, 1);

    expect(upper?.geometry.kind).toBe('baseline');
    expect(upper?.geometry.paths).toHaveLength(1);
    expect(upper?.geometry.paths[0]).toHaveLength(33);
    expect(upper?.geometry.paths[0][0]).toEqual({ x: 0, y: 40 });
    expect(upper?.geometry.paths[0][32].x).toBeCloseTo(200, 5);
    expect(upper?.geometry.paths[0][32].y).toBeCloseTo(40, 5);
    expect(upper?.geometry.paths[0][16].y).toBeCloseTo(20, 5);
    expect(lower?.geometry.paths[0][16].y).toBeCloseTo(60, 5);
    expect(upper?.path.fidelity).toBe('baseline');
    expect(lower?.path.fidelity).toBe('baseline');
  });
});
