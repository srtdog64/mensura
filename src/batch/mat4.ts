import type { Mat4Like } from "../core/mat4.js";
import type { MutableVec3, Vec3 } from "../core/vec3.js";

export function mat4TransformAffinePoint3IntoMany(
  matrix: Mat4Like,
  points: ArrayLike<Vec3>,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  // Hoist the shared matrix columns once per batch. This is intentionally
  // verbose: local scalar bindings let V8 keep the matrix lanes out of the
  // inner point loop and are the measured reason this batch path beats a
  // scalar `affinePoint3Into` loop.
  const xAxisX = matrix[0];
  const xAxisY = matrix[1];
  const xAxisZ = matrix[2];
  const yAxisX = matrix[4];
  const yAxisY = matrix[5];
  const yAxisZ = matrix[6];
  const zAxisX = matrix[8];
  const zAxisY = matrix[9];
  const zAxisZ = matrix[10];
  const originX = matrix[12];
  const originY = matrix[13];
  const originZ = matrix[14];

  for (let i = 0; i < count; i++) {
    const p = points[i];
    const x = p.x;
    const y = p.y;
    const z = p.z;
    const vo = out[i];
    vo.x = xAxisX * x + yAxisX * y + zAxisX * z + originX;
    vo.y = xAxisY * x + yAxisY * y + zAxisY * z + originY;
    vo.z = xAxisZ * x + yAxisZ * y + zAxisZ * z + originZ;
  }
  return out;
}

export function mat4TransformPoint3IntoMany(
  matrix: Mat4Like,
  points: ArrayLike<Vec3>,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  // Same matrix-hoist pattern as the affine batch, but include the perspective
  // row and w divide. Do not replace this with a helper call unless the
  // benchmark still proves V8 can inline it.
  const xAxisX = matrix[0];
  const xAxisY = matrix[1];
  const xAxisZ = matrix[2];
  const xAxisW = matrix[3];
  const yAxisX = matrix[4];
  const yAxisY = matrix[5];
  const yAxisZ = matrix[6];
  const yAxisW = matrix[7];
  const zAxisX = matrix[8];
  const zAxisY = matrix[9];
  const zAxisZ = matrix[10];
  const zAxisW = matrix[11];
  const originX = matrix[12];
  const originY = matrix[13];
  const originZ = matrix[14];
  const originW = matrix[15];

  for (let i = 0; i < count; i++) {
    const p = points[i];
    const x = p.x;
    const y = p.y;
    const z = p.z;
    const w = xAxisW * x + yAxisW * y + zAxisW * z + originW;
    const invW = w === 0 ? 1 : 1 / w;
    const vo = out[i];
    vo.x = (xAxisX * x + yAxisX * y + zAxisX * z + originX) * invW;
    vo.y = (xAxisY * x + yAxisY * y + zAxisY * z + originY) * invW;
    vo.z = (xAxisZ * x + yAxisZ * y + zAxisZ * z + originZ) * invW;
  }
  return out;
}

export function mat4TransformDirection3IntoMany(
  matrix: Mat4Like,
  directions: ArrayLike<Vec3>,
  out: ArrayLike<MutableVec3>,
  count: number
): ArrayLike<MutableVec3> {
  // Direction vectors ignore translation and perspective. Keeping this as a
  // separate kernel avoids branch checks inside the point transform loop.
  const xAxisX = matrix[0];
  const xAxisY = matrix[1];
  const xAxisZ = matrix[2];
  const yAxisX = matrix[4];
  const yAxisY = matrix[5];
  const yAxisZ = matrix[6];
  const zAxisX = matrix[8];
  const zAxisY = matrix[9];
  const zAxisZ = matrix[10];

  for (let i = 0; i < count; i++) {
    const d = directions[i];
    const x = d.x;
    const y = d.y;
    const z = d.z;
    const vo = out[i];
    vo.x = xAxisX * x + yAxisX * y + zAxisX * z;
    vo.y = xAxisY * x + yAxisY * y + zAxisY * z;
    vo.z = xAxisZ * x + yAxisZ * y + zAxisZ * z;
  }
  return out;
}
