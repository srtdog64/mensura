import type { Mat4Like, MutableMat4 } from "./mat4.js";
import { mat4Compose, mat4ComposeInto, mat4DecomposeInto, mat4Identity, mat4MultiplyInto } from "./mat4.js";
import type { MutableQuat, Quat } from "./quat.js";
import { QUAT_IDENTITY, quat, mutableQuat, quatCopyInto } from "./quat.js";
import type { Result } from "./result.js";
import { err, ok } from "./result.js";
import type { MutableVec3, Vec3 } from "./vec3.js";
import { VEC3_ONE, VEC3_ZERO, vec3, copy3Into, mutableVec3 } from "./vec3.js";

const DEFAULT_TRANSFORM3_DECOMPOSE_MIN_AXIS_SCALE_SQ = 1e-24;

export interface Transform3 {
  readonly translation: Vec3;
  readonly rotation: Quat;
  readonly scale: Vec3;
}

export interface MutableTransform3 {
  translation: MutableVec3;
  rotation: MutableQuat;
  scale: MutableVec3;
}

export const TRANSFORM3_IDENTITY: Transform3 = Object.freeze({
  translation: VEC3_ZERO,
  rotation: QUAT_IDENTITY,
  scale: VEC3_ONE
});

export function transform3(translation: Vec3, rotation: Quat, scale: Vec3): Transform3 {
  return {
    translation: vec3(translation.x, translation.y, translation.z),
    rotation: quat(rotation.x, rotation.y, rotation.z, rotation.w),
    scale: vec3(scale.x, scale.y, scale.z)
  };
}

export function mutableTransform3(
  translation: Vec3 = VEC3_ZERO,
  rotation: Quat = QUAT_IDENTITY,
  scale: Vec3 = VEC3_ONE
): MutableTransform3 {
  return {
    translation: mutableVec3(translation.x, translation.y, translation.z),
    rotation: mutableQuat(rotation.x, rotation.y, rotation.z, rotation.w),
    scale: mutableVec3(scale.x, scale.y, scale.z)
  };
}

export function transform3Identity(): MutableTransform3 {
  return mutableTransform3();
}

export function transform3IdentityInto(out: MutableTransform3): MutableTransform3 {
  out.translation.x = 0;
  out.translation.y = 0;
  out.translation.z = 0;
  out.rotation.x = 0;
  out.rotation.y = 0;
  out.rotation.z = 0;
  out.rotation.w = 1;
  out.scale.x = 1;
  out.scale.y = 1;
  out.scale.z = 1;
  return out;
}

export function transform3Copy(value: Transform3): Transform3 {
  return transform3(value.translation, value.rotation, value.scale);
}

export function transform3CopyInto(value: Transform3, out: MutableTransform3): MutableTransform3 {
  copy3Into(value.translation, out.translation);
  quatCopyInto(value.rotation, out.rotation);
  copy3Into(value.scale, out.scale);
  return out;
}

export function transform3ToMat4(value: Transform3): MutableMat4 {
  return mat4Compose(value.translation, value.rotation, value.scale);
}

export function transform3ToMat4Into(value: Transform3, out: MutableMat4): MutableMat4 {
  return mat4ComposeInto(value.translation, value.rotation, value.scale, out);
}

export function transform3FromMat4(value: Mat4Like): MutableTransform3 {
  return transform3FromMat4Into(value, mutableTransform3());
}

export function transform3FromMat4Into(value: Mat4Like, out: MutableTransform3): MutableTransform3 {
  mat4DecomposeInto(value, out.translation, out.rotation, out.scale);
  return out;
}

/**
 * Apply `value` to `point` directly, without composing a `mat4`.
 *
 * The formula is the standard `M = T * R * S` expansion:
 * `out = translation + rotate(rotation, scale * point)`. The quaternion
 * rotation uses the alloc-free identity `v' = v + 2 * cross(q.xyz, q.w * v + cross(q.xyz, v))`.
 * Aliasing-safe: `point` and `out` can be the same vec3.
 *
 * Use this when the caller has a `Transform3` already; composing through
 * `mat4` is wasted work for a single point.
 */
export function transform3TransformPoint3(value: Transform3, point: Vec3): MutableVec3 {
  return transform3TransformPoint3Into(value, point, mutableVec3());
}

export function transform3TransformPoint3Into(value: Transform3, point: Vec3, out: MutableVec3): MutableVec3 {
  // Cache point + scale into locals so aliasing (out === point) is safe.
  const sx = point.x * value.scale.x;
  const sy = point.y * value.scale.y;
  const sz = point.z * value.scale.z;
  const qx = value.rotation.x;
  const qy = value.rotation.y;
  const qz = value.rotation.z;
  const qw = value.rotation.w;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * sz - qz * sy);
  const ty = 2 * (qz * sx - qx * sz);
  const tz = 2 * (qx * sy - qy * sx);
  // out = scaled + q.w * t + cross(q.xyz, t) + translation
  out.x = sx + qw * tx + (qy * tz - qz * ty) + value.translation.x;
  out.y = sy + qw * ty + (qz * tx - qx * tz) + value.translation.y;
  out.z = sz + qw * tz + (qx * ty - qy * tx) + value.translation.z;
  return out;
}

/**
 * Transform a direction by `value`, **ignoring `translation`**. Scale and
 * rotation still apply, so non-uniform scale changes direction length the
 * same way it does for a point. Aliasing-safe.
 */
export function transform3TransformDirection3(value: Transform3, direction: Vec3): MutableVec3 {
  return transform3TransformDirection3Into(value, direction, mutableVec3());
}

export function transform3TransformDirection3Into(value: Transform3, direction: Vec3, out: MutableVec3): MutableVec3 {
  const sx = direction.x * value.scale.x;
  const sy = direction.y * value.scale.y;
  const sz = direction.z * value.scale.z;
  const qx = value.rotation.x;
  const qy = value.rotation.y;
  const qz = value.rotation.z;
  const qw = value.rotation.w;
  const tx = 2 * (qy * sz - qz * sy);
  const ty = 2 * (qz * sx - qx * sz);
  const tz = 2 * (qx * sy - qy * sx);
  out.x = sx + qw * tx + (qy * tz - qz * ty);
  out.y = sy + qw * ty + (qz * tx - qx * tz);
  out.z = sz + qw * tz + (qx * ty - qy * tx);
  return out;
}

/**
 * Compose two transforms in the `M = M_a * M_b` order. The result is computed
 * by routing through the canonical `mat4Compose` source of truth and then
 * re-decomposing the product matrix.
 *
 * **Lossy under non-uniform scale.** When either operand has a non-uniform
 * scale and a non-trivial rotation, the product matrix carries shear that
 * cannot be expressed as a single TRS triple. The decompose step then loses
 * the shear and returns the closest TRS approximation. This matches the
 * three.js / glm / godot behavior for the same operation.
 *
 * Allocates two `mat4` scratch buffers per call; use
 * `transform3MultiplyInto` to bring your own.
 */
export function transform3Multiply(a: Transform3, b: Transform3): MutableTransform3 {
  return transform3MultiplyInto(a, b, mat4Identity(), mat4Identity(), mutableTransform3());
}

/**
 * Alloc-free variant of `transform3Multiply`. The caller owns both `mat4`
 * scratches and the `MutableTransform3` output. The same lossy-under-shear
 * caveat applies.
 */
export function transform3MultiplyInto(
  a: Transform3,
  b: Transform3,
  scratchA: MutableMat4,
  scratchB: MutableMat4,
  out: MutableTransform3
): MutableTransform3 {
  mat4ComposeInto(a.translation, a.rotation, a.scale, scratchA);
  mat4ComposeInto(b.translation, b.rotation, b.scale, scratchB);
  // mat4MultiplyInto reads `a` into locals up front and caches each `b`
  // column before writing the same column of `out`, so `out === scratchA`
  // is safe even though `b === scratchB` is the other input.
  mat4MultiplyInto(scratchA, scratchB, scratchA);
  mat4DecomposeInto(scratchA, out.translation, out.rotation, out.scale);
  return out;
}

/**
 * `Result`-first counterpart of `transform3FromMat4`. Validates the matrix
 * before delegating to `mat4DecomposeInto`:
 *
 * - non-finite components: `VALIDATION_MAT4_NON_FINITE`
 * - invalid `minAxisScaleSq`: `VALIDATION_INVALID_RANGE`
 * - any axis scale-squared below `minAxisScaleSq` (default `1e-24`):
 *   `TRANSFORM_SINGULAR`; `mat4DecomposeInto` divides by per-axis scale to
 *   recover rotation, so zero or near-zero scale destroys the quaternion.
 *
 * Errors are stamped with `stage: "Transform"`.
 */
export interface Transform3FromMat4CheckedOptions {
  /**
   * Squared per-axis scale below which the decompose is rejected as
   * singular. The check uses the squared value to avoid taking three
   * sqrts at the boundary.
   */
  readonly minAxisScaleSq?: number;
}

export function transform3FromMat4Checked(
  value: Mat4Like,
  options: Transform3FromMat4CheckedOptions = {}
): Result<MutableTransform3> {
  return transform3FromMat4CheckedInto(value, mutableTransform3(), options);
}

export function transform3FromMat4CheckedInto(
  value: Mat4Like,
  out: MutableTransform3,
  options: Transform3FromMat4CheckedOptions = {}
): Result<MutableTransform3> {
  // 1e-24 is (1e-12)^2. The squared check avoids three sqrt calls while
  // rejecting axes too small to recover a stable rotation basis from.
  const minAxisScaleSq = options.minAxisScaleSq ?? DEFAULT_TRANSFORM3_DECOMPOSE_MIN_AXIS_SCALE_SQ;
  if (!Number.isFinite(minAxisScaleSq) || minAxisScaleSq < 0) {
    return err({
      code: "VALIDATION_INVALID_RANGE",
      stage: "Transform",
      message: "minAxisScaleSq must be finite and non-negative",
      meta: { minAxisScaleSq }
    });
  }

  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(value[i])) {
      return err({
        code: "VALIDATION_MAT4_NON_FINITE",
        stage: "Transform",
        message: `matrix[${i}] must be finite to decompose into a Transform3`,
        meta: { index: i, value: value[i] }
      });
    }
  }

  const sxSq = value[0] * value[0] + value[1] * value[1] + value[2] * value[2];
  const sySq = value[4] * value[4] + value[5] * value[5] + value[6] * value[6];
  const szSq = value[8] * value[8] + value[9] * value[9] + value[10] * value[10];
  if (sxSq < minAxisScaleSq || sySq < minAxisScaleSq || szSq < minAxisScaleSq) {
    return err({
      code: "TRANSFORM_SINGULAR",
      stage: "Transform",
      message: "matrix has a near-zero axis scale; cannot recover a stable rotation",
      meta: { sxSq, sySq, szSq, minAxisScaleSq }
    });
  }

  mat4DecomposeInto(value, out.translation, out.rotation, out.scale);
  return ok(out);
}
