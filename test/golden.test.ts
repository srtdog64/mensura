import { describe, expect, it } from "vitest";
import {
  AccelContext,
  buildBvh,
  bvhOverlapPairs,
  bvhRaycast
} from "../src/accel/index.js";
import {
  CollisionContext,
  mprIntersect,
  sweptAabbTimeOfImpact,
  sweptSphereTimeOfImpact
} from "../src/collision/index.js";
import {
  MAT4_IDENTITY,
  mat4Compose,
  mat4Decompose,
  mat4Invert,
  mat4LookAtRh,
  mat4Multiply,
  mat4ProjectPoint3WebGpu,
  mat4TransformPoint3,
  mat4UnprojectPoint3WebGpu,
  quat,
  quatFromUnitVectors,
  quatSlerp,
  scaleAndAdd3,
  normalize3,
  unwrap,
  vec3
} from "../src/core/index.js";
import {
  aabbReadWgslDataViewF32,
  aabbWriteWgslDataViewF32
} from "../src/data/index.js";
import { mat4PerspectiveWebGpuRh } from "../src/gpu/index.js";
import { WGSL_AABB3F_LAYOUT } from "../src/layout/index.js";
import {
  createDeterministicRng,
  seedFromString,
  aabbSignedDistanceToPoint,
  sphereSignedDistanceToPoint,
  triangleClosestPoint,
  type DeterministicRngAlgorithm
} from "../src/index.js";
import { aabb, ray, sphere } from "../src/geometry/index.js";
import { rayTriangleHit } from "../src/query/index.js";

function expectArrayClose(actual: ArrayLike<number>, expected: readonly number[], precision = 12): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], precision);
  }
}

function expectVec3Close(actual: { readonly x: number; readonly y: number; readonly z: number }, expected: { readonly x: number; readonly y: number; readonly z: number }, precision = 12): void {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

function sphereSupport(center: ReturnType<typeof vec3>, radius: number) {
  return (direction: ReturnType<typeof vec3>) => {
    const normalized = normalize3(direction);
    return scaleAndAdd3(center, normalized, radius);
  };
}

describe("golden math fixtures", () => {
  it("keeps the identity matrix stable", () => {
    expectArrayClose(MAT4_IDENTITY, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  });

  it("keeps WebGPU RH perspective mapping near to 0 and far to 1", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 10));
    expectArrayClose(projection, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, -10 / 9, -1,
      0, 0, -10 / 9, 0
    ]);

    expect(mat4TransformPoint3(projection, vec3(0, 0, -1)).z).toBeCloseTo(0, 12);
    expect(mat4TransformPoint3(projection, vec3(0, 0, -10)).z).toBeCloseTo(1, 12);
  });

  it("keeps WebGPU viewport project/unproject fixtures stable", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 10));
    const inverse = unwrap(mat4Invert(projection));
    const viewport = { x: 10, y: 20, width: 800, height: 600 };

    const projected = unwrap(mat4ProjectPoint3WebGpu(projection, vec3(0.5, 0.25, -5), viewport));
    expectVec3Close(projected, vec3(450, 305, 8 / 9));

    const unprojected = unwrap(mat4UnprojectPoint3WebGpu(inverse, projected, viewport));
    expectVec3Close(unprojected, vec3(0.5, 0.25, -5));
  });

  it("keeps lookAt and TRS composition convention stable", () => {
    const view = unwrap(mat4LookAtRh(vec3(0, 0, 5), vec3(0, 0, 0), vec3(0, 1, 0)));
    expectArrayClose(view, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, -5, 1
    ]);

    const composed = mat4Compose(vec3(1, 2, 3), quat(0, 0, 0, 1), vec3(2, 3, 4));
    expectArrayClose(composed, [
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      1, 2, 3, 1
    ]);
  });

  it("keeps matrix inversion and TRS decomposition fixtures stable", () => {
    const halfSqrt = Math.SQRT1_2;
    const composed = mat4Compose(vec3(3, -2, 5), quat(0, 0, halfSqrt, halfSqrt), vec3(2, 3, 4));

    expectArrayClose(composed, [
      0, 2, 0, 0,
      -3, 0, 0, 0,
      0, 0, 4, 0,
      3, -2, 5, 1
    ]);

    const inverse = unwrap(mat4Invert(composed));
    expectArrayClose(inverse, [
      0, -1 / 3, 0, 0,
      1 / 2, 0, 0, 0,
      0, 0, 1 / 4, 0,
      1, 1, -5 / 4, 1
    ]);

    expectArrayClose(mat4Multiply(composed, inverse), MAT4_IDENTITY);

    const decomposed = mat4Decompose(composed);
    expectVec3Close(decomposed.translation, vec3(3, -2, 5));
    expectVec3Close(decomposed.scale, vec3(2, 3, 4));
    expect(decomposed.rotation.x).toBeCloseTo(0, 12);
    expect(decomposed.rotation.y).toBeCloseTo(0, 12);
    expect(decomposed.rotation.z).toBeCloseTo(halfSqrt, 12);
    expect(decomposed.rotation.w).toBeCloseTo(halfSqrt, 12);
  });

  it("keeps quaternion interpolation and unit-vector rotation fixtures stable", () => {
    const halfTurnY = quat(0, 1, 0, 0);
    const quarter = quatSlerp(quat(0, 0, 0, 1), halfTurnY, 0.25);

    expect(quarter.x).toBeCloseTo(0, 12);
    expect(quarter.y).toBeCloseTo(0.3826834323650898, 12);
    expect(quarter.z).toBeCloseTo(0, 12);
    expect(quarter.w).toBeCloseTo(0.9238795325112867, 12);

    const xToY = unwrap(quatFromUnitVectors(vec3(1, 0, 0), vec3(0, 1, 0)));
    expect(xToY.x).toBeCloseTo(0, 12);
    expect(xToY.y).toBeCloseTo(0, 12);
    expect(xToY.z).toBeCloseTo(Math.SQRT1_2, 12);
    expect(xToY.w).toBeCloseTo(Math.SQRT1_2, 12);

    const xToNegativeX = unwrap(quatFromUnitVectors(vec3(1, 0, 0), vec3(-1, 0, 0)));
    expect(xToNegativeX.x).toBeCloseTo(0, 12);
    expect(xToNegativeX.y).toBeCloseTo(1, 12);
    expect(xToNegativeX.z).toBeCloseTo(0, 12);
    expect(xToNegativeX.w).toBeCloseTo(0, 12);
  });

  it("keeps deterministic RNG streams stable by algorithm", () => {
    const seed = seedFromString("mensura:golden:rng");
    const expected: Record<DeterministicRngAlgorithm, readonly number[]> = {
      lcg32: [16221313, 3630502892, 1905065563, 80945150, 3115632453],
      xorshift32: [3902115365, 1936806701, 2072980295, 1108804276, 3933970708],
      mulberry32: [3755911851, 3123424608, 3194492055, 204597936, 3491923888]
    };

    for (const algorithm of Object.keys(expected) as DeterministicRngAlgorithm[]) {
      const rng = createDeterministicRng(seed, algorithm);
      expect([
        rng.nextUint32(),
        rng.nextUint32(),
        rng.nextUint32(),
        rng.nextUint32(),
        rng.nextUint32()
      ]).toEqual(expected[algorithm]);
    }
  });

  it("keeps ray-triangle hit and closest-point fixtures stable", () => {
    const a = vec3(0, 0, 0);
    const b = vec3(1, 0, 0);
    const c = vec3(0, 1, 0);
    const hit = rayTriangleHit(ray(vec3(0.25, 0.25, 1), vec3(0, 0, -1)), a, b, c);
    expect(hit).not.toBeNull();
    if (hit) {
      expect(hit.distance).toBeCloseTo(1, 12);
      expect(hit.point).toEqual(vec3(0.25, 0.25, 0));
      expect(hit.barycentric.x).toBeCloseTo(0.5, 12);
      expect(hit.barycentric.y).toBeCloseTo(0.25, 12);
      expect(hit.barycentric.z).toBeCloseTo(0.25, 12);
    }

    expect(triangleClosestPoint(a, b, c, vec3(2, -1, 0))).toEqual(b);
  });

  it("keeps signed-distance fixtures stable", () => {
    const box = aabb(vec3(-1, -2, -3), vec3(1, 2, 3));

    expect(aabbSignedDistanceToPoint(box, vec3(0, 0, 0))).toBeCloseTo(-1, 12);
    expect(aabbSignedDistanceToPoint(box, vec3(1, 0, 0))).toBeCloseTo(0, 12);
    expect(aabbSignedDistanceToPoint(box, vec3(4, 6, 3))).toBeCloseTo(5, 12);
    expect(sphereSignedDistanceToPoint(sphere(vec3(1, 0, 0), 2), vec3(6, 0, 0))).toBeCloseTo(3, 12);
  });

  it("keeps CCD time-of-impact fixtures stable", () => {
    const aabbHit = sweptAabbTimeOfImpact(
      aabb(vec3(0, 0, 0), vec3(1, 1, 1)),
      vec3(4, 0, 0),
      aabb(vec3(3, 0, 0), vec3(4, 1, 1))
    );
    expect(aabbHit).not.toBeNull();
    if (aabbHit) {
      expect(aabbHit.time).toBeCloseTo(0.5, 12);
      expect(aabbHit.normal).toEqual(vec3(-1, 0, 0));
    }

    const sphereHit = sweptSphereTimeOfImpact(
      sphere(vec3(0, 0, 0), 1),
      vec3(10, 0, 0),
      sphere(vec3(5, 0, 0), 1)
    );
    expect(sphereHit).not.toBeNull();
    if (sphereHit) {
      expect(sphereHit.time).toBeCloseTo(0.3, 12);
      expect(sphereHit.normal).toEqual(vec3(-1, 0, 0));
    }
  });

  it("keeps MPR binary intersection boundary fixtures stable", () => {
    const ctx = new CollisionContext();
    const coincident = unwrap(mprIntersect(
      { center: vec3(0, 0, 0), support: sphereSupport(vec3(0, 0, 0), 1) },
      { center: vec3(0, 0, 0), support: sphereSupport(vec3(0, 0, 0), 1) },
      ctx
    ));
    expect(coincident).toEqual({
      intersect: true,
      portalDirection: vec3(1, 0, 0),
      iterations: 0
    });

    const touching = unwrap(mprIntersect(
      { center: vec3(0, 0, 0), support: sphereSupport(vec3(0, 0, 0), 1) },
      { center: vec3(2, 0, 0), support: sphereSupport(vec3(2, 0, 0), 1) },
      ctx
    ));
    expect(touching).toEqual({
      intersect: false,
      portalDirection: vec3(1, 0, 0),
      iterations: 1
    });
  });

  it("keeps BVH traversal and broadphase fixtures stable", () => {
    const boxes = [
      aabb(vec3(0, 0, -5), vec3(1, 1, -4)),
      aabb(vec3(0.5, 0.5, -5.5), vec3(1.5, 1.5, -4.5)),
      aabb(vec3(4, 4, -5), vec3(5, 5, -4)),
      aabb(vec3(-0.5, -0.5, -9), vec3(0.5, 0.5, -8))
    ];
    const bvh = unwrap(buildBvh(boxes, { maxPrimitivesPerLeaf: 1, splitMethod: "sah", sahBins: 4 }));
    const ctx = new AccelContext();

    expect(bvhRaycast(bvh, ray(vec3(0.25, 0.25, 0), vec3(0, 0, -1)), ctx).sort((a, b) => a - b))
      .toEqual([0, 3]);
    expect(bvhOverlapPairs(bvh, ctx)).toEqual([{ a: 0, b: 1 }]);
  });

  it("keeps WGSL AABB DataView layout fixtures stable", () => {
    const view = new DataView(new ArrayBuffer(WGSL_AABB3F_LAYOUT.strideBytes));
    const bounds = aabb(vec3(1.25, -2.5, 3.75), vec3(4.5, 5.25, -6.5));

    expect(unwrap(aabbWriteWgslDataViewF32(bounds, view, 0))).toBe(view);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.minOffsetBytes + 0, true)).toBeCloseTo(1.25, 12);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.minOffsetBytes + 4, true)).toBeCloseTo(-2.5, 12);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.minOffsetBytes + 8, true)).toBeCloseTo(3.75, 12);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.minOffsetBytes + 12, true)).toBe(0);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.maxOffsetBytes + 0, true)).toBeCloseTo(4.5, 12);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.maxOffsetBytes + 4, true)).toBeCloseTo(5.25, 12);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.maxOffsetBytes + 8, true)).toBeCloseTo(-6.5, 12);
    expect(view.getFloat32(WGSL_AABB3F_LAYOUT.maxOffsetBytes + 12, true)).toBe(0);

    expect(unwrap(aabbReadWgslDataViewF32(view, 0))).toEqual(bounds);
  });
});
