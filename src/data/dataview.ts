import type { Mat4Like, MutableMat4 } from "../core/mat4.js";
import { mat4Identity } from "../core/mat4.js";
import type { Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { mutableVec3 } from "../core/vec3.js";
import type { Aabb } from "../geometry/aabb.js";
import { aabb } from "../geometry/aabb.js";
import {
  type BinaryLayout,
  WGSL_AABB3F_LAYOUT,
  WGSL_MAT4X4F_LAYOUT,
  WGSL_VEC3F_LAYOUT,
  byteLengthForLayout,
  isByteOffsetAligned
} from "../layout/index.js";
import {
  unsafeMat4ReadDataViewF32Into,
  unsafeMat4WriteDataViewF32,
  unsafeVec3ReadDataViewF32Into,
  unsafeVec3WriteDataViewF32,
  unsafeWgslVec3WriteDataViewF32
} from "../unsafe/index.js";

export function validateDataViewRange(view: DataView, byteOffset: number, byteLength: number): Result<true> {
  if (!Number.isInteger(byteOffset) || !Number.isInteger(byteLength) || byteOffset < 0 || byteLength < 0) {
    return err({
      code: "DATA_INVALID_BYTE_RANGE",
      message: "DataView byte range must use non-negative integer offsets and lengths",
      stage: "DataViewProjection",
      retryable: false,
      meta: { byteOffset, byteLength }
    });
  }

  if (byteOffset + byteLength > view.byteLength) {
    return err({
      code: "DATA_OFFSET_OUT_OF_RANGE",
      message: "DataView byte range exceeds view length",
      stage: "DataViewProjection",
      retryable: false,
      meta: { byteOffset, byteLength, viewByteLength: view.byteLength }
    });
  }

  return ok(true);
}

export function validateDataViewLayout(
  view: DataView,
  byteOffset: number,
  layout: BinaryLayout,
  count: number = 1
): Result<true> {
  const absoluteOffset = view.byteOffset + byteOffset;

  if (!isByteOffsetAligned(absoluteOffset, layout.alignBytes)) {
    return err({
      code: "DATA_OFFSET_UNALIGNED",
      message: "DataView byte offset does not satisfy the requested layout alignment",
      stage: "DataViewProjection",
      retryable: false,
      meta: { byteOffset, absoluteOffset, alignBytes: layout.alignBytes }
    });
  }

  return validateDataViewRange(view, byteOffset, byteLengthForLayout(layout, count));
}

export function vec3ReadDataViewF32(
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<Vec3> {
  return vec3ReadDataViewF32Into(view, byteOffset, mutableVec3(), littleEndian);
}

export function vec3ReadDataViewF32Into(
  view: DataView,
  byteOffset: number,
  out: MutableVec3,
  littleEndian: boolean = true
): Result<MutableVec3> {
  const valid = validateDataViewRange(view, byteOffset, WGSL_VEC3F_LAYOUT.sizeBytes);
  if (!valid.ok) {
    return valid;
  }

  return ok(unsafeVec3ReadDataViewF32Into(view, byteOffset, out, littleEndian));
}

export function vec3WriteDataViewF32(
  value: Vec3,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<DataView> {
  const valid = validateDataViewRange(view, byteOffset, WGSL_VEC3F_LAYOUT.sizeBytes);
  if (!valid.ok) {
    return valid;
  }

  return ok(unsafeVec3WriteDataViewF32(value, view, byteOffset, littleEndian));
}

export function wgslVec3ReadDataViewF32(
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<Vec3> {
  return wgslVec3ReadDataViewF32Into(view, byteOffset, mutableVec3(), littleEndian);
}

export function wgslVec3ReadDataViewF32Into(
  view: DataView,
  byteOffset: number,
  out: MutableVec3,
  littleEndian: boolean = true
): Result<MutableVec3> {
  const valid = validateDataViewLayout(view, byteOffset, WGSL_VEC3F_LAYOUT);
  if (!valid.ok) {
    return valid;
  }

  return ok(unsafeVec3ReadDataViewF32Into(view, byteOffset, out, littleEndian));
}

export function wgslVec3WriteDataViewF32(
  value: Vec3,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<DataView> {
  const valid = validateDataViewLayout(view, byteOffset, WGSL_VEC3F_LAYOUT);
  if (!valid.ok) {
    return valid;
  }

  return ok(unsafeWgslVec3WriteDataViewF32(value, view, byteOffset, littleEndian));
}

export function mat4ReadDataViewF32(
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<MutableMat4> {
  return mat4ReadDataViewF32Into(view, byteOffset, mat4Identity(), littleEndian);
}

export function mat4ReadDataViewF32Into(
  view: DataView,
  byteOffset: number,
  out: MutableMat4,
  littleEndian: boolean = true
): Result<MutableMat4> {
  const valid = validateDataViewLayout(view, byteOffset, WGSL_MAT4X4F_LAYOUT);
  if (!valid.ok) {
    return valid;
  }

  return ok(unsafeMat4ReadDataViewF32Into(view, byteOffset, out, littleEndian));
}

export function mat4WriteDataViewF32(
  value: Mat4Like,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<DataView> {
  const valid = validateDataViewLayout(view, byteOffset, WGSL_MAT4X4F_LAYOUT);
  if (!valid.ok) {
    return valid;
  }

  return ok(unsafeMat4WriteDataViewF32(value, view, byteOffset, littleEndian));
}

export function aabbReadWgslDataViewF32(
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<Aabb> {
  const valid = validateDataViewLayout(view, byteOffset, WGSL_AABB3F_LAYOUT);
  if (!valid.ok) {
    return valid;
  }

  const min = unsafeVec3ReadDataViewF32Into(
    view,
    byteOffset + WGSL_AABB3F_LAYOUT.minOffsetBytes,
    mutableVec3(),
    littleEndian
  );
  const max = unsafeVec3ReadDataViewF32Into(
    view,
    byteOffset + WGSL_AABB3F_LAYOUT.maxOffsetBytes,
    mutableVec3(),
    littleEndian
  );

  return ok(aabb(min, max));
}

export function aabbWriteWgslDataViewF32(
  value: Aabb,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Result<DataView> {
  const valid = validateDataViewLayout(view, byteOffset, WGSL_AABB3F_LAYOUT);
  if (!valid.ok) {
    return valid;
  }

  unsafeWgslVec3WriteDataViewF32(value.min, view, byteOffset + WGSL_AABB3F_LAYOUT.minOffsetBytes, littleEndian);
  unsafeWgslVec3WriteDataViewF32(value.max, view, byteOffset + WGSL_AABB3F_LAYOUT.maxOffsetBytes, littleEndian);
  return ok(view);
}
