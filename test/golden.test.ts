import { describe, expect, it } from "vitest";
import {
  MAT4_IDENTITY,
  mat4Compose,
  mat4LookAtRh,
  mat4TransformPoint3,
  quat,
  unwrap,
  vec3
} from "../src/core/index.js";
import { mat4PerspectiveWebGpuRh } from "../src/gpu/index.js";
import {
  createDeterministicRng,
  seedFromString,
  triangleClosestPoint,
  type DeterministicRngAlgorithm
} from "../src/index.js";
import { ray } from "../src/geometry/index.js";
import { rayTriangleHit } from "../src/query/index.js";

function expectArrayClose(actual: ArrayLike<number>, expected: readonly number[], precision = 12): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], precision);
  }
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
});

