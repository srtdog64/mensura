export interface BinaryLayout {
  readonly sizeBytes: number;
  readonly alignBytes: number;
  readonly strideBytes: number;
}

export interface WgslAabb3fLayout extends BinaryLayout {
  readonly minOffsetBytes: number;
  readonly maxOffsetBytes: number;
}

export const F32_SIZE_BYTES = 4;

export const WGSL_VEC3F_LAYOUT: BinaryLayout = Object.freeze({
  sizeBytes: 12,
  alignBytes: 16,
  strideBytes: 16
});

export const WGSL_MAT4X4F_LAYOUT: BinaryLayout = Object.freeze({
  sizeBytes: 64,
  alignBytes: 16,
  strideBytes: 64
});

export const WGSL_AABB3F_LAYOUT: WgslAabb3fLayout = Object.freeze({
  sizeBytes: 32,
  alignBytes: 16,
  strideBytes: 32,
  minOffsetBytes: 0,
  maxOffsetBytes: 16
});

export function isByteOffsetAligned(byteOffset: number, alignBytes: number): boolean {
  return Number.isInteger(byteOffset) && Number.isInteger(alignBytes) && alignBytes > 0 && byteOffset % alignBytes === 0;
}

export function alignByteOffset(byteOffset: number, alignBytes: number): number {
  if (!Number.isFinite(byteOffset) || !Number.isFinite(alignBytes) || alignBytes <= 0) {
    return Number.NaN;
  }

  return Math.ceil(byteOffset / alignBytes) * alignBytes;
}

export function byteLengthForLayout(layout: BinaryLayout, count: number = 1): number {
  if (count <= 0) {
    return 0;
  }

  return layout.strideBytes * (count - 1) + layout.sizeBytes;
}

export function endByteOffsetForLayout(byteOffset: number, layout: BinaryLayout, count: number = 1): number {
  return byteOffset + byteLengthForLayout(layout, count);
}
