import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { distanceSq3, mutableVec3 } from "../core/vec3.js";
import type { Aabb } from "./aabb.js";
import { aabbDistanceSqToPoint } from "./aabb.js";

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
