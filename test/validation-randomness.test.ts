import { describe, expect, it } from "vitest";
import { vec3 } from "../src/core/index.js";
import { aabb } from "../src/geometry/index.js";
import {
  createDeterministicRng,
  forkRng,
  sampleDeterministicInt,
  sampleDeterministicRange,
  sampleDeterministicUnit,
  sampleInAabbInto,
  sampleInUnitBall3Into,
  sampleUnitDirection3Into,
  seedFromString,
  shuffleInPlace,
  summarizeSamples,
  validateUniformBias
} from "../src/validation/index.js";

describe("randomness and bias", () => {
  it("samples the gaussian distribution clamped to the unit interval", () => {
    const seed = seedFromString("mensura:bias:gaussian");
    const rng = createDeterministicRng(seed, "mulberry32");
    const samples: number[] = [];
    for (let i = 0; i < 2048; i++) {
      const draw = sampleDeterministicUnit(rng, { distribution: "gaussian" });
      expect(draw.ok).toBe(true);
      if (draw.ok) {
        expect(draw.value).toBeGreaterThanOrEqual(0);
        expect(draw.value).toBeLessThanOrEqual(1);
        samples.push(draw.value);
      }
    }
    const summary = summarizeSamples(samples);
    // Center mass around 0.5, well inside the unit interval bounds.
    expect(summary.mean).toBeGreaterThan(0.4);
    expect(summary.mean).toBeLessThan(0.6);
  });

  it("samples the triangular distribution averaged around 0.5", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:triangular"));
    const samples: number[] = [];
    for (let i = 0; i < 2048; i++) {
      const draw = sampleDeterministicRange(rng, 0, 1, { distribution: "triangular" });
      expect(draw.ok).toBe(true);
      if (draw.ok) samples.push(draw.value);
    }
    const summary = summarizeSamples(samples);
    expect(summary.mean).toBeGreaterThan(0.45);
    expect(summary.mean).toBeLessThan(0.55);
    // Triangular variance is 1/24 ≈ 0.0417; allow generous tolerance for N=2048.
    expect(summary.variance).toBeGreaterThan(0.02);
    expect(summary.variance).toBeLessThan(0.06);
  });

  it("samples integers uniformly with rejection of bias-zone draws", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:int"));
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 6000; i++) {
      const draw = sampleDeterministicInt(rng, 0, 5);
      expect(draw.ok).toBe(true);
      if (draw.ok) counts[draw.value]++;
    }
    for (const c of counts) {
      // Each bin should land within ~20% of 1000 with N=6000.
      expect(c).toBeGreaterThan(800);
      expect(c).toBeLessThan(1200);
    }
  });

  it("rejects invalid integer ranges through Result", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:int-bad"));
    const inverted = sampleDeterministicInt(rng, 5, 0);
    expect(inverted.ok).toBe(false);
    if (!inverted.ok) {
      expect(inverted.error.code).toBe("VALIDATION_INVALID_RANGE");
    }
    expect(sampleDeterministicInt(rng, 0, 1.5).ok).toBe(false);
  });

  it("Fisher-Yates shuffles deterministically and preserves multiset", () => {
    const seed = seedFromString("mensura:bias:shuffle");
    const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const b = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    shuffleInPlace(createDeterministicRng(seed), a);
    shuffleInPlace(createDeterministicRng(seed), b);

    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // High probability the shuffle is non-identity on 10 elements.
    expect(a).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("samples a unit direction with unit length and isotropic distribution", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:s2"));
    const dir = { x: 0, y: 0, z: 0 };
    const zComponents: number[] = [];
    for (let i = 0; i < 4096; i++) {
      sampleUnitDirection3Into(rng, dir);
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
      expect(len).toBeCloseTo(1, 12);
      zComponents.push(dir.z);
    }
    const summary = summarizeSamples(zComponents);
    // z is uniform on [-1, 1] for a uniform direction; mean should sit near 0.
    expect(Math.abs(summary.mean)).toBeLessThan(0.05);
    expect(summary.min).toBeGreaterThan(-1.0001);
    expect(summary.max).toBeLessThan(1.0001);
  });

  it("samples uniformly inside the unit ball", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:b3"));
    const point = { x: 0, y: 0, z: 0 };
    let inner = 0; // r <= 0.5
    let outer = 0; // r > 0.5
    for (let i = 0; i < 4096; i++) {
      sampleInUnitBall3Into(rng, point);
      const rSq = point.x * point.x + point.y * point.y + point.z * point.z;
      expect(rSq).toBeLessThanOrEqual(1.000001);
      if (rSq <= 0.25) inner++;
      else outer++;
    }
    // Volume of inner half-radius ball is (1/2)^3 = 1/8 of total. Expect inner
    // count to be roughly 1/8 of all samples; allow generous bands.
    const innerFraction = inner / (inner + outer);
    expect(innerFraction).toBeGreaterThan(0.08);
    expect(innerFraction).toBeLessThan(0.18);
  });

  it("samples uniformly inside an AABB and rejects empty AABB", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:aabb"));
    const out = { x: 0, y: 0, z: 0 };
    const box = aabb(vec3(-1, 2, -5), vec3(1, 4, -3));
    for (let i = 0; i < 256; i++) {
      const result = sampleInAabbInto(rng, box, out);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(out.x).toBeGreaterThanOrEqual(-1);
        expect(out.x).toBeLessThanOrEqual(1);
        expect(out.y).toBeGreaterThanOrEqual(2);
        expect(out.y).toBeLessThanOrEqual(4);
        expect(out.z).toBeGreaterThanOrEqual(-5);
        expect(out.z).toBeLessThanOrEqual(-3);
      }
    }

    const empty = sampleInAabbInto(rng, aabb(vec3(1, 0, 0), vec3(0, 1, 1)), out);
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error.code).toBe("VALIDATION_EMPTY_AABB");
    }
  });

  it("forks an RNG into independent named sub-streams", () => {
    const parent = createDeterministicRng(seedFromString("mensura:bias:fork"));
    const replay = createDeterministicRng(seedFromString("mensura:bias:fork"));

    const childA1 = forkRng(parent, "worker-a");
    const childB = forkRng(parent, "worker-b");
    const childA2 = forkRng(replay, "worker-a");
    // childA2 is derived from the same parent state as childA1 because both
    // parents were freshly created from the same seed.
    expect([childA1.nextUint32(), childA1.nextUint32()]).toEqual([
      childA2.nextUint32(),
      childA2.nextUint32()
    ]);
    // Different label -> different stream.
    expect(childA1.nextUint32()).not.toBe(childB.nextUint32());
  });

  it("classifies a uniform sample as within the bias budget", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:uniform-pass"));
    const samples: number[] = [];
    for (let i = 0; i < 4096; i++) samples.push(rng.nextFloat());
    const report = validateUniformBias(samples, { bins: 16, maxRelativeDeviation: 0.2 });
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.value.counts.reduce((a, b) => a + b, 0)).toBe(samples.length);
      expect(report.value.maxRelativeDeviation).toBeLessThanOrEqual(0.2);
    }
  });

  it("classifies a low-biased sample as VALIDATION_BIAS_OUT_OF_BUDGET", () => {
    const rng = createDeterministicRng(seedFromString("mensura:bias:low-fail"));
    const samples: number[] = [];
    for (let i = 0; i < 4096; i++) {
      const draw = sampleDeterministicUnit(rng, { distribution: "low-biased", exponent: 3 });
      if (draw.ok) samples.push(draw.value);
    }
    const report = validateUniformBias(samples, { bins: 16, maxRelativeDeviation: 0.25 });
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.error.code).toBe("VALIDATION_BIAS_OUT_OF_BUDGET");
      expect(typeof report.error.meta?.worstBin).toBe("number");
    }
  });

  it("reports out-of-range bias samples explicitly", () => {
    const result = validateUniformBias([0.1, 0.5, 1.5], { min: 0, max: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_BIAS_SAMPLE_OUT_OF_RANGE");
    }
  });
});
