import type { Vec3, MutableVec3 } from "../core/vec3.js";
import { vec3, copy3, copy3Into } from "../core/vec3.js";
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
