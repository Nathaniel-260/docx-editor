import type { ShapeTextWarp } from '@superdoc/contracts';
import {
  PRESET_TEXT_WARP_DEFINITIONS,
  type PresetTextWarpCommand,
  type PresetTextWarpDefinition,
} from './preset-text-warp-data.js';

export type WordArtWarpPoint = { x: number; y: number };

export type WordArtWarpGeometry = {
  paths: WordArtWarpPoint[][];
  /** One boundary bends a baseline; two or more boundaries define a glyph envelope. */
  kind: 'baseline' | 'envelope';
};

export type WordArtWarpPath = {
  d: string;
  fidelity: 'baseline' | 'envelope';
  /** Polyline length of the evaluated preset path in layout coordinates. */
  length: number;
};

export type WordArtBaselineBand = {
  geometry: WordArtWarpGeometry;
  path: WordArtWarpPath;
};

const ANGLE_UNIT = 60_000;
const FULL_CIRCLE = 360 * ANGLE_UNIT;
const CURVE_STEPS = 32;

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);
const angleRadians = (value: number): number => (value / ANGLE_UNIT) * (Math.PI / 180);

function builtInGuides(width: number, height: number): Record<string, number> {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  return {
    l: 0,
    t: 0,
    r: width,
    b: height,
    w: width,
    h: height,
    hc: width / 2,
    vc: height / 2,
    wd2: width / 2,
    wd3: width / 3,
    wd4: width / 4,
    wd5: width / 5,
    wd6: width / 6,
    wd8: width / 8,
    wd10: width / 10,
    hd2: height / 2,
    hd3: height / 3,
    hd4: height / 4,
    hd5: height / 5,
    hd6: height / 6,
    hd8: height / 8,
    ss: shortSide,
    ls: longSide,
    ssd2: shortSide / 2,
    ssd4: shortSide / 4,
    ssd6: shortSide / 6,
    ssd8: shortSide / 8,
    cd2: FULL_CIRCLE / 2,
    cd4: FULL_CIRCLE / 4,
    cd8: FULL_CIRCLE / 8,
    '3cd4': (FULL_CIRCLE * 3) / 4,
    '3cd8': (FULL_CIRCLE * 3) / 8,
    '5cd8': (FULL_CIRCLE * 5) / 8,
    '7cd8': (FULL_CIRCLE * 7) / 8,
  };
}

function resolveToken(token: string, guides: Record<string, number>): number {
  if (Object.prototype.hasOwnProperty.call(guides, token)) return guides[token];
  return finite(Number(token));
}

function evaluateFormula(formula: string, guides: Record<string, number>): number {
  const [operator, ...tokens] = formula.trim().split(/\s+/);
  const value = (index: number): number => resolveToken(tokens[index] ?? '0', guides);
  switch (operator) {
    case 'val':
      return value(0);
    case '*/':
      return finite((value(0) * value(1)) / value(2));
    case '+-':
      return finite(value(0) + value(1) - value(2));
    case '+/':
      return finite((value(0) + value(1)) / value(2));
    case '?:':
      return value(0) > 0 ? value(1) : value(2);
    case 'abs':
      return Math.abs(value(0));
    case 'at2':
      return finite((Math.atan2(value(1), value(0)) * 180 * ANGLE_UNIT) / Math.PI);
    case 'cat2': {
      const angle = Math.atan2(value(2), value(1));
      return finite(value(0) * Math.cos(angle));
    }
    case 'cos':
      return finite(value(0) * Math.cos(angleRadians(value(1))));
    case 'max':
      return Math.max(value(0), value(1));
    case 'min':
      return Math.min(value(0), value(1));
    case 'mod':
      return Math.hypot(value(0), value(1), value(2));
    case 'pin':
      return Math.max(value(0), Math.min(value(2), value(1)));
    case 'sat2': {
      const angle = Math.atan2(value(2), value(1));
      return finite(value(0) * Math.sin(angle));
    }
    case 'sin':
      return finite(value(0) * Math.sin(angleRadians(value(1))));
    case 'sqrt':
      return Math.sqrt(Math.max(0, value(0)));
    case 'tan':
      return finite(value(0) * Math.tan(angleRadians(value(1))));
    default:
      return 0;
  }
}

function resolveGuides(
  definition: PresetTextWarpDefinition,
  warp: ShapeTextWarp,
  width: number,
  height: number,
): Record<string, number> {
  const guides = builtInGuides(width, height);
  const authored = new Map(warp.adjustments?.map((entry) => [entry.name, entry.formula]) ?? []);
  for (const adjustment of definition.adjustments) {
    const authoredFormula = authored.get(adjustment.name);
    const safeFormula =
      authoredFormula && /^val\s+-?\d+(?:\.\d+)?$/.test(authoredFormula) ? authoredFormula : adjustment.fmla;
    guides[adjustment.name] = evaluateFormula(safeFormula, guides);
  }
  for (const guide of definition.guides) guides[guide.name] = evaluateFormula(guide.fmla, guides);
  return guides;
}

function evaluatePoint(point: { x: string; y: string }, guides: Record<string, number>): WordArtWarpPoint {
  return { x: resolveToken(point.x, guides), y: resolveToken(point.y, guides) };
}

function interpolateQuadratic(
  start: WordArtWarpPoint,
  control: WordArtWarpPoint,
  end: WordArtWarpPoint,
  progress: number,
): WordArtWarpPoint {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  };
}

function interpolateCubic(
  start: WordArtWarpPoint,
  first: WordArtWarpPoint,
  second: WordArtWarpPoint,
  end: WordArtWarpPoint,
  progress: number,
): WordArtWarpPoint {
  const inverse = 1 - progress;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse * inverse * progress * first.x +
      3 * inverse * progress * progress * second.x +
      progress ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse * inverse * progress * first.y +
      3 * inverse * progress * progress * second.y +
      progress ** 3 * end.y,
  };
}

function appendCurve(
  points: WordArtWarpPoint[],
  sample: (progress: number) => WordArtWarpPoint,
  steps = CURVE_STEPS,
): void {
  for (let step = 1; step <= steps; step += 1) points.push(sample(step / steps));
}

function evaluatePath(commands: PresetTextWarpCommand[], guides: Record<string, number>): WordArtWarpPoint[] {
  const points: WordArtWarpPoint[] = [];
  let current: WordArtWarpPoint = { x: 0, y: 0 };
  for (const command of commands) {
    if (command.kind === 'moveTo') {
      current = evaluatePoint(command.points[0], guides);
      points.push(current);
      continue;
    }
    if (command.kind === 'lnTo') {
      current = evaluatePoint(command.points[0], guides);
      points.push(current);
      continue;
    }
    if (command.kind === 'quadBezTo') {
      const control = evaluatePoint(command.points[0], guides);
      const end = evaluatePoint(command.points[1], guides);
      const start = current;
      appendCurve(points, (progress) => interpolateQuadratic(start, control, end, progress));
      current = end;
      continue;
    }
    if (command.kind === 'cubicBezTo') {
      const first = evaluatePoint(command.points[0], guides);
      const second = evaluatePoint(command.points[1], guides);
      const end = evaluatePoint(command.points[2], guides);
      const start = current;
      appendCurve(points, (progress) => interpolateCubic(start, first, second, end, progress));
      current = end;
      continue;
    }

    if (command.kind !== 'arc') continue;

    const radiusX = Math.abs(resolveToken(command.wR, guides));
    const radiusY = Math.abs(resolveToken(command.hR, guides));
    const startAngle = resolveToken(command.stAng, guides);
    const sweepAngle = resolveToken(command.swAng, guides);
    const startRadians = angleRadians(startAngle);
    const center = {
      x: current.x - radiusX * Math.cos(startRadians),
      y: current.y - radiusY * Math.sin(startRadians),
    };
    const steps = Math.max(8, Math.ceil((Math.abs(sweepAngle) / FULL_CIRCLE) * CURVE_STEPS * 2));
    appendCurve(
      points,
      (progress) => {
        const radians = angleRadians(startAngle + sweepAngle * progress);
        return {
          x: center.x + radiusX * Math.cos(radians),
          y: center.y + radiusY * Math.sin(radians),
        };
      },
      steps,
    );
    current = points[points.length - 1];
  }
  return points;
}

export function resolveWordArtWarpGeometry(
  warp: ShapeTextWarp,
  width: number,
  height: number,
  top = 0,
): WordArtWarpGeometry | null {
  // textNoShape explicitly preserves the ordinary text bounding box. In
  // contrast, textPlain is a real two-boundary preset: its default guides form
  // a rectangle and its adjustment values form a quadrilateral envelope.
  if (warp.preset === 'textNoShape') return null;
  const definition = PRESET_TEXT_WARP_DEFINITIONS[warp.preset];
  if (!definition) return null;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const guides = resolveGuides(definition, warp, safeWidth, safeHeight);
  const paths = definition.paths
    .map((path) => evaluatePath(path, guides).map((point) => ({ x: point.x, y: point.y + top })))
    .filter((path) => path.length > 1);
  if (paths.length === 0) return null;
  return { paths, kind: paths.length === 1 ? 'baseline' : 'envelope' };
}

function pathData(points: WordArtWarpPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function pathLength(points: readonly WordArtWarpPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length;
}

/**
 * Resolve the centerline between two adjacent authored warp boundaries.
 *
 * A small family of DrawingML presets uses shared boundaries to compose
 * successive text bands (for example textButton's upper/center/lower paths).
 * Word lays each line on the corresponding band centerline and preserves the
 * glyph outlines instead of stretching the ink through the whole envelope.
 */
export function resolveWordArtAdjacentBandBaseline(
  geometry: WordArtWarpGeometry,
  bandIndex: number,
): WordArtBaselineBand | null {
  if (geometry.paths.length < 2) return null;
  const upperIndex = Math.max(0, Math.min(geometry.paths.length - 2, bandIndex));
  const upper = geometry.paths[upperIndex];
  const lower = geometry.paths[upperIndex + 1];
  if (upper.length < 2 || lower.length < 2) return null;
  const sampleCount = Math.max(upper.length, lower.length);
  const points = Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / Math.max(1, sampleCount - 1);
    const upperPoint = pointAtWarpParameter(upper, progress);
    const lowerPoint = pointAtWarpParameter(lower, progress);
    return { x: (upperPoint.x + lowerPoint.x) / 2, y: (upperPoint.y + lowerPoint.y) / 2 };
  });
  return {
    geometry: { kind: 'baseline', paths: [points] },
    path: { d: pathData(points), fidelity: 'baseline', length: pathLength(points) },
  };
}

/** Baseline compatibility surface used by the SVG textPath renderer and diagnostics. */
export function resolveWordArtWarpPath(
  warp: ShapeTextWarp,
  width: number,
  height: number,
  top = 0,
): WordArtWarpPath | null {
  const geometry = resolveWordArtWarpGeometry(warp, width, height, top);
  if (!geometry) return null;
  const baseline =
    geometry.kind === 'baseline'
      ? geometry.paths[0]
      : geometry.paths[0].map((point, index) => {
          const opposite = geometry.paths[geometry.paths.length - 1];
          const other = pointAtPath(opposite, index / Math.max(1, geometry.paths[0].length - 1));
          return { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
        });
  return { d: pathData(baseline), fidelity: geometry.kind, length: pathLength(baseline) };
}

export function pointAtPath(points: readonly WordArtWarpPoint[], progress: number): WordArtWarpPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(total);
  }
  if (total <= 0) return points[0];
  const target = Math.max(0, Math.min(1, progress)) * total;
  const segmentIndex = lengths.findIndex((length) => length >= target);
  if (segmentIndex < 0) return points[points.length - 1];
  const before = segmentIndex === 0 ? 0 : lengths[segmentIndex - 1];
  const segmentLength = lengths[segmentIndex] - before;
  const local = segmentLength > 0 ? (target - before) / segmentLength : 0;
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  return { x: start.x + (end.x - start.x) * local, y: start.y + (end.y - start.y) * local };
}

/**
 * Resolve the DrawingML text-warp percentage on a flattened boundary path.
 * ECMA-376 §20.1.9.19 steps 6–8 require travelled distance after flattening,
 * not the curve's command, sample, or angle parameter.
 */
export function pointAtWarpParameter(points: readonly WordArtWarpPoint[], progress: number): WordArtWarpPoint {
  return pointAtPath(points, progress);
}
