import { describe, expect, it } from "vitest";
import { MAT3_IDENTITY, mat3, mutableVec3, vec3 } from "../src/core/index.js";
import {
  aabb,
  aabbEmpty,
  aabbExpandByPoint,
  aabbExpandByPointInto,
  aabbIsEmpty,
  capsule,
  capsuleContainsPoint,
  capsuleIntersectsSphere,
  copyCapsuleInto,
  copyObbInto,
  mutableCapsule,
  mutableObb,
  obb,
  planeFromComponents,
  planeNormalize,
  sphere,
  sphereContainsPoint,
  sphereIntersectsAabb,
  sphereIntersectsSphere,
  triangleMesh,
  triangleMeshGetTriangleCount,
  triangleMeshGetVertexCount
} from "../src/geometry/index.js";
import {
  aabbClosestPoint,
  aabbGetBoundingSphere,
  capsuleGetAabb,
  triangleArea,
  triangleBarycentric,
  triangleClosestPoint,
  triangleNormal
} from "../src/measure/index.js";

describe("Geometry extension primitives", () => {
  it("expands and clamps AABBs", () => {
    const box = aabb(vec3(0, 0, 0), vec3(1, 1, 1));

    expect(aabbExpandByPoint(box, vec3(-1, 2, 0.5))).toEqual(aabb(vec3(-1, 0, 0), vec3(1, 2, 1)));
    expect(aabbClosestPoint(box, vec3(2, -1, 0.5))).toEqual(vec3(1, 0, 0.5));
  });

  it("normalizes planes from components", () => {
    const normalized = planeFromComponents(0, 2, 0, -4);

    expect(normalized).toEqual({ normal: vec3(0, 1, 0), constant: -2 });
    expect(planeNormalize({ normal: vec3(0, 0, 0), constant: 10 })).toEqual({
      normal: vec3(0, 0, 0),
      constant: 0
    });
  });

  it("tests spheres against points and other spheres", () => {
    const value = sphere(vec3(0, 0, 0), 2);

    expect(sphereContainsPoint(value, vec3(0, 2, 0))).toBe(true);
    expect(sphereContainsPoint(value, vec3(0, 2.1, 0))).toBe(false);
    expect(sphereIntersectsSphere(value, sphere(vec3(4, 0, 0), 2))).toBe(true);
    expect(sphereIntersectsSphere(value, sphere(vec3(4.1, 0, 0), 2))).toBe(false);
  });

  it("treats negative-radius spheres as empty in predicates", () => {
    const empty = sphere(vec3(0, 0, 0), -1);

    expect(sphereContainsPoint(empty, vec3(0, 0, 0))).toBe(false);
    expect(sphereIntersectsSphere(empty, sphere(vec3(0, 0, 0), 10))).toBe(false);
    expect(sphereIntersectsSphere(sphere(vec3(0, 0, 0), 10), empty)).toBe(false);
    expect(sphereIntersectsAabb(empty, aabb(vec3(-1, -1, -1), vec3(1, 1, 1)))).toBe(false);
  });

  it("copies capsule and OBB values into caller-owned outputs", () => {
    const cap = capsule(vec3(0, -1, 0), vec3(0, 1, 0), 0.5);
    const capOut = mutableCapsule();
    const box = obb(vec3(1, 2, 3), vec3(4, 5, 6), MAT3_IDENTITY);
    const obbOut = mutableObb();

    expect(copyCapsuleInto(cap, capOut)).toBe(capOut);
    expect(capOut).toEqual(cap);

    expect(copyObbInto(box, obbOut)).toBe(obbOut);
    expect(obbOut).toEqual(box);
  });

  it("creates default mutable OBB and capsule values", () => {
    expect(mutableCapsule()).toEqual(capsule(vec3(0, -1, 0), vec3(0, 1, 0), 1));
    expect(mutableObb()).toEqual(obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY));
    expect(mutableObb(undefined, undefined, mat3(1, 0, 0, 0, 0, 1, 0, -1, 0)).rotation).toEqual([
      1, 0, 0,
      0, 0, 1,
      0, -1, 0
    ]);
  });

  it("counts indexed and non-indexed triangle meshes", () => {
    const vertices = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      1, 1, 0
    ]);
    const unindexed = triangleMesh(vertices);
    const indexed = triangleMesh(vertices, new Uint16Array([0, 1, 2, 2, 1, 3]));

    expect("indices" in unindexed).toBe(false);
    expect(triangleMeshGetVertexCount(unindexed)).toBe(4);
    expect(triangleMeshGetTriangleCount(unindexed)).toBe(1);
    expect(triangleMeshGetTriangleCount(indexed)).toBe(2);
  });

  it("keeps mutableVec3 import available for geometry output callers", () => {
    expect(mutableVec3(1, 2, 3)).toEqual(vec3(1, 2, 3));
  });

  it("reports empty AABBs and reuses them via expand-by-point", () => {
    const empty = aabbEmpty();

    expect(aabbIsEmpty(empty)).toBe(true);

    aabbExpandByPointInto(empty, vec3(1, 2, 3), empty);
    aabbExpandByPointInto(empty, vec3(-4, 5, 0), empty);

    expect(aabbIsEmpty(empty)).toBe(false);
    expect(empty.min).toEqual(vec3(-4, 2, 0));
    expect(empty.max).toEqual(vec3(1, 5, 3));
  });

  it("computes an AABB bounding sphere with the half-diagonal radius", () => {
    const box = aabb(vec3(0, 0, 0), vec3(2, 2, 2));
    const result = aabbGetBoundingSphere(box);

    expect(result.center).toEqual(vec3(1, 1, 1));
    expect(result.radius).toBeCloseTo(Math.sqrt(3), 10);
  });

  it("returns an empty sphere for an empty AABB", () => {
    const result = aabbGetBoundingSphere(aabbEmpty());

    expect(result.center).toEqual(vec3(0, 0, 0));
    expect(result.radius).toBe(-1);
  });

  it("classifies points against a capsule and intersects spheres", () => {
    const value = capsule(vec3(0, -1, 0), vec3(0, 1, 0), 0.5);

    expect(capsuleContainsPoint(value, vec3(0, 0, 0))).toBe(true);
    expect(capsuleContainsPoint(value, vec3(0.4, 0, 0))).toBe(true);
    expect(capsuleContainsPoint(value, vec3(1, 0, 0))).toBe(false);
    expect(capsuleIntersectsSphere(value, sphere(vec3(1, 0, 0), 0.6))).toBe(true);
    expect(capsuleIntersectsSphere(value, sphere(vec3(2, 0, 0), 0.6))).toBe(false);
    expect(capsuleContainsPoint(capsule(vec3(0, 0, 0), vec3(0, 1, 0), -1), vec3(0, 0, 0))).toBe(false);
    expect(capsuleIntersectsSphere(value, sphere(vec3(0, 0, 0), -1))).toBe(false);
  });

  it("derives a tight AABB from a capsule's segment and radius", () => {
    const value = capsule(vec3(0, -1, 0), vec3(0, 1, 0), 0.5);
    const box = capsuleGetAabb(value);

    expect(box.min).toEqual(vec3(-0.5, -1.5, -0.5));
    expect(box.max).toEqual(vec3(0.5, 1.5, 0.5));
  });

  it("computes triangle normal, area, barycentric, and closest point", () => {
    const a = vec3(0, 0, 0);
    const b = vec3(1, 0, 0);
    const c = vec3(0, 1, 0);

    expect(triangleNormal(a, b, c)).toEqual(vec3(0, 0, 1));
    expect(triangleArea(a, b, c)).toBeCloseTo(0.5, 10);

    const inside = vec3(0.25, 0.25, 0);
    expect(triangleClosestPoint(a, b, c, inside)).toEqual(inside);
    const bary = triangleBarycentric(a, b, c, inside);
    expect(bary.x).toBeCloseTo(0.5, 10);
    expect(bary.y).toBeCloseTo(0.25, 10);
    expect(bary.z).toBeCloseTo(0.25, 10);

    // Point outside near b -> closest is b itself.
    const outside = vec3(2, -1, 0);
    expect(triangleClosestPoint(a, b, c, outside)).toEqual(b);
  });
});
