import type { Vec4, MutableVec4 } from "./vec4.js";
import { vec4, mutableVec4, copy4, copy4Into, length4, dot4 } from "./vec4.js";
import type { Mat3Like } from "./mat3.js";
import type { Vec3 } from "./vec3.js";
import { type Result, err, mensuraError, ok } from "./result.js";

export const QUAT_SLERP_LINEAR_THRESHOLD = 0.9995;
const QUAT_PARALLEL_EPSILON = 1e-8;

export type Quat = Vec4;
export type MutableQuat = MutableVec4;

export const QUAT_IDENTITY: Quat = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

export function quat(x: number, y: number, z: number, w: number): Quat {
  return vec4(x, y, z, w);
}

export function mutableQuat(x: number = 0, y: number = 0, z: number = 0, w: number = 1): MutableQuat {
  return mutableVec4(x, y, z, w);
}

export function quatIdentity(): MutableQuat {
  return mutableVec4(0, 0, 0, 1);
}

export function quatIdentityInto(out: MutableQuat): MutableQuat {
  out.x = 0;
  out.y = 0;
  out.z = 0;
  out.w = 1;
  return out;
}

export function quatCopy(value: Quat): Quat {
  return copy4(value);
}

export function quatCopyInto(value: Quat, out: MutableQuat): MutableQuat {
  return copy4Into(value, out);
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return quatMultiplyInto(a, b, mutableQuat());
}

export function quatMultiplyInto(a: Quat, b: Quat, out: MutableQuat): MutableQuat {
  const ax = a.x, ay = a.y, az = a.z, aw = a.w;
  const bx = b.x, by = b.y, bz = b.z, bw = b.w;

  out.x = ax * bw + aw * bx + ay * bz - az * by;
  out.y = ay * bw + aw * by + az * bx - ax * bz;
  out.z = az * bw + aw * bz + ax * by - ay * bx;
  out.w = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

export function quatInvert(value: Quat): Quat {
  return quatInvertInto(value, mutableQuat());
}

export function quatInvertInto(value: Quat, out: MutableQuat): MutableQuat {
  const dot = dot4(value, value);
  const invDot = dot ? 1.0 / dot : 0;
  
  out.x = -value.x * invDot;
  out.y = -value.y * invDot;
  out.z = -value.z * invDot;
  out.w = value.w * invDot;
  return out;
}

export function quatNormalize(value: Quat): Quat {
  return quatNormalizeInto(value, mutableQuat());
}

export function quatNormalizeInto(value: Quat, out: MutableQuat): MutableQuat {
  const len = length4(value);
  if (len > 0) {
    const invLen = 1 / len;
    out.x = value.x * invLen;
    out.y = value.y * invLen;
    out.z = value.z * invLen;
    out.w = value.w * invLen;
  } else {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    out.w = 1;
  }
  return out;
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  return quatSlerpInto(a, b, t, mutableQuat());
}

export function quatSlerpInto(a: Quat, b: Quat, t: number, out: MutableQuat): MutableQuat {
  const ax = a.x, ay = a.y, az = a.z, aw = a.w;
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;

  let cosHalfTheta = ax * bx + ay * by + az * bz + aw * bw;

  if (cosHalfTheta < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    cosHalfTheta = -cosHalfTheta;
  }

  if (cosHalfTheta > QUAT_SLERP_LINEAR_THRESHOLD) {
    const lx = ax + t * (bx - ax);
    const ly = ay + t * (by - ay);
    const lz = az + t * (bz - az);
    const lw = aw + t * (bw - aw);
    const invLen = 1 / Math.sqrt(lx * lx + ly * ly + lz * lz + lw * lw);
    out.x = lx * invLen;
    out.y = ly * invLen;
    out.z = lz * invLen;
    out.w = lw * invLen;
    return out;
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  out.x = ax * ratioA + bx * ratioB;
  out.y = ay * ratioA + by * ratioB;
  out.z = az * ratioA + bz * ratioB;
  out.w = aw * ratioA + bw * ratioB;
  return out;
}

export function quatConjugate(value: Quat): MutableQuat {
  return quatConjugateInto(value, mutableQuat());
}

export function quatConjugateInto(value: Quat, out: MutableQuat): MutableQuat {
  out.x = -value.x;
  out.y = -value.y;
  out.z = -value.z;
  out.w = value.w;
  return out;
}

export function quatFromRotationMatrix3(matrix: Mat3Like): MutableQuat {
  return quatFromRotationMatrix3Into(matrix, mutableQuat());
}

export function quatFromRotationMatrix3Into(matrix: Mat3Like, out: MutableQuat): MutableQuat {
  const r00 = matrix[0], r10 = matrix[1], r20 = matrix[2];
  const r01 = matrix[3], r11 = matrix[4], r21 = matrix[5];
  const r02 = matrix[6], r12 = matrix[7], r22 = matrix[8];

  const trace = r00 + r11 + r22;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    out.w = 0.25 / s;
    out.x = (r21 - r12) * s;
    out.y = (r02 - r20) * s;
    out.z = (r10 - r01) * s;
    return out;
  }

  if (r00 > r11 && r00 > r22) {
    const s = 2 * Math.sqrt(1 + r00 - r11 - r22);
    out.w = (r21 - r12) / s;
    out.x = 0.25 * s;
    out.y = (r01 + r10) / s;
    out.z = (r02 + r20) / s;
    return out;
  }

  if (r11 > r22) {
    const s = 2 * Math.sqrt(1 + r11 - r00 - r22);
    out.w = (r02 - r20) / s;
    out.x = (r01 + r10) / s;
    out.y = 0.25 * s;
    out.z = (r12 + r21) / s;
    return out;
  }

  const s = 2 * Math.sqrt(1 + r22 - r00 - r11);
  out.w = (r10 - r01) / s;
  out.x = (r02 + r20) / s;
  out.y = (r12 + r21) / s;
  out.z = 0.25 * s;
  return out;
}

export function quatFromUnitVectors(from: Vec3, to: Vec3): Result<MutableQuat> {
  return quatFromUnitVectorsInto(from, to, mutableQuat());
}

export function quatFromUnitVectorsInto(from: Vec3, to: Vec3, out: MutableQuat): Result<MutableQuat> {
  const dot = from.x * to.x + from.y * to.y + from.z * to.z;

  if (dot > 1 - QUAT_PARALLEL_EPSILON) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    out.w = 1;
    return ok(out);
  }

  if (dot < -1 + QUAT_PARALLEL_EPSILON) {
    let ax: number;
    let ay: number;
    let az: number;

    if (Math.abs(from.x) > Math.abs(from.z)) {
      ax = -from.y;
      ay = from.x;
      az = 0;
    } else {
      ax = 0;
      ay = -from.z;
      az = from.y;
    }

    const len = Math.sqrt(ax * ax + ay * ay + az * az);

    if (len === 0) {
      return err(mensuraError({
        code: "TRANSFORM_DEGENERATE_BASIS",
        stage: "Transform",
        message: "Cannot find orthogonal axis for anti-parallel unit vectors.",
        meta: { from, to }
      }));
    }

    const invLen = 1 / len;
    out.x = ax * invLen;
    out.y = ay * invLen;
    out.z = az * invLen;
    out.w = 0;
    return ok(out);
  }

  const cx = from.y * to.z - from.z * to.y;
  const cy = from.z * to.x - from.x * to.z;
  const cz = from.x * to.y - from.y * to.x;
  const w = 1 + dot;
  const invLen = 1 / Math.sqrt(cx * cx + cy * cy + cz * cz + w * w);

  out.x = cx * invLen;
  out.y = cy * invLen;
  out.z = cz * invLen;
  out.w = w * invLen;
  return ok(out);
}
