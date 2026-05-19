import type { MutableVec3, Vec3 } from "../core/vec3.js";

export function add3IntoMany(
  a: ArrayLike<Vec3>,
  b: ArrayLike<Vec3>,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  for (let i = 0; i < count; i++) {
    const va = a[i];
    const vb = b[i];
    const ax = va.x;
    const ay = va.y;
    const az = va.z;
    const bx = vb.x;
    const by = vb.y;
    const bz = vb.z;
    const vo = out[i];
    vo.x = ax + bx;
    vo.y = ay + by;
    vo.z = az + bz;
  }
  return out;
}

export function sub3IntoMany(
  a: ArrayLike<Vec3>,
  b: ArrayLike<Vec3>,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  for (let i = 0; i < count; i++) {
    const va = a[i];
    const vb = b[i];
    const vo = out[i];
    vo.x = va.x - vb.x;
    vo.y = va.y - vb.y;
    vo.z = va.z - vb.z;
  }
  return out;
}

export function scale3IntoMany(
  values: ArrayLike<Vec3>,
  scale: number,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  for (let i = 0; i < count; i++) {
    const v = values[i];
    const vo = out[i];
    vo.x = v.x * scale;
    vo.y = v.y * scale;
    vo.z = v.z * scale;
  }
  return out;
}

export function normalize3IntoMany(
  values: ArrayLike<Vec3>,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  for (let i = 0; i < count; i++) {
    const v = values[i];
    const x = v.x;
    const y = v.y;
    const z = v.z;
    const lenSq = x * x + y * y + z * z;
    const vo = out[i];

    if (lenSq > 0) {
      const invLen = 1 / Math.sqrt(lenSq);
      vo.x = x * invLen;
      vo.y = y * invLen;
      vo.z = z * invLen;
    } else {
      vo.x = 0;
      vo.y = 0;
      vo.z = 0;
    }
  }
  return out;
}

export function dot3IntoMany<TOut extends { [index: number]: number; readonly length: number }>(
  a: ArrayLike<Vec3>,
  b: ArrayLike<Vec3>,
  out: TOut,
  count: number
): TOut {
  for (let i = 0; i < count; i++) {
    const va = a[i];
    const vb = b[i];
    out[i] = va.x * vb.x + va.y * vb.y + va.z * vb.z;
  }
  return out;
}

export function cross3IntoMany(
  a: ArrayLike<Vec3>,
  b: ArrayLike<Vec3>,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  for (let i = 0; i < count; i++) {
    const va = a[i];
    const vb = b[i];
    const ax = va.x;
    const ay = va.y;
    const az = va.z;
    const bx = vb.x;
    const by = vb.y;
    const bz = vb.z;
    const vo = out[i];
    vo.x = ay * bz - az * by;
    vo.y = az * bx - ax * bz;
    vo.z = ax * by - ay * bx;
  }
  return out;
}

export function length3IntoMany<TOut extends { [index: number]: number; readonly length: number }>(
  values: ArrayLike<Vec3>,
  out: TOut,
  count: number
): TOut {
  for (let i = 0; i < count; i++) {
    const v = values[i];
    const x = v.x;
    const y = v.y;
    const z = v.z;
    out[i] = Math.sqrt(x * x + y * y + z * z);
  }
  return out;
}

export function distance3IntoMany<TOut extends { [index: number]: number; readonly length: number }>(
  a: ArrayLike<Vec3>,
  b: ArrayLike<Vec3>,
  out: TOut,
  count: number
): TOut {
  for (let i = 0; i < count; i++) {
    const va = a[i];
    const vb = b[i];
    const dx = vb.x - va.x;
    const dy = vb.y - va.y;
    const dz = vb.z - va.z;
    out[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return out;
}

export function scaleAndAdd3IntoMany(
  a: ArrayLike<Vec3>,
  b: ArrayLike<Vec3>,
  scale: number,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  for (let i = 0; i < count; i++) {
    const va = a[i];
    const vb = b[i];
    const vo = out[i];
    vo.x = va.x + vb.x * scale;
    vo.y = va.y + vb.y * scale;
    vo.z = va.z + vb.z * scale;
  }
  return out;
}
