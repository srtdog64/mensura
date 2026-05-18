import { describe, expect, it } from "vitest";
import { MAT3_IDENTITY, mat3, mutableVec3, vec3 } from "../src/core/index.js";
import {
  aabb,
  aabbClosestPoint,
  aabbExpandByPoint,
  capsule,
  copyCapsuleInto,
  copyObbInto,
  mutableCapsule,
  mutableObb,
  obb,
  planeFromComponents,
  planeNormalize,
  sphere,
  sphereContainsPoint,
  sphereIntersectsSphere,
  triangleMesh,
  triangleMeshGetTriangleCount,
  triangleMeshGetVertexCount
} from "../src/geometry/index.js";

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
});
