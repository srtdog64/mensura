import type { Aabb } from "./aabb.js";
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
