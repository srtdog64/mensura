import type { MutableVec3, Vec3 } from "./vec3.js";
import { mutableVec3 } from "./vec3.js";

export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number
];

export type MutableMat3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

export type Mat3Like = ArrayLike<number>;

export const MAT3_IDENTITY: Mat3 = Object.freeze([
  1, 0, 0,
  0, 1, 0,
  0, 0, 1
]);

export function mat3(
  m00: number, m10: number, m20: number,
  m01: number, m11: number, m21: number,
  m02: number, m12: number, m22: number
): MutableMat3 {
  return [
    m00, m10, m20,
    m01, m11, m21,
    m02, m12, m22
  ];
}

export function mat3Identity(): MutableMat3 {
  return [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ];
}

export function mat3IdentityInto(out: MutableMat3): MutableMat3 {
  out[0] = 1; out[1] = 0; out[2] = 0;
  out[3] = 0; out[4] = 1; out[5] = 0;
  out[6] = 0; out[7] = 0; out[8] = 1;
  return out;
}

export function mat3Copy(value: Mat3Like): MutableMat3 {
  return [
    value[0], value[1], value[2],
    value[3], value[4], value[5],
    value[6], value[7], value[8]
  ];
}

export function mat3CopyInto(value: Mat3Like, out: MutableMat3): MutableMat3 {
  out[0] = value[0]; out[1] = value[1]; out[2] = value[2];
  out[3] = value[3]; out[4] = value[4]; out[5] = value[5];
  out[6] = value[6]; out[7] = value[7]; out[8] = value[8];
  return out;
}

export function mat3Multiply(a: Mat3Like, b: Mat3Like): MutableMat3 {
  return mat3MultiplyInto(a, b, mat3Identity());
}

export function mat3MultiplyInto(a: Mat3Like, b: Mat3Like, out: MutableMat3): MutableMat3 {
  const a00 = a[0], a01 = a[1], a02 = a[2];
  const a10 = a[3], a11 = a[4], a12 = a[5];
  const a20 = a[6], a21 = a[7], a22 = a[8];

  const b00 = b[0], b01 = b[1], b02 = b[2];
  const b10 = b[3], b11 = b[4], b12 = b[5];
  const b20 = b[6], b21 = b[7], b22 = b[8];

  out[0] = b00 * a00 + b01 * a10 + b02 * a20;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22;

  out[3] = b10 * a00 + b11 * a10 + b12 * a20;
  out[4] = b10 * a01 + b11 * a11 + b12 * a21;
  out[5] = b10 * a02 + b11 * a12 + b12 * a22;

  out[6] = b20 * a00 + b21 * a10 + b22 * a20;
  out[7] = b20 * a01 + b21 * a11 + b22 * a21;
  out[8] = b20 * a02 + b21 * a12 + b22 * a22;

  return out;
}

export function mat3TransformPoint3(matrix: Mat3Like, point: Vec3): Vec3 {
  return mat3TransformPoint3Into(matrix, point, mutableVec3());
}

export function mat3TransformPoint3Into(matrix: Mat3Like, point: Vec3, out: MutableVec3): MutableVec3 {
  const x = point.x, y = point.y, z = point.z;
  out.x = x * matrix[0] + y * matrix[3] + z * matrix[6];
  out.y = x * matrix[1] + y * matrix[4] + z * matrix[7];
  out.z = x * matrix[2] + y * matrix[5] + z * matrix[8];
  return out;
}
