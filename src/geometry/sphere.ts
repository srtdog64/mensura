import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { distance3, distanceSq3, mutableVec3 } from "../core/vec3.js";
import type { Aabb, MutableAabb } from "./aabb.js";
import { aabbDistanceSqToPoint, mutableAabb } from "./aabb.js";

export interface Sphere {
  readonly center: Vec3;
  readonly radius: number;
}

export interface MutableSphere {
  center: MutableVec3;
  radius: number;
}

export function sphere(center: Vec3, radius: number): Sphere {
  return {
    center: {
      x: center.x,
      y: center.y,
      z: center.z
    },
    radius
  };
}

export function mutableSphere(center?: Vec3, radius: number = 0): MutableSphere {
  return {
    center: center ? mutableVec3(center.x, center.y, center.z) : mutableVec3(),
    radius
  };
}

export function sphereContainsPoint(value: Sphere, point: Vec3): boolean {
  if (value.radius < 0) {
    return false;
  }
  return distanceSq3(value.center, point) <= value.radius * value.radius;
}

export function sphereIntersectsSphere(a: Sphere, b: Sphere): boolean {
  if (a.radius < 0 || b.radius < 0) {
    return false;
  }
  const radiusSum = a.radius + b.radius;
  return distanceSq3(a.center, b.center) <= radiusSum * radiusSum;
}

export function sphereIntersectsAabb(value: Sphere, box: Aabb): boolean {
  if (value.radius < 0) {
    return false;
  }
  return aabbDistanceSqToPoint(box, value.center) <= value.radius * value.radius;
}

/**
 * Signed distance from `point` to the sphere surface. Negative values are
 * inside, zero is on the boundary, and positive values are outside.
 * Empty sphere (`radius < 0`) returns `+Infinity`.
 */
export function sphereSignedDistanceToPoint(value: Sphere, point: Vec3): number {
  if (value.radius < 0) {
    return Number.POSITIVE_INFINITY;
  }
  return distance3(value.center, point) - value.radius;
}

/**
 * Axis-aligned bounding box of the sphere. Empty sphere (`radius < 0`)
 * returns an empty AABB so the same empty-domain signal propagates downstream.
 */
export function sphereGetAabb(value: Sphere): MutableAabb {
  return sphereGetAabbInto(value, mutableAabb());
}

export function sphereGetAabbInto(value: Sphere, out: MutableAabb): MutableAabb {
  if (value.radius < 0) {
    out.min.x = Number.POSITIVE_INFINITY;
    out.min.y = Number.POSITIVE_INFINITY;
    out.min.z = Number.POSITIVE_INFINITY;
    out.max.x = Number.NEGATIVE_INFINITY;
    out.max.y = Number.NEGATIVE_INFINITY;
    out.max.z = Number.NEGATIVE_INFINITY;
    return out;
  }
  const r = value.radius;
  out.min.x = value.center.x - r;
  out.min.y = value.center.y - r;
  out.min.z = value.center.z - r;
  out.max.x = value.center.x + r;
  out.max.y = value.center.y + r;
  out.max.z = value.center.z + r;
  return out;
}

/** Surface area `4π r²`. Empty sphere returns 0. */
export function sphereSurfaceArea(value: Sphere): number {
  if (value.radius < 0) {
    return 0;
  }
  return 4 * Math.PI * value.radius * value.radius;
}

/** Volume `(4/3) π r³`. Empty sphere returns 0. */
export function sphereVolume(value: Sphere): number {
  if (value.radius < 0) {
    return 0;
  }
  const r = value.radius;
  return (4 / 3) * Math.PI * r * r * r;
}
