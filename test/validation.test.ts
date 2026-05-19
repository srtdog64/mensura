import { describe, expect, it } from "vitest";
import { vec3 } from "../src/core/index.js";
import { aabb, capsule, plane, sphere } from "../src/geometry/index.js";
import {
  validateCapsule,
  validateFiniteAabb,
  validateFiniteNumber,
  validateFiniteVec3,
  validateNonEmptyAabb,
  validatePlane,
  validateRandomDistribution,
  validateRngAlgorithm,
  validateSeed,
  validateSphere,
  validateStableF32,
  validateStableMeasurement,
  validateTriangle,
  sampleDeterministicRange,
  sampleDeterministicUnit,
  seedFromString,
  createDeterministicRng,
  createValidatedDeterministicRng
} from "../src/validation/index.js";

describe("validation layer", () => {
  it("validates finite scalar and vector inputs", () => {
    expect(validateFiniteNumber(1).ok).toBe(true);
    expect(validateFiniteNumber(Number.POSITIVE_INFINITY).ok).toBe(false);

    expect(validateFiniteVec3(vec3(1, 2, 3)).ok).toBe(true);
    const result = validateFiniteVec3(vec3(1, Number.NaN, 3), { label: "point" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_VEC3_NON_FINITE");
      expect(result.error.message).toContain("point");
    }
  });

  it("checks stable measurement ranges and f32 conversion loss", () => {
    expect(validateStableMeasurement(0.25, { min: 0, max: 1, requireF32Stable: true }).ok).toBe(true);

    const below = validateStableMeasurement(-1, { min: 0, label: "distance" });
    expect(below.ok).toBe(false);
    if (!below.ok) {
      expect(below.error.code).toBe("VALIDATION_MEASURE_BELOW_MIN");
    }

    const unstable = validateStableF32(0.1, { maxRelativeLoss: 0, maxUlps: 0 });
    expect(unstable.ok).toBe(false);
    if (!unstable.ok) {
      expect(unstable.error.code).toBe("VALIDATION_F32_UNSTABLE");
    }
  });

  it("separates finite AABB validation from non-empty AABB validation", () => {
    const empty = aabb(vec3(1, 0, 0), vec3(0, 1, 1));

    expect(validateFiniteAabb(empty).ok).toBe(true);

    const nonEmpty = validateNonEmptyAabb(empty, { label: "bounds" });
    expect(nonEmpty.ok).toBe(false);
    if (!nonEmpty.ok) {
      expect(nonEmpty.error.code).toBe("VALIDATION_EMPTY_AABB");
      expect(nonEmpty.error.message).toContain("bounds");
    }
  });

  it("validates shape contracts before query or measure calls", () => {
    expect(validateSphere(sphere(vec3(0, 0, 0), 1)).ok).toBe(true);
    expect(validateSphere(sphere(vec3(0, 0, 0), -1)).ok).toBe(false);

    expect(validateCapsule(capsule(vec3(0, 0, 0), vec3(0, 1, 0), 0.25)).ok).toBe(true);
    expect(validateCapsule(capsule(vec3(0, 0, 0), vec3(0, 1, 0), Number.NaN)).ok).toBe(false);

    expect(validatePlane(plane(vec3(0, 1, 0), 0)).ok).toBe(true);
    const degenerate = validatePlane(plane(vec3(0, 0, 0), 0));
    expect(degenerate.ok).toBe(false);
    if (!degenerate.ok) {
      expect(degenerate.error.code).toBe("VALIDATION_DEGENERATE_PLANE");
    }
  });

  it("returns stable triangle measurements for non-degenerate triangles", () => {
    const result = validateTriangle(vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.doubleArea).toBe(1);
      expect(result.value.area).toBe(0.5);
    }

    const flat = validateTriangle(vec3(0, 0, 0), vec3(1, 0, 0), vec3(2, 0, 0));
    expect(flat.ok).toBe(false);
    if (!flat.ok) {
      expect(flat.error.code).toBe("VALIDATION_DEGENERATE_TRIANGLE");
    }
  });

  it("validates reproducibility seeds and produces deterministic sequences", () => {
    expect(validateSeed(0xffffffff).ok).toBe(true);
    expect(validateSeed(-1).ok).toBe(false);
    expect(validateSeed(1.5).ok).toBe(false);

    const seed = seedFromString("mensura:stress:vec3");
    expect(seed).toBe(seedFromString("mensura:stress:vec3"));
    expect(seed).not.toBe(seedFromString("mensura:stress:mat4"));

    const a = createDeterministicRng(seed);
    const b = createDeterministicRng(seed);
    expect([a.nextUint32(), a.nextUint32(), a.nextUint32()]).toEqual([
      b.nextUint32(),
      b.nextUint32(),
      b.nextUint32()
    ]);

    const checked = createValidatedDeterministicRng(seed, { label: "stress" });
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      const value = checked.value.range(-1, 1);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThan(1);
    }
  });

  it("selects deterministic RNG algorithms and biased sample distributions", () => {
    expect(validateRngAlgorithm("lcg32").ok).toBe(true);
    expect(validateRngAlgorithm("xorshift32").ok).toBe(true);
    expect(validateRngAlgorithm("mulberry32").ok).toBe(true);
    expect(validateRngAlgorithm("native").ok).toBe(false);

    expect(validateRandomDistribution("uniform").ok).toBe(true);
    expect(validateRandomDistribution("edge-biased").ok).toBe(true);
    expect(validateRandomDistribution("gaussian").ok).toBe(true);
    expect(validateRandomDistribution("triangular").ok).toBe(true);
    expect(validateRandomDistribution("poisson").ok).toBe(false);

    const seed = seedFromString("mensura:validation:rng-selection");
    const lcg = createDeterministicRng(seed, "lcg32");
    const xorshift = createDeterministicRng(seed, "xorshift32");
    const mulberry = createDeterministicRng(seed, "mulberry32");

    expect(lcg.algorithm).toBe("lcg32");
    expect(xorshift.algorithm).toBe("xorshift32");
    expect(mulberry.algorithm).toBe("mulberry32");
    expect(xorshift.nextUint32()).toBe(createDeterministicRng(seed, "xorshift32").nextUint32());
    expect(new Set([lcg.nextUint32(), xorshift.nextUint32(), mulberry.nextUint32()]).size).toBe(3);

    const low = createDeterministicRng(seed, "mulberry32");
    const high = createDeterministicRng(seed, "mulberry32");
    const lowValue = sampleDeterministicUnit(low, { distribution: "low-biased", exponent: 3 });
    const highValue = sampleDeterministicUnit(high, { distribution: "high-biased", exponent: 3 });
    expect(lowValue.ok).toBe(true);
    expect(highValue.ok).toBe(true);
    if (lowValue.ok && highValue.ok) {
      expect(lowValue.value + highValue.value).toBeCloseTo(1, 12);
    }

    const edge = createDeterministicRng(seed, "xorshift32");
    const ranged = sampleDeterministicRange(edge, -10, 10, { distribution: "edge-biased" });
    expect(ranged.ok).toBe(true);
    if (ranged.ok) {
      expect(ranged.value).toBeGreaterThanOrEqual(-10);
      expect(ranged.value).toBeLessThanOrEqual(10);
    }

    expect(sampleDeterministicUnit(createDeterministicRng(seed), { exponent: 0 }).ok).toBe(false);

    const checked = createValidatedDeterministicRng(seed, { algorithm: "mulberry32", label: "stress" });
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.value.algorithm).toBe("mulberry32");
      expect(checked.value.range(0, 1, { distribution: "center-biased" })).toBeGreaterThanOrEqual(0);
    }
  });
});
