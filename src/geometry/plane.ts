import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { dot3, length3, mutableVec3, scale3Into } from "../core/vec3.js";
import type { Aabb } from "./aabb.js";
import { aabbIsEmpty } from "./aabb.js";
import type { Sphere } from "./sphere.js";

export interface Plane {
  readonly normal: Vec3;
  readonly constant: number;
}

export interface MutablePlane {
  normal: MutableVec3;
  constant: number;
}

export function plane(normal: Vec3, constant: number): Plane {
  return {
    normal: {
      x: normal.x,
      y: normal.y,
      z: normal.z
    },
    constant
  };
}

export function mutablePlane(
  normal: Vec3 = { x: 1, y: 0, z: 0 },
  constant: number = 0
): MutablePlane {
  return {
    normal: mutableVec3(normal.x, normal.y, normal.z),
    constant
  };
}

export function planeFromComponents(x: number, y: number, z: number, constant: number): Plane {
  return planeFromComponentsInto(x, y, z, constant, mutablePlane());
}

export function planeFromComponentsInto(
  x: number,
  y: number,
  z: number,
  constant: number,
  out: MutablePlane
): MutablePlane {
  out.normal.x = x;
  out.normal.y = y;
  out.normal.z = z;
  out.constant = constant;
  return planeNormalizeInto(out, out);
}

export function planeNormalize(value: Plane): MutablePlane {
  return planeNormalizeInto(value, mutablePlane());
}

export function planeNormalizeInto(value: Plane, out: MutablePlane): MutablePlane {
  const len = length3(value.normal);

  if (len === 0) {
    out.normal.x = 0;
    out.normal.y = 0;
    out.normal.z = 0;
    out.constant = 0;
    return out;
  }

  const invLen = 1 / len;
  scale3Into(value.normal, invLen, out.normal);
  out.constant = value.constant * invLen;
  return out;
}

export function planeDistanceToPoint(value: Plane, point: Vec3): number {
  return dot3(value.normal, point) + value.constant;
}

/**
 * True when the plane crosses through the sphere, i.e. the signed distance
 * from the plane to the sphere center is within `radius` in absolute value.
 * Empty sphere (`radius < 0`) cannot cross anything and returns `false`.
 *
 * Assumes `normal` has unit length (use `planeNormalize` first for an
 * arbitrary plane); otherwise this is an "intersection up to `|normal|`" test.
 */
export function planeIntersectsSphere(value: Plane, target: Sphere): boolean {
  if (target.radius < 0) {
    return false;
  }
  const distance = dot3(value.normal, target.center) + value.constant;
  return distance >= -target.radius && distance <= target.radius;
}

/**
 * True when the plane separates the AABB into two non-empty halves. The
 * standard "projected extent vs distance" test:
 *
 *   r = ex · |nx| + ey · |ny| + ez · |nz|         (projected half-extent)
 *   s = dot(normal, center) + constant            (signed center distance)
 *   |s| <= r                                       (plane crosses the box)
 *
 * where `(ex, ey, ez)` are the AABB half-extents and `(nx, ny, nz)` is the
 * plane normal. Empty AABB returns `false`.
 */
export function planeIntersectsAabb(value: Plane, box: Aabb): boolean {
  if (aabbIsEmpty(box)) {
    return false;
  }
  const cx = (box.min.x + box.max.x) * 0.5;
  const cy = (box.min.y + box.max.y) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const ex = (box.max.x - box.min.x) * 0.5;
  const ey = (box.max.y - box.min.y) * 0.5;
  const ez = (box.max.z - box.min.z) * 0.5;
  const nx = value.normal.x;
  const ny = value.normal.y;
  const nz = value.normal.z;
  const r = ex * Math.abs(nx) + ey * Math.abs(ny) + ez * Math.abs(nz);
  const s = nx * cx + ny * cy + nz * cz + value.constant;
  return Math.abs(s) <= r;
}
