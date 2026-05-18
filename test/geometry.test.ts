import { describe, expect, it } from "vitest";
import { unwrap, vec3 } from "../src/core/index.js";
import {
  aabb,
  aabbContainsPoint,
  aabbIntersectsAabb,
  frustumContainsPoint,
  frustumFromMatrixWebGpu,
  frustumIntersectsAabb,
  frustumIntersectsSphere,
  plane,
  ray,
  rayAabbHitDistance,
  rayAt,
  rayPlaneHitDistance,
  sphere,
  sphereIntersectsAabb
} from "../src/geometry/index.js";
import { mat4PerspectiveWebGpuRh } from "../src/gpu/index.js";

describe("geometry primitives", () => {
  it("uses inclusive AABB boundaries and overlap", () => {
    const box = aabb(vec3(-1, -1, -1), vec3(1, 1, 1));

    expect(aabbContainsPoint(box, vec3(1, 0, 0))).toBe(true);
    expect(aabbIntersectsAabb(box, aabb(vec3(1, 1, 1), vec3(2, 2, 2)))).toBe(true);
    expect(aabbIntersectsAabb(box, aabb(vec3(1.1, 0, 0), vec3(2, 1, 1)))).toBe(false);
  });

  it("computes forward ray hit distances for planes and boxes", () => {
    const pickRay = ray(vec3(0, 0, 0), vec3(0, 0, -1));
    const zPlane = plane(vec3(0, 0, 1), 5);
    const box = aabb(vec3(-1, -1, -6), vec3(1, 1, -4));

    expect(rayPlaneHitDistance(pickRay, zPlane)).toBe(5);
    expect(rayAabbHitDistance(pickRay, box)).toBe(4);
    expect(rayAt(pickRay, 4)).toEqual(vec3(0, 0, -4));
    expect(rayAabbHitDistance(ray(vec3(0, 0, 0), vec3(0, 1, 0)), box)).toBeNull();
  });

  it("tests spheres against AABBs", () => {
    const box = aabb(vec3(-1, -1, -1), vec3(1, 1, 1));

    expect(sphereIntersectsAabb(sphere(vec3(2, 0, 0), 1), box)).toBe(true);
    expect(sphereIntersectsAabb(sphere(vec3(2.1, 0, 0), 1), box)).toBe(false);
  });

  it("extracts WebGPU frustum planes from a projection matrix", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 10));
    const frustum = frustumFromMatrixWebGpu(projection);

    expect(frustumContainsPoint(frustum, vec3(0, 0, -5))).toBe(true);
    expect(frustumContainsPoint(frustum, vec3(20, 0, -5))).toBe(false);
    expect(frustumIntersectsAabb(frustum, aabb(vec3(-1, -1, -6), vec3(1, 1, -4)))).toBe(true);
    expect(frustumIntersectsAabb(frustum, aabb(vec3(20, 0, -6), vec3(21, 1, -4)))).toBe(false);
    expect(frustumIntersectsSphere(frustum, sphere(vec3(0, 0, -5), 1))).toBe(true);
  });
});
