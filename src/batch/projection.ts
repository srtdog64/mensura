import type { Mat4Like, MutableMat4 } from "../core/mat4.js";
import type { MutableVec3, Vec3 } from "../core/vec3.js";
import type { MutableQuat, Quat } from "../core/quat.js";

/**
 * Pack N `Vec3` objects into a tightly-packed `Float32Array` (3 floats per
 * element, no padding). Useful for seeding a `SharedArrayBuffer` view before
 * running `unsafe/*F32Many` kernels.
 */
export function vec3ArrayWriteFloat32(
  values: ArrayLike<Vec3>,
  out: Float32Array,
  count: number
): Float32Array {
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const v = values[i];
    out[offset + 0] = v.x;
    out[offset + 1] = v.y;
    out[offset + 2] = v.z;
    offset += 3;
  }
  return out;
}

/**
 * Read N packed `Float32Array` vec3 elements (stride 3) back into caller-owned
 * `MutableVec3` objects. Inverse of `vec3ArrayWriteFloat32`.
 */
export function vec3ArrayReadFloat32(
  packed: Float32Array,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const vo = out[i];
    vo.x = packed[offset + 0];
    vo.y = packed[offset + 1];
    vo.z = packed[offset + 2];
    offset += 3;
  }
  return out;
}

/**
 * Pack N `Quat` objects into `Float32Array` (4 floats per element). Inverse:
 * `quatArrayReadFloat32`.
 */
export function quatArrayWriteFloat32(
  values: ArrayLike<Quat>,
  out: Float32Array,
  count: number
): Float32Array {
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const q = values[i];
    out[offset + 0] = q.x;
    out[offset + 1] = q.y;
    out[offset + 2] = q.z;
    out[offset + 3] = q.w;
    offset += 4;
  }
  return out;
}

export function quatArrayReadFloat32(
  packed: Float32Array,
  out: ArrayLike<MutableQuat>,
  count: number
): ArrayLike<MutableQuat> {
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const qo = out[i];
    qo.x = packed[offset + 0];
    qo.y = packed[offset + 1];
    qo.z = packed[offset + 2];
    qo.w = packed[offset + 3];
    offset += 4;
  }
  return out;
}

/**
 * Pack N `Mat4Like` matrices into `Float32Array` (16 floats per element,
 * column-major as stored in Mensura's `MutableMat4`).
 */
export function mat4ArrayWriteFloat32(
  values: ArrayLike<Mat4Like>,
  out: Float32Array,
  count: number
): Float32Array {
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const m = values[i];
    out[offset + 0] = m[0];
    out[offset + 1] = m[1];
    out[offset + 2] = m[2];
    out[offset + 3] = m[3];
    out[offset + 4] = m[4];
    out[offset + 5] = m[5];
    out[offset + 6] = m[6];
    out[offset + 7] = m[7];
    out[offset + 8] = m[8];
    out[offset + 9] = m[9];
    out[offset + 10] = m[10];
    out[offset + 11] = m[11];
    out[offset + 12] = m[12];
    out[offset + 13] = m[13];
    out[offset + 14] = m[14];
    out[offset + 15] = m[15];
    offset += 16;
  }
  return out;
}

export function mat4ArrayReadFloat32(
  packed: Float32Array,
  out: ArrayLike<MutableMat4>,
  count: number
): ArrayLike<MutableMat4> {
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const m = out[i];
    m[0] = packed[offset + 0];
    m[1] = packed[offset + 1];
    m[2] = packed[offset + 2];
    m[3] = packed[offset + 3];
    m[4] = packed[offset + 4];
    m[5] = packed[offset + 5];
    m[6] = packed[offset + 6];
    m[7] = packed[offset + 7];
    m[8] = packed[offset + 8];
    m[9] = packed[offset + 9];
    m[10] = packed[offset + 10];
    m[11] = packed[offset + 11];
    m[12] = packed[offset + 12];
    m[13] = packed[offset + 13];
    m[14] = packed[offset + 14];
    m[15] = packed[offset + 15];
    offset += 16;
  }
  return out;
}
