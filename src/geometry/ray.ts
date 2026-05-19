import type { Aabb } from "./aabb.js";
import type { Capsule } from "./capsule.js";
import type { Obb } from "./obb.js";
import type { Plane } from "./plane.js";
import { planeDistanceToPoint } from "./plane.js";
import type { Sphere } from "./sphere.js";
import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { cross3, dot3, mutableVec3, scaleAndAdd3Into, sub3 } from "../core/vec3.js";

export interface Ray {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

export interface RayHit {
  readonly distance: number;
  readonly point: Vec3;
  readonly normal?: Vec3;
}

export interface RayTriangleHit extends RayHit {
  readonly barycentric: Vec3;
  readonly frontFace: boolean;
}

export function ray(origin: Vec3, direction: Vec3): Ray {
  return {
    origin: {
      x: origin.x,
      y: origin.y,
      z: origin.z
    },
    direction: {
      x: direction.x,
      y: direction.y,
      z: direction.z
    }
  };
}

export function rayAt(value: Ray, t: number): Vec3 {
  return rayAtInto(value, t, mutableVec3());
}

export function rayAtInto(value: Ray, t: number, out: MutableVec3): MutableVec3 {
  return scaleAndAdd3Into(value.origin, value.direction, t, out);
}

export function rayPlaneHitDistance(value: Ray, hitPlane: Plane): number | null {
  const denominator = dot3(hitPlane.normal, value.direction);

  if (denominator === 0) {
    return planeDistanceToPoint(hitPlane, value.origin) === 0 ? 0 : null;
  }

  const t = -planeDistanceToPoint(hitPlane, value.origin) / denominator;
  return t >= 0 ? t : null;
}

export function rayIntersectsPlane(value: Ray, hitPlane: Plane): boolean {
  return rayPlaneHitDistance(value, hitPlane) !== null;
}

export function rayPlaneHit(value: Ray, hitPlane: Plane): RayHit | null {
  const distance = rayPlaneHitDistance(value, hitPlane);

  if (distance === null) {
    return null;
  }

  return {
    distance,
    point: rayAt(value, distance),
    normal: {
      x: hitPlane.normal.x,
      y: hitPlane.normal.y,
      z: hitPlane.normal.z
    }
  };
}

export function rayAabbHitDistance(value: Ray, box: Aabb): number | null {
  let tmin: number;
  let tmax: number;
  let tymin: number;
  let tymax: number;
  let tzmin: number;
  let tzmax: number;

  const origin = value.origin;
  const direction = value.direction;
  const min = box.min;
  const max = box.max;
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;
  const invDirX = 1 / direction.x;
  const invDirY = 1 / direction.y;
  const invDirZ = 1 / direction.z;

  if (invDirX >= 0) {
    tmin = (min.x - ox) * invDirX;
    tmax = (max.x - ox) * invDirX;
  } else {
    tmin = (max.x - ox) * invDirX;
    tmax = (min.x - ox) * invDirX;
  }

  if (invDirY >= 0) {
    tymin = (min.y - oy) * invDirY;
    tymax = (max.y - oy) * invDirY;
  } else {
    tymin = (max.y - oy) * invDirY;
    tymax = (min.y - oy) * invDirY;
  }

  if (tmin > tymax || tymin > tmax) {
    return null;
  }

  if (tymin > tmin || tmin !== tmin) {
    tmin = tymin;
  }

  if (tymax < tmax || tmax !== tmax) {
    tmax = tymax;
  }

  if (invDirZ >= 0) {
    tzmin = (min.z - oz) * invDirZ;
    tzmax = (max.z - oz) * invDirZ;
  } else {
    tzmin = (max.z - oz) * invDirZ;
    tzmax = (min.z - oz) * invDirZ;
  }

  if (tmin > tzmax || tzmin > tmax) {
    return null;
  }

  if (tzmin > tmin || tmin !== tmin) {
    tmin = tzmin;
  }

  if (tzmax < tmax || tmax !== tmax) {
    tmax = tzmax;
  }

  if (tmax < 0) {
    return null;
  }

  return tmin >= 0 ? tmin : tmax;
}

export function rayIntersectsAabb(value: Ray, box: Aabb): boolean {
  return rayAabbHitDistance(value, box) !== null;
}

export function rayAabbHit(value: Ray, box: Aabb): RayHit | null {
  const distance = rayAabbHitDistance(value, box);

  if (distance === null) {
    return null;
  }

  return {
    distance,
    point: rayAt(value, distance)
  };
}

export function raySphereHitDistance(value: Ray, hitSphere: Sphere): number | null {
  if (hitSphere.radius < 0) {
    return null;
  }

  const l = sub3(hitSphere.center, value.origin);
  const tca = dot3(l, value.direction);
  const d2 = dot3(l, l) - tca * tca;
  const radiusSq = hitSphere.radius * hitSphere.radius;

  if (d2 > radiusSq) {
    return null;
  }

  const thc = Math.sqrt(radiusSq - d2);
  const t0 = tca - thc;
  const t1 = tca + thc;

  if (t1 < 0) {
    return null;
  }

  return t0 >= 0 ? t0 : t1;
}

export function raySphereHit(value: Ray, hitSphere: Sphere): RayHit | null {
  const distance = raySphereHitDistance(value, hitSphere);

  if (distance === null) {
    return null;
  }

  const point = rayAt(value, distance);
  const normal = mutableVec3(
    point.x - hitSphere.center.x,
    point.y - hitSphere.center.y,
    point.z - hitSphere.center.z
  );
  const lenSq = dot3(normal, normal);

  if (lenSq > 0) {
    const invLen = 1 / Math.sqrt(lenSq);
    normal.x *= invLen;
    normal.y *= invLen;
    normal.z *= invLen;
  }

  return {
    distance,
    point,
    normal
  };
}

export function rayIntersectsSphere(value: Ray, hitSphere: Sphere): boolean {
  return raySphereHitDistance(value, hitSphere) !== null;
}

export function rayTriangleHitDistance(value: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
  const hit = rayTriangleHit(value, a, b, c);
  return hit ? hit.distance : null;
}

export function rayTriangleHit(value: Ray, a: Vec3, b: Vec3, c: Vec3): RayTriangleHit | null {
  const edge1 = sub3(b, a);
  const edge2 = sub3(c, a);
  const pvec = cross3(value.direction, edge2);
  const det = dot3(edge1, pvec);

  if (det === 0) {
    return null;
  }

  const invDet = 1 / det;
  const tvec = sub3(value.origin, a);
  const u = dot3(tvec, pvec) * invDet;

  if (u < 0 || u > 1) {
    return null;
  }

  const qvec = cross3(tvec, edge1);
  const v = dot3(value.direction, qvec) * invDet;

  if (v < 0 || u + v > 1) {
    return null;
  }

  const distance = dot3(edge2, qvec) * invDet;

  if (distance < 0) {
    return null;
  }

  const crossed = cross3(edge1, edge2);
  const normal = mutableVec3(crossed.x, crossed.y, crossed.z);
  const normalLenSq = dot3(normal, normal);

  if (normalLenSq > 0) {
    const invNormalLen = 1 / Math.sqrt(normalLenSq);
    normal.x *= invNormalLen;
    normal.y *= invNormalLen;
    normal.z *= invNormalLen;
  }

  return {
    distance,
    point: rayAt(value, distance),
    normal,
    barycentric: {
      x: 1 - u - v,
      y: u,
      z: v
    },
    frontFace: det < 0
  };
}

/**
 * Ray vs OBB. Transforms the ray into the OBB's local frame and runs the
 * standard slab test against the local-space axis-aligned half-box
 * `[-extents, +extents]`. The transform is a pure rotation + translation so
 * the returned `t` is the same distance the caller measures in world space.
 *
 * Only hits with `t >= 0` are reported.
 */
export function rayObbHitDistance(value: Ray, box: Obb): number | null {
  const r = box.rotation;
  const dx = value.origin.x - box.center.x;
  const dy = value.origin.y - box.center.y;
  const dz = value.origin.z - box.center.z;
  // Local origin: R^T · (origin - center). Column-major: R^T row i = column i.
  const ox = r[0] * dx + r[1] * dy + r[2] * dz;
  const oy = r[3] * dx + r[4] * dy + r[5] * dz;
  const oz = r[6] * dx + r[7] * dy + r[8] * dz;
  // Local direction: R^T · direction.
  const dirX = value.direction.x;
  const dirY = value.direction.y;
  const dirZ = value.direction.z;
  const lx = r[0] * dirX + r[1] * dirY + r[2] * dirZ;
  const ly = r[3] * dirX + r[4] * dirY + r[5] * dirZ;
  const lz = r[6] * dirX + r[7] * dirY + r[8] * dirZ;

  return slabIntersect(
    ox, oy, oz,
    lx, ly, lz,
    -box.extents.x, -box.extents.y, -box.extents.z,
    box.extents.x, box.extents.y, box.extents.z
  );
}

export function rayIntersectsObb(value: Ray, box: Obb): boolean {
  return rayObbHitDistance(value, box) !== null;
}

export function rayObbHit(value: Ray, box: Obb): RayHit | null {
  const distance = rayObbHitDistance(value, box);
  if (distance === null) {
    return null;
  }
  return {
    distance,
    point: rayAt(value, distance)
  };
}

/**
 * Ray vs capsule. Tests against the infinite cylinder around the capsule's
 * segment, clipped to the segment extent, and the two hemispherical end
 * caps. Returns the smallest non-negative `t` of any candidate.
 *
 * Degenerate capsule (segment length squared near zero) falls through to a
 * sphere test. Negative radius returns `null` consistent with sphere
 * semantics.
 */
export function rayCapsuleHitDistance(value: Ray, target: Capsule): number | null {
  if (target.radius < 0) {
    return null;
  }
  const r = target.radius;
  const r2 = r * r;
  const p0 = target.point0;
  const p1 = target.point1;
  const axisX = p1.x - p0.x;
  const axisY = p1.y - p0.y;
  const axisZ = p1.z - p0.z;
  const axisLenSq = axisX * axisX + axisY * axisY + axisZ * axisZ;

  if (axisLenSq < 1e-12) {
    // Collapse to a sphere at p0.
    return raySphereHitDistanceFromComponents(value, p0.x, p0.y, p0.z, r);
  }

  const ox = value.origin.x - p0.x;
  const oy = value.origin.y - p0.y;
  const oz = value.origin.z - p0.z;
  const dx = value.direction.x;
  const dy = value.direction.y;
  const dz = value.direction.z;

  const dDotAxis = dx * axisX + dy * axisY + dz * axisZ;
  const oDotAxis = ox * axisX + oy * axisY + oz * axisZ;
  const invAxisLenSq = 1 / axisLenSq;
  const m = dDotAxis * invAxisLenSq;
  const n = oDotAxis * invAxisLenSq;

  // Perpendicular components in the plane orthogonal to the axis.
  const qx = dx - axisX * m;
  const qy = dy - axisY * m;
  const qz = dz - axisZ * m;
  const wx = ox - axisX * n;
  const wy = oy - axisY * n;
  const wz = oz - axisZ * n;

  const A = qx * qx + qy * qy + qz * qz;
  const B = 2 * (qx * wx + qy * wy + qz * wz);
  const C = wx * wx + wy * wy + wz * wz - r2;

  let best = Number.POSITIVE_INFINITY;

  if (A > 1e-12) {
    const disc = B * B - 4 * A * C;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const inv2A = 1 / (2 * A);
      const tCandidate0 = (-B - sqrtDisc) * inv2A;
      const tCandidate1 = (-B + sqrtDisc) * inv2A;
      // Validate that the hit point falls within the segment extent.
      if (tCandidate0 >= 0) {
        const s = n + tCandidate0 * m;
        if (s >= 0 && s <= 1 && tCandidate0 < best) {
          best = tCandidate0;
        }
      }
      if (tCandidate1 >= 0) {
        const s = n + tCandidate1 * m;
        if (s >= 0 && s <= 1 && tCandidate1 < best) {
          best = tCandidate1;
        }
      }
    }
  }

  // Hemisphere at p0: accept only when the hit point is on the p0 side
  // (s <= 0 in segment parameter space). Same for p1 (s >= 1).
  const t0 = raySphereHitDistanceFromComponents(value, p0.x, p0.y, p0.z, r);
  if (t0 !== null && t0 < best) {
    const s = n + t0 * m;
    if (s <= 0) {
      best = t0;
    }
  }
  const t1 = raySphereHitDistanceFromComponents(value, p1.x, p1.y, p1.z, r);
  if (t1 !== null && t1 < best) {
    const s = n + t1 * m;
    if (s >= 1) {
      best = t1;
    }
  }

  return best === Number.POSITIVE_INFINITY ? null : best;
}

export function rayIntersectsCapsule(value: Ray, target: Capsule): boolean {
  return rayCapsuleHitDistance(value, target) !== null;
}

export function rayCapsuleHit(value: Ray, target: Capsule): RayHit | null {
  const distance = rayCapsuleHitDistance(value, target);
  if (distance === null) {
    return null;
  }
  return {
    distance,
    point: rayAt(value, distance)
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Slab intersection on an axis-aligned box `[minX..maxX]^3`. Returns the
 * nearest non-negative `t` along the ray, or `null` if it misses or only
 * intersects behind the origin. Shared by world-space AABB and OBB-local
 * tests.
 */
function slabIntersect(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number
): number | null {
  const invDx = 1 / dx;
  const invDy = 1 / dy;
  const invDz = 1 / dz;

  let tmin: number;
  let tmax: number;
  if (invDx >= 0) {
    tmin = (minX - ox) * invDx;
    tmax = (maxX - ox) * invDx;
  } else {
    tmin = (maxX - ox) * invDx;
    tmax = (minX - ox) * invDx;
  }

  let tymin: number;
  let tymax: number;
  if (invDy >= 0) {
    tymin = (minY - oy) * invDy;
    tymax = (maxY - oy) * invDy;
  } else {
    tymin = (maxY - oy) * invDy;
    tymax = (minY - oy) * invDy;
  }

  if (tmin > tymax || tymin > tmax) return null;
  if (tymin > tmin || tmin !== tmin) tmin = tymin;
  if (tymax < tmax || tmax !== tmax) tmax = tymax;

  let tzmin: number;
  let tzmax: number;
  if (invDz >= 0) {
    tzmin = (minZ - oz) * invDz;
    tzmax = (maxZ - oz) * invDz;
  } else {
    tzmin = (maxZ - oz) * invDz;
    tzmax = (minZ - oz) * invDz;
  }

  if (tmin > tzmax || tzmin > tmax) return null;
  if (tzmin > tmin || tmin !== tmin) tmin = tzmin;
  if (tzmax < tmax || tmax !== tmax) tmax = tzmax;

  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : tmax;
}

/**
 * Component-form sphere hit so callers can avoid allocating a Sphere object
 * inside hot loops (notably the capsule test).
 */
function raySphereHitDistanceFromComponents(
  value: Ray,
  cx: number,
  cy: number,
  cz: number,
  radius: number
): number | null {
  if (radius < 0) return null;
  const lx = cx - value.origin.x;
  const ly = cy - value.origin.y;
  const lz = cz - value.origin.z;
  const tca = lx * value.direction.x + ly * value.direction.y + lz * value.direction.z;
  const lDotL = lx * lx + ly * ly + lz * lz;
  const d2 = lDotL - tca * tca;
  const radiusSq = radius * radius;
  if (d2 > radiusSq) return null;
  const thc = Math.sqrt(radiusSq - d2);
  const t0 = tca - thc;
  const t1 = tca + thc;
  if (t1 < 0) return null;
  return t0 >= 0 ? t0 : t1;
}
