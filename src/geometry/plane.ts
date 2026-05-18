import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { dot3, length3, mutableVec3, scale3Into } from "../core/vec3.js";

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
