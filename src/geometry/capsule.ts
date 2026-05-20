import type { Vec3, MutableVec3 } from "../core/vec3.js";
import { vec3, copy3, copy3Into, mutableVec3 } from "../core/vec3.js";
import type { MutableAabb } from "./aabb.js";
import { mutableAabb } from "./aabb.js";
import type { Sphere } from "./sphere.js";

export interface Capsule {
  readonly point0: Vec3;
  readonly point1: Vec3;
  readonly radius: number;
}

export interface MutableCapsule {
  point0: MutableVec3;
  point1: MutableVec3;
  radius: number;
}

export interface CapsuleSegmentClosestPoints {
  readonly point0: Vec3;
  readonly point1: Vec3;
}

export interface MutableCapsuleSegmentClosestPoints {
  point0: MutableVec3;
  point1: MutableVec3;
}

export interface CapsuleCapsuleContact {
  readonly distance: number;
  readonly signedDistance: number;
  readonly intersects: boolean;
  readonly surfacePoint0: Vec3;
  readonly surfacePoint1: Vec3;
  readonly normal: Vec3;
}

export interface MutableCapsuleCapsuleContact {
  distance: number;
  signedDistance: number;
  intersects: boolean;
  surfacePoint0: MutableVec3;
  surfacePoint1: MutableVec3;
  normal: MutableVec3;
}

export function capsule(point0: Vec3, point1: Vec3, radius: number): Capsule {
  return {
    point0: copy3(point0),
    point1: copy3(point1),
    radius
  };
}

export function mutableCapsule(point0?: Vec3, point1?: Vec3, radius: number = 1): MutableCapsule {
  return {
    point0: point0 ? copy3(point0) : vec3(0, -1, 0),
    point1: point1 ? copy3(point1) : vec3(0, 1, 0),
    radius
  };
}

export function copyCapsule(value: Capsule): Capsule {
  return capsule(value.point0, value.point1, value.radius);
}

export function copyCapsuleInto(value: Capsule, out: MutableCapsule): MutableCapsule {
  copy3Into(value.point0, out.point0);
  copy3Into(value.point1, out.point1);
  out.radius = value.radius;
  return out;
}

/**
 * Squared distance from `point` to the capsule's segment (point0..point1).
 * Useful for branch-free contains/intersects predicates that avoid the sqrt.
 */
export function capsuleSegmentDistanceSqToPoint(value: Capsule, point: Vec3): number {
  const ax = value.point0.x;
  const ay = value.point0.y;
  const az = value.point0.z;
  const bx = value.point1.x;
  const by = value.point1.y;
  const bz = value.point1.z;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const segLenSq = dx * dx + dy * dy + dz * dz;
  const px = point.x - ax;
  const py = point.y - ay;
  const pz = point.z - az;
  let t = segLenSq > 0 ? (px * dx + py * dy + pz * dz) / segLenSq : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + dx * t - point.x;
  const cy = ay + dy * t - point.y;
  const cz = az + dz * t - point.z;
  return cx * cx + cy * cy + cz * cz;
}

export function capsuleContainsPoint(value: Capsule, point: Vec3): boolean {
  if (value.radius < 0) {
    return false;
  }
  return capsuleSegmentDistanceSqToPoint(value, point) <= value.radius * value.radius;
}

export function capsuleIntersectsSphere(value: Capsule, target: Sphere): boolean {
  if (value.radius < 0 || target.radius < 0) {
    return false;
  }
  const r = value.radius + target.radius;
  return capsuleSegmentDistanceSqToPoint(value, target.center) <= r * r;
}

/**
 * Axis-aligned bounding box that fully contains the capsule. Computed as the
 * componentwise min/max of the two end caps' bounding boxes.
 */
export function capsuleGetAabb(value: Capsule): MutableAabb {
  return capsuleGetAabbInto(value, mutableAabb());
}

export function capsuleGetAabbInto(value: Capsule, out: MutableAabb): MutableAabb {
  const r = value.radius;
  const p0 = value.point0;
  const p1 = value.point1;
  out.min.x = Math.min(p0.x, p1.x) - r;
  out.min.y = Math.min(p0.y, p1.y) - r;
  out.min.z = Math.min(p0.z, p1.z) - r;
  out.max.x = Math.max(p0.x, p1.x) + r;
  out.max.y = Math.max(p0.y, p1.y) + r;
  out.max.z = Math.max(p0.z, p1.z) + r;
  return out;
}

/**
 * Closest points on the two capsule segments (interior axis points, not
 * surface points). Allocates a fresh `MutableCapsuleSegmentClosestPoints`;
 * prefer `capsuleCapsuleClosestPointsInto` in hot loops.
 */
export function capsuleCapsuleClosestPoints(a: Capsule, b: Capsule): MutableCapsuleSegmentClosestPoints {
  return capsuleCapsuleClosestPointsInto(a, b, {
    point0: mutableVec3(),
    point1: mutableVec3()
  });
}

export function capsuleCapsuleClosestPointsInto(
  a: Capsule,
  b: Capsule,
  out: MutableCapsuleSegmentClosestPoints
): MutableCapsuleSegmentClosestPoints {
  closestPointsOnSegmentsInto(a.point0, a.point1, b.point0, b.point1, out.point0, out.point1);
  return out;
}

/**
 * Surface distance between two capsules. Intersecting or touching capsules
 * return `0`. Negative-radius capsules are empty and return `+Infinity`.
 *
 * Hot-path safe: computes the axis distance via `segmentSegmentDistanceSq`
 * without allocating an intermediate closest-points object.
 */
export function capsuleCapsuleDistance(a: Capsule, b: Capsule): number {
  const signed = capsuleCapsuleSignedDistance(a, b);
  return signed === Number.POSITIVE_INFINITY ? signed : Math.max(0, signed);
}

/**
 * Signed surface distance between two capsules. Negative means overlap, zero
 * means touching boundary, positive means a separating gap. Negative-radius
 * capsules return `+Infinity`.
 *
 * Hot-path safe: no allocation. The axis distance is computed inline so
 * callers can use this in stress loops without churning intermediate
 * objects.
 */
export function capsuleCapsuleSignedDistance(a: Capsule, b: Capsule): number {
  if (a.radius < 0 || b.radius < 0) {
    return Number.POSITIVE_INFINITY;
  }
  const axisDistanceSq = segmentSegmentDistanceSq(a.point0, a.point1, b.point0, b.point1);
  return Math.sqrt(axisDistanceSq) - (a.radius + b.radius);
}

/**
 * Build a fresh `MutableCapsuleCapsuleContact` populated with the contact
 * description. Allocates 3 vec3 + the wrapper; prefer
 * `capsuleCapsuleContactInto` in hot loops.
 */
export function capsuleCapsuleContact(a: Capsule, b: Capsule): MutableCapsuleCapsuleContact | null {
  const surfacePoint0 = mutableVec3();
  const surfacePoint1 = mutableVec3();
  return capsuleCapsuleContactInto(a, b, {
    distance: 0,
    signedDistance: 0,
    intersects: false,
    surfacePoint0,
    surfacePoint1,
    normal: mutableVec3()
  });
}

/**
 * Compute the capsule-capsule contact data into a caller-owned struct.
 *
 * `intersects` follows the **inclusive boundary** convention used by SAT and
 * the rest of the geometry layer: touching capsules report `intersects =
 * true`. This is **the opposite** of the strict-positive convention used by
 * `gjk`/`mprIntersect`, where exact touching reports `intersect = false`.
 *
 * `surfacePoint0` and `surfacePoint1` are the final capsule-surface witness
 * points. Segment-axis closest points are available from
 * `capsuleCapsuleClosestPoints`; they are intentionally not overloaded here.
 */
export function capsuleCapsuleContactInto(
  a: Capsule,
  b: Capsule,
  out: MutableCapsuleCapsuleContact
): MutableCapsuleCapsuleContact | null {
  if (a.radius < 0 || b.radius < 0) {
    return null;
  }

  const surfacePoint0 = out.surfacePoint0;
  const surfacePoint1 = out.surfacePoint1;
  closestPointsOnSegmentsInto(a.point0, a.point1, b.point0, b.point1, surfacePoint0, surfacePoint1);
  let nx = surfacePoint1.x - surfacePoint0.x;
  let ny = surfacePoint1.y - surfacePoint0.y;
  let nz = surfacePoint1.z - surfacePoint0.z;
  const axisDistanceSq = nx * nx + ny * ny + nz * nz;
  if (axisDistanceSq > 0) {
    const invAxisDistance = 1 / Math.sqrt(axisDistanceSq);
    nx *= invAxisDistance;
    ny *= invAxisDistance;
    nz *= invAxisDistance;
  } else {
    nx = 1;
    ny = 0;
    nz = 0;
  }

  const axisDistance = Math.sqrt(axisDistanceSq);
  const signedDistance = axisDistance - (a.radius + b.radius);
  out.distance = Math.max(0, signedDistance);
  out.signedDistance = signedDistance;
  // Inclusive boundary: touching capsules count as intersecting. See doc.
  out.intersects = signedDistance <= 0;
  out.normal.x = nx;
  out.normal.y = ny;
  out.normal.z = nz;
  surfacePoint0.x += nx * a.radius;
  surfacePoint0.y += ny * a.radius;
  surfacePoint0.z += nz * a.radius;
  surfacePoint1.x -= nx * b.radius;
  surfacePoint1.y -= ny * b.radius;
  surfacePoint1.z -= nz * b.radius;
  return out;
}

/**
 * Squared axis distance between two segments without writing closest points.
 * Used by `capsuleCapsuleSignedDistance` to avoid the allocation that
 * `*ClosestPoints` would force.
 */
function segmentSegmentDistanceSq(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): number {
  const d1x = a1.x - a0.x;
  const d1y = a1.y - a0.y;
  const d1z = a1.z - a0.z;
  const d2x = b1.x - b0.x;
  const d2y = b1.y - b0.y;
  const d2z = b1.z - b0.z;
  const rx = a0.x - b0.x;
  const ry = a0.y - b0.y;
  const rz = a0.z - b0.z;
  const aLen = d1x * d1x + d1y * d1y + d1z * d1z;
  const bLen = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  // Squared-length guard for degenerate segments. This is local to the
  // segment solver; public input validation belongs to the validation layer.
  const epsilon = 1e-12;
  let s: number;
  let t: number;

  if (aLen <= epsilon && bLen <= epsilon) {
    return rx * rx + ry * ry + rz * rz;
  }
  if (aLen <= epsilon) {
    s = 0;
    t = clamp01(f / bLen);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (bLen <= epsilon) {
      t = 0;
      s = clamp01(-c / aLen);
    } else {
      const bDot = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = aLen * bLen - bDot * bDot;
      s = denom !== 0 ? clamp01((bDot * f - c * bLen) / denom) : 0;
      t = (bDot * s + f) / bLen;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / aLen);
      } else if (t > 1) {
        t = 1;
        s = clamp01((bDot - c) / aLen);
      }
    }
  }

  const cx = (a0.x + d1x * s) - (b0.x + d2x * t);
  const cy = (a0.y + d1y * s) - (b0.y + d2y * t);
  const cz = (a0.z + d1z * s) - (b0.z + d2z * t);
  return cx * cx + cy * cy + cz * cz;
}

function closestPointsOnSegmentsInto(
  a0: Vec3,
  a1: Vec3,
  b0: Vec3,
  b1: Vec3,
  outA: MutableVec3,
  outB: MutableVec3
): void {
  const d1x = a1.x - a0.x;
  const d1y = a1.y - a0.y;
  const d1z = a1.z - a0.z;
  const d2x = b1.x - b0.x;
  const d2y = b1.y - b0.y;
  const d2z = b1.z - b0.z;
  const rx = a0.x - b0.x;
  const ry = a0.y - b0.y;
  const rz = a0.z - b0.z;
  const aLen = d1x * d1x + d1y * d1y + d1z * d1z;
  const bLen = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const epsilon = 1e-12;
  let s: number;
  let t: number;

  if (aLen <= epsilon && bLen <= epsilon) {
    s = 0;
    t = 0;
  } else if (aLen <= epsilon) {
    s = 0;
    t = clamp01(f / bLen);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (bLen <= epsilon) {
      t = 0;
      s = clamp01(-c / aLen);
    } else {
      const bDot = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = aLen * bLen - bDot * bDot;
      s = denom !== 0 ? clamp01((bDot * f - c * bLen) / denom) : 0;
      t = (bDot * s + f) / bLen;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / aLen);
      } else if (t > 1) {
        t = 1;
        s = clamp01((bDot - c) / aLen);
      }
    }
  }

  outA.x = a0.x + d1x * s;
  outA.y = a0.y + d1y * s;
  outA.z = a0.z + d1z * s;
  outB.x = b0.x + d2x * t;
  outB.y = b0.y + d2y * t;
  outB.z = b0.z + d2z * t;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
