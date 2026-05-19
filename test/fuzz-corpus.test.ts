import { describe, expect, it } from "vitest";
import {
  add3,
  distance3,
  length3,
  mutableVec3,
  scaleAndAdd3,
  scaleAndAdd3Into,
  scale3,
  sub3,
  vec3
} from "../src/core/index.js";
import {
  aabb,
  aabbContainsPoint,
  aabbEmpty,
  aabbExpandByPointInto,
  aabbGetBoundingSphere,
  ray,
  rayAt,
  raySphereHit,
  raySphereHitDistance,
  rayTriangleHit,
  sphere
} from "../src/geometry/index.js";
import { sphereContainsPoint } from "../src/query/index.js";
import {
  DETERMINISTIC_RNG_ALGORITHMS,
  RANDOM_DISTRIBUTIONS,
  createDeterministicRng,
  sampleInUnitBall3Into,
  sampleUnitDirection3Into,
  seedFromString,
  summarizeSamples,
  validateUniformBias,
  type DeterministicRngAlgorithm,
  type RandomDistribution
} from "../src/validation/index.js";

const CORPUS_COUNT = 4096;
const EPS = 1e-8;

function expectVecClose(actual: { x: number; y: number; z: number }, expected: { x: number; y: number; z: number }, precision = 8): void {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

function corpusSeed(label: string, algorithm: DeterministicRngAlgorithm): number {
  return seedFromString(`mensura:fuzz-corpus:${label}:${algorithm}`);
}

describe("long deterministic fuzz corpus", () => {
  it("keeps geometric samplers inside their declared domains across RNG algorithms", () => {
    for (const algorithm of DETERMINISTIC_RNG_ALGORITHMS) {
      const rng = createDeterministicRng(corpusSeed("samplers", algorithm), algorithm);
      const direction = mutableVec3();
      const point = mutableVec3();

      for (let i = 0; i < CORPUS_COUNT; i++) {
        sampleUnitDirection3Into(rng, direction);
        expect(length3(direction)).toBeCloseTo(1, 12);

        sampleInUnitBall3Into(rng, point);
        expect(length3(point)).toBeLessThanOrEqual(1 + EPS);
      }
    }
  });

  it("keeps random distributions finite and reproducible under a longer corpus", () => {
    for (const algorithm of DETERMINISTIC_RNG_ALGORITHMS) {
      for (const distribution of RANDOM_DISTRIBUTIONS) {
        const rng = createDeterministicRng(corpusSeed(`distribution:${distribution}`, algorithm), algorithm);
        const samples = new Float64Array(CORPUS_COUNT);

        for (let i = 0; i < samples.length; i++) {
          samples[i] = rng.sample({ distribution });
        }

        const summary = summarizeSamples(samples);
        expect(summary.count).toBe(samples.length);
        expect(summary.min).toBeGreaterThanOrEqual(0);
        expect(summary.max).toBeLessThanOrEqual(1);
        expect(summary.mean).toBeGreaterThanOrEqual(0);
        expect(summary.mean).toBeLessThanOrEqual(1);
        expect(summary.variance).toBeGreaterThanOrEqual(0);

        if (distribution === "uniform") {
          const bias = validateUniformBias(samples, { bins: 16, maxRelativeDeviation: 0.35 });
          expect(bias.ok).toBe(true);
        }
      }
    }
  });

  it("keeps constructed ray/sphere hits numerically consistent", () => {
    for (const algorithm of DETERMINISTIC_RNG_ALGORITHMS) {
      const rng = createDeterministicRng(corpusSeed("ray-sphere", algorithm), algorithm);
      const direction = mutableVec3();

      for (let i = 0; i < CORPUS_COUNT; i++) {
        sampleUnitDirection3Into(rng, direction);
        const radius = rng.range(0.01, 25);
        const distance = rng.range(0.01, 100);
        const center = vec3(rng.range(-100, 100), rng.range(-100, 100), rng.range(-100, 100));
        const origin = scaleAndAdd3(center, direction, -(radius + distance));
        const r = ray(origin, direction);
        const target = sphere(center, radius);
        const hitDistance = raySphereHitDistance(r, target);
        const hit = raySphereHit(r, target);

        expect(hitDistance).not.toBeNull();
        expect(hit).not.toBeNull();
        if (hitDistance === null || hit === null) continue;

        expect(hitDistance).toBeCloseTo(distance, 8);
        expect(hit.distance).toBeCloseTo(hitDistance, 12);
        expect(distance3(rayAt(r, hitDistance), hit.point)).toBeCloseTo(0, 10);
        expect(distance3(target.center, hit.point)).toBeLessThanOrEqual(target.radius + 1e-7);
      }
    }
  });

  it("keeps constructed ray/triangle hits and barycentric data coherent", () => {
    for (const algorithm of DETERMINISTIC_RNG_ALGORITHMS) {
      const rng = createDeterministicRng(corpusSeed("ray-triangle", algorithm), algorithm);

      for (let i = 0; i < CORPUS_COUNT; i++) {
        const z = rng.range(-50, 50);
        const a = vec3(rng.range(-100, 100), rng.range(-100, 100), z);
        const sx = rng.range(0.01, 50);
        const sy = rng.range(0.01, 50);
        const b = vec3(a.x + sx, a.y, z);
        const c = vec3(a.x, a.y + sy, z);
        const u = rng.sample({ distribution: "center-biased" });
        const v = rng.sample({ distribution: "center-biased" }) * (1 - u);
        const w = 1 - u - v;
        const point = add3(add3(scale3(a, u), scale3(b, v)), scale3(c, w));
        const distance = rng.range(0.01, 100);
        const r = ray(vec3(point.x, point.y, point.z + distance), vec3(0, 0, -1));
        const hit = rayTriangleHit(r, a, b, c);

        expect(hit).not.toBeNull();
        if (hit === null) continue;

        expect(hit.distance).toBeCloseTo(distance, 8);
        expectVecClose(hit.point, point, 8);
        expect(hit.barycentric.x + hit.barycentric.y + hit.barycentric.z).toBeCloseTo(1, 12);
        expect(hit.barycentric.x).toBeGreaterThanOrEqual(-EPS);
        expect(hit.barycentric.y).toBeGreaterThanOrEqual(-EPS);
        expect(hit.barycentric.z).toBeGreaterThanOrEqual(-EPS);
      }
    }
  });

  it("keeps expanded AABB and derived bounding sphere coherent over shuffled corpus data", () => {
    for (const algorithm of DETERMINISTIC_RNG_ALGORITHMS) {
      const rng = createDeterministicRng(corpusSeed("aabb-sphere", algorithm), algorithm);
      const box = aabbEmpty();
      const points = [];

      for (let i = 0; i < CORPUS_COUNT; i++) {
        const p = mutableVec3();
        sampleInUnitBall3Into(rng, p);
        scaleAndAdd3Into(vec3(rng.range(-10, 10), rng.range(-10, 10), rng.range(-10, 10)), p, rng.range(0.1, 100), p);
        points.push(vec3(p.x, p.y, p.z));
        aabbExpandByPointInto(box, p, box);
      }

      const immutableBox = aabb(box.min, box.max);
      const bounds = aabbGetBoundingSphere(immutableBox);
      for (const point of points) {
        expect(aabbContainsPoint(immutableBox, point)).toBe(true);
        expect(sphereContainsPoint(bounds, point)).toBe(true);
      }
    }
  });
});
