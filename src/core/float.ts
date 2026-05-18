const FLOAT32_BYTES = 4;
const FLOAT32_SCRATCH = new ArrayBuffer(FLOAT32_BYTES);
const FLOAT32_VIEW = new DataView(FLOAT32_SCRATCH);

export interface FloatTolerance {
  readonly abs: number;
  readonly rel: number;
  readonly ulps: number;
}

export interface Float32ConversionLoss {
  readonly input: number;
  readonly rounded: number;
  readonly exact: boolean;
  readonly finite: boolean;
  readonly absolute: number;
  readonly relative: number;
  readonly epsilon: number;
  readonly ulps: number;
}

export const DEFAULT_FLOAT_TOLERANCE: FloatTolerance = Object.freeze({
  abs: 1e-6,
  rel: 1e-6,
  ulps: 4
});

export function nearlyEqualAbsRel(
  a: number,
  b: number,
  tolerance: Pick<FloatTolerance, "abs" | "rel"> = DEFAULT_FLOAT_TOLERANCE
): boolean {
  if (Object.is(a, b) || a === b) {
    return true;
  }

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }

  const diff = Math.abs(a - b);

  if (diff <= tolerance.abs) {
    return true;
  }

  return diff <= Math.max(Math.abs(a), Math.abs(b)) * tolerance.rel;
}

export function float32ToBits(value: number): number {
  FLOAT32_VIEW.setFloat32(0, value, false);
  return FLOAT32_VIEW.getUint32(0, false);
}

export function bitsToFloat32(bits: number): number {
  FLOAT32_VIEW.setUint32(0, bits >>> 0, false);
  return FLOAT32_VIEW.getFloat32(0, false);
}

export function float32ToOrderedUint32(value: number): number {
  const bits = float32ToBits(value);

  if ((bits & 0x80000000) !== 0) {
    return (~bits) >>> 0;
  }

  return (bits | 0x80000000) >>> 0;
}

export function ulpDiffF32(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return Number.POSITIVE_INFINITY;
  }

  if (Object.is(a, b) || a === b) {
    return 0;
  }

  const orderedA = float32ToOrderedUint32(Math.fround(a));
  const orderedB = float32ToOrderedUint32(Math.fround(b));

  return Math.abs(orderedA - orderedB);
}

export function nearlyEqualUlpsF32(
  a: number,
  b: number,
  maxUlps: number = DEFAULT_FLOAT_TOLERANCE.ulps
): boolean {
  return ulpDiffF32(a, b) <= maxUlps;
}

export function epsilonF32At(value: number): number {
  const f32 = Math.fround(value);

  if (Number.isNaN(f32)) {
    return Number.NaN;
  }

  if (!Number.isFinite(f32)) {
    return Number.POSITIVE_INFINITY;
  }

  const up = nextUpF32(f32);
  const down = nextDownF32(f32);
  const upper = Number.isFinite(up) ? Math.abs(up - f32) : Number.POSITIVE_INFINITY;
  const lower = Number.isFinite(down) ? Math.abs(f32 - down) : Number.POSITIVE_INFINITY;

  return Math.min(upper, lower);
}

export function conversionLossF32(value: number): Float32ConversionLoss {
  const rounded = Math.fround(value);
  const exact = Object.is(value, rounded) || value === rounded;
  const finite = Number.isFinite(value) && Number.isFinite(rounded);
  const epsilon = epsilonF32At(rounded);
  const absolute = exact ? 0 : Math.abs(value - rounded);
  const relative = computeRelativeLoss(value, absolute);
  const ulps = computeLossUlps(absolute, epsilon);

  return {
    input: value,
    rounded,
    exact,
    finite,
    absolute,
    relative,
    epsilon,
    ulps
  };
}

export const lossF32 = conversionLossF32;

export function nextUpF32(value: number): number {
  const f32 = Math.fround(value);

  if (Number.isNaN(f32) || f32 === Number.POSITIVE_INFINITY) {
    return f32;
  }

  if (Object.is(f32, -0) || f32 === 0) {
    return bitsToFloat32(1);
  }

  const bits = float32ToBits(f32);
  const nextBits = f32 > 0 ? bits + 1 : bits - 1;

  return bitsToFloat32(nextBits);
}

function computeRelativeLoss(value: number, absolute: number): number {
  if (absolute === 0) {
    return 0;
  }

  const magnitude = Math.abs(value);

  if (magnitude === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return absolute / magnitude;
}

function computeLossUlps(absolute: number, epsilon: number): number {
  if (absolute === 0) {
    return 0;
  }

  if (!Number.isFinite(absolute) || !Number.isFinite(epsilon) || epsilon === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return absolute / epsilon;
}

export function nextDownF32(value: number): number {
  const f32 = Math.fround(value);

  if (Number.isNaN(f32) || f32 === Number.NEGATIVE_INFINITY) {
    return f32;
  }

  if (Object.is(f32, 0) || f32 === 0) {
    return bitsToFloat32(0x80000001);
  }

  const bits = float32ToBits(f32);
  const nextBits = f32 > 0 ? bits - 1 : bits + 1;

  return bitsToFloat32(nextBits);
}
