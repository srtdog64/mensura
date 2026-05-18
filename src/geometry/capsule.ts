import type { Vec3, MutableVec3 } from "../core/vec3.js";
import { vec3, copy3, copy3Into } from "../core/vec3.js";

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
