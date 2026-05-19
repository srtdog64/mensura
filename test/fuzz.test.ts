import { describe, expect, it } from "vitest";
import {
  cross3,
  distanceSq3,
  dot3,
  length3,
  mat4Compose,
  mat4Decompose,
  mat4Invert,
  mat4Multiply,
  mat4TransformAffinePoint3,
  normalize3,
  quat,
  quatNormalize,
  vec3
} from "../src/core/index.js";
import { aabb, aabbContainsPoint, aabbEmpty, aabbExpandByPointInto } from "../src/geometry/index.js";
import { createDeterministicRng, seedFromString } from "../src/validation/index.js";

const EPS = 1e-9;

function expectVecClose(actual: { x: number; y: number; z: number }, expected: { x: number; y: number; z: number }): void {
  expect(actual.x).toBeCloseTo(expected.x, 8);
  expect(actual.y).toBeCloseTo(expected.y, 8);
  expect(actual.z).toBeCloseTo(expected.z, 8);
}

describe("deterministic fuzz invariants", () => {
  it("keeps vec3 algebra invariants over deterministic samples", () => {
    const rng = createDeterministicRng(seedFromString("mensura:fuzz:vec3"), "mulberry32");
    for (let i = 0; i < 1024; i++) {
      const a = vec3(rng.range(-100, 100), rng.range(-100, 100), rng.range(-100, 100));
      const b = vec3(rng.range(-100, 100), rng.range(-100, 100), rng.range(-100, 100));
      const n = normalize3(a);
      const len = length3(a);

      if (len > EPS) {
        expect(length3(n)).toBeCloseTo(1, 10);
      } else {
        expect(length3(n)).toBe(0);
      }

      expect(distanceSq3(a, b)).toBeGreaterThanOrEqual(0);
      expect(distanceSq3(a, b)).toBeCloseTo(distanceSq3(b, a), 12);

      const cross = cross3(a, b);
      expect(dot3(cross, a)).toBeCloseTo(0, 7);
      expect(dot3(cross, b)).toBeCloseTo(0, 7);
    }
  });

  it("keeps TRS compose/decompose transform-equivalent for positive scales", () => {
    const rng = createDeterministicRng(seedFromString("mensura:fuzz:trs"), "xorshift32");
    for (let i = 0; i < 256; i++) {
      const translation = vec3(rng.range(-10, 10), rng.range(-10, 10), rng.range(-10, 10));
      const rotation = quatNormalize(quat(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)));
      const scale = vec3(rng.range(0.1, 5), rng.range(0.1, 5), rng.range(0.1, 5));
      const point = vec3(rng.range(-3, 3), rng.range(-3, 3), rng.range(-3, 3));

      const composed = mat4Compose(translation, rotation, scale);
      const decomposed = mat4Decompose(composed);
      const recomposed = mat4Compose(decomposed.translation, decomposed.rotation, decomposed.scale);

      expectVecClose(mat4TransformAffinePoint3(recomposed, point), mat4TransformAffinePoint3(composed, point));
    }
  });

  it("keeps affine inverse multiplication close to identity", () => {
    const rng = createDeterministicRng(seedFromString("mensura:fuzz:inverse"), "mulberry32");
    for (let i = 0; i < 256; i++) {
      const translation = vec3(rng.range(-10, 10), rng.range(-10, 10), rng.range(-10, 10));
      const rotation = quatNormalize(quat(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)));
      const scale = vec3(rng.range(0.25, 4), rng.range(0.25, 4), rng.range(0.25, 4));
      const matrix = mat4Compose(translation, rotation, scale);
      const inverse = mat4Invert(matrix);
      expect(inverse.ok).toBe(true);
      if (!inverse.ok) continue;

      const product = mat4Multiply(inverse.value, matrix);
      for (let j = 0; j < 16; j++) {
        const expected = j % 5 === 0 ? 1 : 0;
        expect(product[j]).toBeCloseTo(expected, 8);
      }
    }
  });

  it("keeps AABB expansion containing every inserted point", () => {
    const rng = createDeterministicRng(seedFromString("mensura:fuzz:aabb"), "lcg32");
    const box = aabbEmpty();
    const points = [];
    for (let i = 0; i < 512; i++) {
      const p = vec3(rng.range(-100, 100), rng.range(-100, 100), rng.range(-100, 100));
      points.push(p);
      aabbExpandByPointInto(box, p, box);
    }

    for (const p of points) {
      expect(aabbContainsPoint(box, p)).toBe(true);
    }

    const copy = aabb(box.min, box.max);
    expect(copy).toEqual(box);
  });
});

