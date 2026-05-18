import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { clamp3Into, mutableVec3 } from "../core/vec3.js";
import type { MutableSphere } from "./sphere.js";
import { mutableSphere } from "./sphere.js";

export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface MutableAabb {
  min: MutableVec3;
  max: MutableVec3;
}

export function aabb(min: Vec3, max: Vec3): Aabb {
  return {
    min: {
      x: min.x,
      y: min.y,
      z: min.z
    },
    max: {
      x: max.x,
      y: max.y,
      z: max.z
    }
  };
}

export function mutableAabb(
  min: Vec3 = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
  max: Vec3 = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY }
): MutableAabb {
  return {
    min: mutableVec3(min.x, min.y, min.z),
    max: mutableVec3(max.x, max.y, max.z)
  };
}

export function aabbContainsPoint(box: Aabb, point: Vec3): boolean {
  return (
    point.x >= box.min.x &&
    point.x <= box.max.x &&
    point.y >= box.min.y &&
    point.y <= box.max.y &&
    point.z >= box.min.z &&
    point.z <= box.max.z
  );
}

export function aabbIntersectsAabb(a: Aabb, b: Aabb): boolean {
  return (
    b.max.x >= a.min.x &&
    b.min.x <= a.max.x &&
    b.max.y >= a.min.y &&
    b.min.y <= a.max.y &&
    b.max.z >= a.min.z &&
    b.min.z <= a.max.z
  );
}

export function aabbExpandByPoint(box: Aabb, point: Vec3): MutableAabb {
  return aabbExpandByPointInto(box, point, mutableAabb());
}

export function aabbExpandByPointInto(box: Aabb, point: Vec3, out: MutableAabb): MutableAabb {
  out.min.x = Math.min(box.min.x, point.x);
  out.min.y = Math.min(box.min.y, point.y);
  out.min.z = Math.min(box.min.z, point.z);
  out.max.x = Math.max(box.max.x, point.x);
  out.max.y = Math.max(box.max.y, point.y);
  out.max.z = Math.max(box.max.z, point.z);
  return out;
}

export function aabbClosestPoint(box: Aabb, point: Vec3): MutableVec3 {
  return aabbClosestPointInto(box, point, mutableVec3());
}

export function aabbClosestPointInto(box: Aabb, point: Vec3, out: MutableVec3): MutableVec3 {
  return clamp3Into(point, box.min, box.max, out);
}

export function aabbDistanceSqToPoint(box: Aabb, point: Vec3): number {
  const px = point.x;
  const py = point.y;
  const pz = point.z;
  const dx = px < box.min.x ? box.min.x - px : px > box.max.x ? px - box.max.x : 0;
  const dy = py < box.min.y ? box.min.y - py : py > box.max.y ? py - box.max.y : 0;
  const dz = pz < box.min.z ? box.min.z - pz : pz > box.max.z ? pz - box.max.z : 0;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Return an empty AABB (min = +Infinity, max = -Infinity). Combine with
 * `aabbExpandByPointInto` to grow a bounding box from a point sequence.
 */
export function aabbEmpty(): MutableAabb {
  return mutableAabb();
}

export function aabbEmptyInto(out: MutableAabb): MutableAabb {
  out.min.x = Number.POSITIVE_INFINITY;
  out.min.y = Number.POSITIVE_INFINITY;
  out.min.z = Number.POSITIVE_INFINITY;
  out.max.x = Number.NEGATIVE_INFINITY;
  out.max.y = Number.NEGATIVE_INFINITY;
  out.max.z = Number.NEGATIVE_INFINITY;
  return out;
}

/**
 * Empty when any component min exceeds the matching max. After `aabbEmpty()`
 * all three components are inverted.
 */
export function aabbIsEmpty(box: Aabb): boolean {
  return box.min.x > box.max.x || box.min.y > box.max.y || box.min.z > box.max.z;
}

export function aabbGetBoundingSphere(box: Aabb): MutableSphere {
  return aabbGetBoundingSphereInto(box, mutableSphere());
}

export function aabbGetBoundingSphereInto(box: Aabb, out: MutableSphere): MutableSphere {
  if (aabbIsEmpty(box)) {
    out.center.x = 0;
    out.center.y = 0;
    out.center.z = 0;
    out.radius = -1;
    return out;
  }

  const cx = (box.min.x + box.max.x) * 0.5;
  const cy = (box.min.y + box.max.y) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const hx = (box.max.x - box.min.x) * 0.5;
  const hy = (box.max.y - box.min.y) * 0.5;
  const hz = (box.max.z - box.min.z) * 0.5;
  out.center.x = cx;
  out.center.y = cy;
  out.center.z = cz;
  out.radius = Math.sqrt(hx * hx + hy * hy + hz * hz);
  return out;
}
