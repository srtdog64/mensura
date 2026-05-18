import type { Aabb } from "./aabb.js";
import type { Plane } from "./plane.js";
import { planeDistanceToPoint } from "./plane.js";
import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { dot3, mutableVec3, scaleAndAdd3Into } from "../core/vec3.js";

export interface Ray {
  readonly origin: Vec3;
  readonly direction: Vec3;
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

export function rayAabbHitDistance(value: Ray, box: Aabb): number | null {
  let tmin: number;
  let tmax: number;
  let tymin: number;
  let tymax: number;
  let tzmin: number;
  let tzmax: number;

  const invDirX = 1 / value.direction.x;
  const invDirY = 1 / value.direction.y;
  const invDirZ = 1 / value.direction.z;
  const origin = value.origin;

  if (invDirX >= 0) {
    tmin = (box.min.x - origin.x) * invDirX;
    tmax = (box.max.x - origin.x) * invDirX;
  } else {
    tmin = (box.max.x - origin.x) * invDirX;
    tmax = (box.min.x - origin.x) * invDirX;
  }

  if (invDirY >= 0) {
    tymin = (box.min.y - origin.y) * invDirY;
    tymax = (box.max.y - origin.y) * invDirY;
  } else {
    tymin = (box.max.y - origin.y) * invDirY;
    tymax = (box.min.y - origin.y) * invDirY;
  }

  if (tmin > tymax || tymin > tmax) {
    return null;
  }

  if (tymin > tmin || Number.isNaN(tmin)) {
    tmin = tymin;
  }

  if (tymax < tmax || Number.isNaN(tmax)) {
    tmax = tymax;
  }

  if (invDirZ >= 0) {
    tzmin = (box.min.z - origin.z) * invDirZ;
    tzmax = (box.max.z - origin.z) * invDirZ;
  } else {
    tzmin = (box.max.z - origin.z) * invDirZ;
    tzmax = (box.min.z - origin.z) * invDirZ;
  }

  if (tmin > tzmax || tzmin > tmax) {
    return null;
  }

  if (tzmin > tmin || Number.isNaN(tmin)) {
    tmin = tzmin;
  }

  if (tzmax < tmax || Number.isNaN(tmax)) {
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
