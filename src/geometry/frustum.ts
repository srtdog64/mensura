import type { Aabb } from "./aabb.js";
import { type MutablePlane, type Plane, mutablePlane, planeDistanceToPoint, planeFromComponentsInto } from "./plane.js";
import type { Sphere } from "./sphere.js";
import type { Mat4Like } from "../core/mat4.js";
import type { Vec3 } from "../core/vec3.js";

export interface Frustum {
  readonly left: Plane;
  readonly right: Plane;
  readonly bottom: Plane;
  readonly top: Plane;
  readonly far: Plane;
  readonly near: Plane;
}

export interface MutableFrustum {
  left: MutablePlane;
  right: MutablePlane;
  bottom: MutablePlane;
  top: MutablePlane;
  far: MutablePlane;
  near: MutablePlane;
}

export function mutableFrustum(): MutableFrustum {
  return {
    left: mutablePlane(),
    right: mutablePlane(),
    bottom: mutablePlane(),
    top: mutablePlane(),
    far: mutablePlane(),
    near: mutablePlane()
  };
}

export function frustumFromMatrixWebGpu(matrix: Mat4Like): MutableFrustum {
  return frustumFromMatrixWebGpuInto(matrix, mutableFrustum());
}

export function frustumFromMatrixWebGpuInto(matrix: Mat4Like, out: MutableFrustum): MutableFrustum {
  const me0 = matrix[0];
  const me1 = matrix[1];
  const me2 = matrix[2];
  const me3 = matrix[3];
  const me4 = matrix[4];
  const me5 = matrix[5];
  const me6 = matrix[6];
  const me7 = matrix[7];
  const me8 = matrix[8];
  const me9 = matrix[9];
  const me10 = matrix[10];
  const me11 = matrix[11];
  const me12 = matrix[12];
  const me13 = matrix[13];
  const me14 = matrix[14];
  const me15 = matrix[15];

  planeFromComponentsInto(me3 - me0, me7 - me4, me11 - me8, me15 - me12, out.left);
  planeFromComponentsInto(me3 + me0, me7 + me4, me11 + me8, me15 + me12, out.right);
  planeFromComponentsInto(me3 + me1, me7 + me5, me11 + me9, me15 + me13, out.bottom);
  planeFromComponentsInto(me3 - me1, me7 - me5, me11 - me9, me15 - me13, out.top);
  planeFromComponentsInto(me3 - me2, me7 - me6, me11 - me10, me15 - me14, out.far);
  planeFromComponentsInto(me2, me6, me10, me14, out.near);
  return out;
}

export function frustumContainsPoint(value: Frustum, point: Vec3): boolean {
  return (
    planeDistanceToPoint(value.left, point) >= 0 &&
    planeDistanceToPoint(value.right, point) >= 0 &&
    planeDistanceToPoint(value.bottom, point) >= 0 &&
    planeDistanceToPoint(value.top, point) >= 0 &&
    planeDistanceToPoint(value.far, point) >= 0 &&
    planeDistanceToPoint(value.near, point) >= 0
  );
}

export function frustumIntersectsSphere(value: Frustum, sphere: Sphere): boolean {
  const negRadius = -sphere.radius;

  return (
    planeDistanceToPoint(value.left, sphere.center) >= negRadius &&
    planeDistanceToPoint(value.right, sphere.center) >= negRadius &&
    planeDistanceToPoint(value.bottom, sphere.center) >= negRadius &&
    planeDistanceToPoint(value.top, sphere.center) >= negRadius &&
    planeDistanceToPoint(value.far, sphere.center) >= negRadius &&
    planeDistanceToPoint(value.near, sphere.center) >= negRadius
  );
}

export function frustumIntersectsAabb(value: Frustum, box: Aabb): boolean {
  return (
    aabbHasPositiveVertexInsidePlane(box, value.left) &&
    aabbHasPositiveVertexInsidePlane(box, value.right) &&
    aabbHasPositiveVertexInsidePlane(box, value.bottom) &&
    aabbHasPositiveVertexInsidePlane(box, value.top) &&
    aabbHasPositiveVertexInsidePlane(box, value.far) &&
    aabbHasPositiveVertexInsidePlane(box, value.near)
  );
}

function aabbHasPositiveVertexInsidePlane(box: Aabb, testPlane: Plane): boolean {
  const nx = testPlane.normal.x;
  const ny = testPlane.normal.y;
  const nz = testPlane.normal.z;
  const px = nx > 0 ? box.max.x : box.min.x;
  const py = ny > 0 ? box.max.y : box.min.y;
  const pz = nz > 0 ? box.max.z : box.min.z;

  return nx * px + ny * py + nz * pz + testPlane.constant >= 0;
}
