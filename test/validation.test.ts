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
  validateSphere,
  validateStableF32,
  validateStableMeasurement,
  validateTriangle
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
});
