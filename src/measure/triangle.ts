import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { mutableVec3 } from "../core/vec3.js";

/**
 * Compute the (unit-length) normal of the triangle `(a, b, c)` using the
 * right-hand rule (`cross(b - a, c - a)`). Degenerate triangles where the
 * cross product is near-zero yield a zero normal.
 */
export function triangleNormal(a: Vec3, b: Vec3, c: Vec3): MutableVec3 {
  return triangleNormalInto(a, b, c, mutableVec3());
}

export function triangleNormalInto(a: Vec3, b: Vec3, c: Vec3, out: MutableVec3): MutableVec3 {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const ez = b.z - a.z;
  const fx = c.x - a.x;
  const fy = c.y - a.y;
  const fz = c.z - a.z;
  const nx = ey * fz - ez * fy;
  const ny = ez * fx - ex * fz;
  const nz = ex * fy - ey * fx;
  const lenSq = nx * nx + ny * ny + nz * nz;
  if (lenSq <= 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const invLen = 1 / Math.sqrt(lenSq);
  out.x = nx * invLen;
  out.y = ny * invLen;
  out.z = nz * invLen;
  return out;
}

/** Twice the area, useful when the caller wants to avoid the sqrt. */
export function triangleDoubleArea(a: Vec3, b: Vec3, c: Vec3): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const ez = b.z - a.z;
  const fx = c.x - a.x;
  const fy = c.y - a.y;
  const fz = c.z - a.z;
  const nx = ey * fz - ez * fy;
  const ny = ez * fx - ex * fz;
  const nz = ex * fy - ey * fx;
  return Math.sqrt(nx * nx + ny * ny + nz * nz);
}

export function triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
  return triangleDoubleArea(a, b, c) * 0.5;
}

/**
 * Barycentric coordinates (u, v, w) of `p` with respect to triangle `(a, b, c)`,
 * where the reconstructed point is `u*a + v*b + w*c` and `u + v + w == 1` for
 * coplanar inputs. For points off the triangle plane the values still sum to 1
 * but project the orthogonal component onto the plane via the standard Real-Time
 * Collision Detection formulation. Degenerate triangles return `(1, 0, 0)`.
 */
export function triangleBarycentric(a: Vec3, b: Vec3, c: Vec3, p: Vec3): MutableVec3 {
  return triangleBarycentricInto(a, b, c, p, mutableVec3());
}

export function triangleBarycentricInto(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  p: Vec3,
  out: MutableVec3
): MutableVec3 {
  const v0x = b.x - a.x;
  const v0y = b.y - a.y;
  const v0z = b.z - a.z;
  const v1x = c.x - a.x;
  const v1y = c.y - a.y;
  const v1z = c.z - a.z;
  const v2x = p.x - a.x;
  const v2y = p.y - a.y;
  const v2z = p.z - a.z;
  const d00 = v0x * v0x + v0y * v0y + v0z * v0z;
  const d01 = v0x * v1x + v0y * v1y + v0z * v1z;
  const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
  const d20 = v2x * v0x + v2y * v0y + v2z * v0z;
  const d21 = v2x * v1x + v2y * v1y + v2z * v1z;
  const denom = d00 * d11 - d01 * d01;
  if (denom === 0) {
    out.x = 1;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const invDenom = 1 / denom;
  const v = (d11 * d20 - d01 * d21) * invDenom;
  const w = (d00 * d21 - d01 * d20) * invDenom;
  out.x = 1 - v - w;
  out.y = v;
  out.z = w;
  return out;
}

/**
 * Closest point on triangle `(a, b, c)` to `p`. Voronoi-region implementation
 * from Christer Ericson, Real-Time Collision Detection (5.1.5).
 */
export function triangleClosestPoint(a: Vec3, b: Vec3, c: Vec3, p: Vec3): MutableVec3 {
  return triangleClosestPointInto(a, b, c, p, mutableVec3());
}

export function triangleClosestPointInto(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  p: Vec3,
  out: MutableVec3
): MutableVec3 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const apz = p.z - a.z;

  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) {
    out.x = a.x;
    out.y = a.y;
    out.z = a.z;
    return out;
  }

  const bpx = p.x - b.x;
  const bpy = p.y - b.y;
  const bpz = p.z - b.z;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) {
    out.x = b.x;
    out.y = b.y;
    out.z = b.z;
    return out;
  }

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out.x = a.x + abx * v;
    out.y = a.y + aby * v;
    out.z = a.z + abz * v;
    return out;
  }

  const cpx = p.x - c.x;
  const cpy = p.y - c.y;
  const cpz = p.z - c.z;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) {
    out.x = c.x;
    out.y = c.y;
    out.z = c.z;
    return out;
  }

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out.x = a.x + acx * w;
    out.y = a.y + acy * w;
    out.z = a.z + acz * w;
    return out;
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    out.x = b.x + (c.x - b.x) * w;
    out.y = b.y + (c.y - b.y) * w;
    out.z = b.z + (c.z - b.z) * w;
    return out;
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  out.x = a.x + abx * v + acx * w;
  out.y = a.y + aby * v + acy * w;
  out.z = a.z + abz * v + acz * w;
  return out;
}
