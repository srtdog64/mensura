import type { Quat, MutableQuat } from "./quat.js";
import { mutableQuat, quatCopy, quatCopyInto, quatIdentity, quatIdentityInto } from "./quat.js";
import type { Vec3 } from "./vec3.js";

export interface DualQuat {
  readonly real: Quat;
  readonly dual: Quat;
}

export interface MutableDualQuat {
  real: MutableQuat;
  dual: MutableQuat;
}

export const DUAL_QUAT_IDENTITY: DualQuat = Object.freeze({
  real: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
  dual: Object.freeze({ x: 0, y: 0, z: 0, w: 0 })
});

export function dualQuat(real: Quat, dual: Quat): DualQuat {
  return {
    real: quatCopy(real),
    dual: quatCopy(dual)
  };
}

export function mutableDualQuat(real?: Quat, dual?: Quat): MutableDualQuat {
  return {
    real: real ? quatCopy(real) : quatIdentity(),
    dual: dual ? quatCopy(dual) : mutableQuat(0, 0, 0, 0)
  };
}

export function dualQuatIdentity(): MutableDualQuat {
  return mutableDualQuat();
}

export function dualQuatIdentityInto(out: MutableDualQuat): MutableDualQuat {
  quatIdentityInto(out.real);
  out.dual.x = 0;
  out.dual.y = 0;
  out.dual.z = 0;
  out.dual.w = 0;
  return out;
}

export function copyDualQuat(value: DualQuat): DualQuat {
  return dualQuat(value.real, value.dual);
}

export function copyDualQuatInto(value: DualQuat, out: MutableDualQuat): MutableDualQuat {
  quatCopyInto(value.real, out.real);
  quatCopyInto(value.dual, out.dual);
  return out;
}

export function dualQuatMultiply(a: DualQuat, b: DualQuat): DualQuat {
  return dualQuatMultiplyInto(a, b, mutableDualQuat());
}

export function dualQuatMultiplyInto(a: DualQuat, b: DualQuat, out: MutableDualQuat): MutableDualQuat {
  // real = a.real * b.real
  // dual = a.real * b.dual + a.dual * b.real
  const ax = a.real.x, ay = a.real.y, az = a.real.z, aw = a.real.w;
  const bx = b.real.x, by = b.real.y, bz = b.real.z, bw = b.real.w;

  const dax = a.dual.x, day = a.dual.y, daz = a.dual.z, daw = a.dual.w;
  const dbx = b.dual.x, dby = b.dual.y, dbz = b.dual.z, dbw = b.dual.w;

  out.real.x = ax * bw + aw * bx + ay * bz - az * by;
  out.real.y = ay * bw + aw * by + az * bx - ax * bz;
  out.real.z = az * bw + aw * bz + ax * by - ay * bx;
  out.real.w = aw * bw - ax * bx - ay * by - az * bz;

  out.dual.x = ax * dbw + aw * dbx + ay * dbz - az * dby + dax * bw + daw * bx + day * bz - daz * by;
  out.dual.y = ay * dbw + aw * dby + az * dbx - ax * dbz + day * bw + daw * by + daz * bx - dax * bz;
  out.dual.z = az * dbw + aw * dbz + ax * dby - ay * dbx + daz * bw + daw * bz + dax * by - day * bx;
  out.dual.w = aw * dbw - ax * dbx - ay * dby - az * dbz + daw * bw - dax * bx - day * by - daz * bz;

  return out;
}

export function dualQuatFromTranslationRotation(translation: Vec3, rotation: Quat): DualQuat {
  return dualQuatFromTranslationRotationInto(translation, rotation, mutableDualQuat());
}

export function dualQuatFromTranslationRotationInto(translation: Vec3, rotation: Quat, out: MutableDualQuat): MutableDualQuat {
  quatCopyInto(rotation, out.real);

  const tx = translation.x * 0.5;
  const ty = translation.y * 0.5;
  const tz = translation.z * 0.5;

  const rx = rotation.x;
  const ry = rotation.y;
  const rz = rotation.z;
  const rw = rotation.w;

  out.dual.x =  tx * rw + ty * rz - tz * ry;
  out.dual.y = -tx * rz + ty * rw + tz * rx;
  out.dual.z =  tx * ry - ty * rx + tz * rw;
  out.dual.w = -tx * rx - ty * ry - tz * rz;

  return out;
}
