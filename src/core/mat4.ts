import type { MutableVec3, Vec3 } from "./vec3.js";
import { mutableVec3 } from "./vec3.js";
import type { MutableQuat, Quat } from "./quat.js";
import { mutableQuat } from "./quat.js";
import { type Result, err, mensuraError, ok } from "./result.js";

export type Mat4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type MutableMat4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type Mat4Like = ArrayLike<number>;

export const MAT4_IDENTITY: Mat4 = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]);

export function mat4Index(row: number, column: number): number {
  return column * 4 + row;
}

export function mat4(
  m00: number,
  m10: number,
  m20: number,
  m30: number,
  m01: number,
  m11: number,
  m21: number,
  m31: number,
  m02: number,
  m12: number,
  m22: number,
  m32: number,
  m03: number,
  m13: number,
  m23: number,
  m33: number
): MutableMat4 {
  return [
    m00, m10, m20, m30,
    m01, m11, m21, m31,
    m02, m12, m22, m32,
    m03, m13, m23, m33
  ];
}

export function mat4Identity(): MutableMat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

export function mat4IdentityInto(out: MutableMat4): MutableMat4 {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}

export function mat4Copy(value: Mat4Like): MutableMat4 {
  return [
    value[0], value[1], value[2], value[3],
    value[4], value[5], value[6], value[7],
    value[8], value[9], value[10], value[11],
    value[12], value[13], value[14], value[15]
  ];
}

export function mat4CopyInto(value: Mat4Like, out: MutableMat4): MutableMat4 {
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  out[3] = value[3];
  out[4] = value[4];
  out[5] = value[5];
  out[6] = value[6];
  out[7] = value[7];
  out[8] = value[8];
  out[9] = value[9];
  out[10] = value[10];
  out[11] = value[11];
  out[12] = value[12];
  out[13] = value[13];
  out[14] = value[14];
  out[15] = value[15];
  return out;
}

export function mat4Multiply(a: Mat4Like, b: Mat4Like): MutableMat4 {
  return mat4MultiplyInto(a, b, mat4Identity());
}

export function mat4MultiplyInto(a: Mat4Like, b: Mat4Like, out: MutableMat4): MutableMat4 {
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];
  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];
  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];
  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];

  let b0 = b[0];
  let b1 = b[1];
  let b2 = b[2];
  let b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}

export function mat4Translation(translation: Vec3): MutableMat4 {
  return mat4TranslationInto(translation, mat4Identity());
}

export function mat4TranslationInto(translation: Vec3, out: MutableMat4): MutableMat4 {
  mat4IdentityInto(out);
  out[12] = translation.x;
  out[13] = translation.y;
  out[14] = translation.z;
  return out;
}

export function mat4Scaling(scale: Vec3): MutableMat4 {
  return mat4ScalingInto(scale, mat4Identity());
}

export function mat4ScalingInto(scale: Vec3, out: MutableMat4): MutableMat4 {
  out[0] = scale.x;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = scale.y;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = scale.z;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}

export function mat4TransformPoint3(matrix: Mat4Like, point: Vec3): Vec3 {
  return mat4TransformPoint3Into(matrix, point, mutableVec3());
}

export function mat4TransformPoint3Into(matrix: Mat4Like, point: Vec3, out: MutableVec3): MutableVec3 {
  const x = point.x;
  const y = point.y;
  const z = point.z;
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const invW = w === 0 ? 1 : 1 / w;

  out.x = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * invW;
  out.y = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * invW;
  out.z = (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * invW;
  return out;
}

export function mat4TransformDirection3(matrix: Mat4Like, direction: Vec3): Vec3 {
  return mat4TransformDirection3Into(matrix, direction, mutableVec3());
}

export function mat4TransformDirection3Into(matrix: Mat4Like, direction: Vec3, out: MutableVec3): MutableVec3 {
  const x = direction.x;
  const y = direction.y;
  const z = direction.z;

  out.x = matrix[0] * x + matrix[4] * y + matrix[8] * z;
  out.y = matrix[1] * x + matrix[5] * y + matrix[9] * z;
  out.z = matrix[2] * x + matrix[6] * y + matrix[10] * z;
  return out;
}

export function mat4Determinant(value: Mat4Like): number {
  const n11 = value[0], n21 = value[1], n31 = value[2], n41 = value[3];
  const n12 = value[4], n22 = value[5], n32 = value[6], n42 = value[7];
  const n13 = value[8], n23 = value[9], n33 = value[10], n43 = value[11];
  const n14 = value[12], n24 = value[13], n34 = value[14], n44 = value[15];

  const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
  const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
  const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
  const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

  return n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
}

export function mat4Invert(value: Mat4Like): Result<MutableMat4> {
  return mat4InvertInto(value, mat4Identity());
}

export function mat4InvertInto(value: Mat4Like, out: MutableMat4): Result<MutableMat4> {
  const n11 = value[0], n21 = value[1], n31 = value[2], n41 = value[3];
  const n12 = value[4], n22 = value[5], n32 = value[6], n42 = value[7];
  const n13 = value[8], n23 = value[9], n33 = value[10], n43 = value[11];
  const n14 = value[12], n24 = value[13], n34 = value[14], n44 = value[15];

  const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
  const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
  const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
  const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

  const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

  if (det === 0) {
    return err(mensuraError({
      code: "TRANSFORM_SINGULAR",
      stage: "Transform",
      message: "Matrix is singular (det = 0); cannot invert.",
      meta: { det }
    }));
  }

  const detInv = 1 / det;

  out[0] = t11 * detInv;
  out[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
  out[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
  out[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;

  out[4] = t12 * detInv;
  out[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
  out[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
  out[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;

  out[8] = t13 * detInv;
  out[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
  out[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
  out[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;

  out[12] = t14 * detInv;
  out[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
  out[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
  out[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;

  return ok(out);
}

export function mat4LookAtRh(eye: Vec3, center: Vec3, up: Vec3): Result<MutableMat4> {
  return mat4LookAtRhInto(eye, center, up, mat4Identity());
}

export function mat4LookAtRhInto(eye: Vec3, center: Vec3, up: Vec3, out: MutableMat4): Result<MutableMat4> {
  let fx = eye.x - center.x;
  let fy = eye.y - center.y;
  let fz = eye.z - center.z;
  const forwardLenSq = fx * fx + fy * fy + fz * fz;

  if (forwardLenSq === 0) {
    return err(mensuraError({
      code: "TRANSFORM_DEGENERATE_BASIS",
      stage: "Transform",
      message: "lookAt requires eye and center to differ.",
      meta: { eye, center }
    }));
  }

  const invForwardLen = 1 / Math.sqrt(forwardLenSq);
  fx *= invForwardLen;
  fy *= invForwardLen;
  fz *= invForwardLen;

  let rx = up.y * fz - up.z * fy;
  let ry = up.z * fx - up.x * fz;
  let rz = up.x * fy - up.y * fx;
  const rightLenSq = rx * rx + ry * ry + rz * rz;

  if (rightLenSq === 0) {
    return err(mensuraError({
      code: "TRANSFORM_DEGENERATE_BASIS",
      stage: "Transform",
      message: "lookAt up vector is parallel to view direction.",
      meta: { up, forward: { x: fx, y: fy, z: fz } }
    }));
  }

  const invRightLen = 1 / Math.sqrt(rightLenSq);
  rx *= invRightLen;
  ry *= invRightLen;
  rz *= invRightLen;

  const ux = fy * rz - fz * ry;
  const uy = fz * rx - fx * rz;
  const uz = fx * ry - fy * rx;

  out[0] = rx; out[1] = ux; out[2] = fx; out[3] = 0;
  out[4] = ry; out[5] = uy; out[6] = fy; out[7] = 0;
  out[8] = rz; out[9] = uz; out[10] = fz; out[11] = 0;
  out[12] = -(rx * eye.x + ry * eye.y + rz * eye.z);
  out[13] = -(ux * eye.x + uy * eye.y + uz * eye.z);
  out[14] = -(fx * eye.x + fy * eye.y + fz * eye.z);
  out[15] = 1;

  return ok(out);
}

export interface Mat4DecomposedTrs {
  readonly translation: MutableVec3;
  readonly rotation: MutableQuat;
  readonly scale: MutableVec3;
}

export function mat4Compose(translation: Vec3, rotation: Quat, scale: Vec3): MutableMat4 {
  return mat4ComposeInto(translation, rotation, scale, mat4Identity());
}

export function mat4ComposeInto(translation: Vec3, rotation: Quat, scale: Vec3, out: MutableMat4): MutableMat4 {
  const qx = rotation.x;
  const qy = rotation.y;
  const qz = rotation.z;
  const qw = rotation.w;
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;

  const sx = scale.x;
  const sy = scale.y;
  const sz = scale.z;

  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;

  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;

  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;

  out[12] = translation.x;
  out[13] = translation.y;
  out[14] = translation.z;
  out[15] = 1;

  return out;
}

export function mat4Decompose(value: Mat4Like): Mat4DecomposedTrs {
  const result: Mat4DecomposedTrs = {
    translation: mutableVec3(),
    rotation: mutableQuat(),
    scale: mutableVec3()
  };
  mat4DecomposeInto(value, result.translation, result.rotation, result.scale);
  return result;
}

export function mat4DecomposeInto(
  value: Mat4Like,
  translation: MutableVec3,
  rotation: MutableQuat,
  scale: MutableVec3
): void {
  let sx = Math.sqrt(value[0] * value[0] + value[1] * value[1] + value[2] * value[2]);
  const sy = Math.sqrt(value[4] * value[4] + value[5] * value[5] + value[6] * value[6]);
  const sz = Math.sqrt(value[8] * value[8] + value[9] * value[9] + value[10] * value[10]);

  if (mat4Determinant(value) < 0) {
    sx = -sx;
  }

  translation.x = value[12];
  translation.y = value[13];
  translation.z = value[14];

  scale.x = sx;
  scale.y = sy;
  scale.z = sz;

  const invSx = sx === 0 ? 0 : 1 / sx;
  const invSy = sy === 0 ? 0 : 1 / sy;
  const invSz = sz === 0 ? 0 : 1 / sz;

  const r00 = value[0] * invSx;
  const r10 = value[1] * invSx;
  const r20 = value[2] * invSx;
  const r01 = value[4] * invSy;
  const r11 = value[5] * invSy;
  const r21 = value[6] * invSy;
  const r02 = value[8] * invSz;
  const r12 = value[9] * invSz;
  const r22 = value[10] * invSz;

  const trace = r00 + r11 + r22;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    rotation.w = 0.25 / s;
    rotation.x = (r21 - r12) * s;
    rotation.y = (r02 - r20) * s;
    rotation.z = (r10 - r01) * s;
  } else if (r00 > r11 && r00 > r22) {
    const s = 2 * Math.sqrt(1 + r00 - r11 - r22);
    rotation.w = (r21 - r12) / s;
    rotation.x = 0.25 * s;
    rotation.y = (r01 + r10) / s;
    rotation.z = (r02 + r20) / s;
  } else if (r11 > r22) {
    const s = 2 * Math.sqrt(1 + r11 - r00 - r22);
    rotation.w = (r02 - r20) / s;
    rotation.x = (r01 + r10) / s;
    rotation.y = 0.25 * s;
    rotation.z = (r12 + r21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + r22 - r00 - r11);
    rotation.w = (r10 - r01) / s;
    rotation.x = (r02 + r20) / s;
    rotation.y = (r12 + r21) / s;
    rotation.z = 0.25 * s;
  }
}
