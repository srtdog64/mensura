import { describe, expect, it } from "vitest";
import { vec3 } from "../src/core/index.js";
import { aabb, aabbEmpty, sphere } from "../src/geometry/index.js";
import {
  aabbClosestPointChecked,
  aabbDistanceSqToPoint,
  aabbDistanceSqToPointChecked,
  aabbGetBoundingSphereChecked,
  aabbSignedDistanceToPointChecked,
  sphereSignedDistanceToPointChecked,
  triangleBarycentricChecked,
  triangleClosestPointChecked,
  triangleNormalChecked
} from "../src/measure/index.js";

describe("Result-first measure layer", () => {
  it("returns +Infinity for raw distance to an empty AABB", () => {
    expect(aabbDistanceSqToPoint(aabbEmpty(), vec3(0, 0, 0))).toBe(Number.POSITIVE_INFINITY);
  });

  it("classifies empty AABB closest point as MEASURE_EMPTY_DOMAIN", () => {
    const result = aabbClosestPointChecked(aabbEmpty(), vec3(1, 2, 3));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MEASURE_EMPTY_DOMAIN");
      expect(result.error.stage).toBe("Measure");
    }
  });

  it("computes closest point for a non-empty AABB", () => {
    const result = aabbClosestPointChecked(aabb(vec3(0, 0, 0), vec3(1, 1, 1)), vec3(2, -1, 0.5));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(vec3(1, 0, 0.5));
    }
  });

  it("classifies empty AABB distance as MEASURE_EMPTY_DOMAIN through the checked entry", () => {
    const result = aabbDistanceSqToPointChecked(aabbEmpty(), vec3(0, 0, 0));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MEASURE_EMPTY_DOMAIN");
    }
  });

  it("computes signed AABB distance through the checked entry", () => {
    const result = aabbSignedDistanceToPointChecked(aabb(vec3(-1, -1, -1), vec3(1, 1, 1)), vec3(3, 1, 1));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(2, 12);
    }
  });

  it("classifies empty AABB signed distance as MEASURE_EMPTY_DOMAIN", () => {
    const result = aabbSignedDistanceToPointChecked(aabbEmpty(), vec3(0, 0, 0));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MEASURE_EMPTY_DOMAIN");
    }
  });

  it("computes signed sphere distance through the checked entry", () => {
    const result = sphereSignedDistanceToPointChecked(sphere(vec3(0, 0, 0), 2), vec3(0, 0, 5));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(3, 12);
    }
  });

  it("classifies invalid sphere signed distance through validation", () => {
    const result = sphereSignedDistanceToPointChecked(sphere(vec3(0, 0, 0), -1), vec3(0, 0, 0));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_INVALID_RADIUS");
      expect(result.error.stage).toBe("Measure");
    }
  });

  it("classifies non-finite AABB measurement input through validation", () => {
    const result = aabbClosestPointChecked(
      aabb(vec3(0, 0, 0), vec3(1, 1, 1)),
      vec3(Number.NaN, 0, 0)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_VEC3_NON_FINITE");
      expect(result.error.stage).toBe("Measure");
    }
  });

  it("classifies empty AABB bounding sphere as MEASURE_EMPTY_DOMAIN", () => {
    const result = aabbGetBoundingSphereChecked(aabbEmpty());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MEASURE_EMPTY_DOMAIN");
    }
  });

  it("classifies degenerate triangle normal as MEASURE_DEGENERATE", () => {
    const a = vec3(0, 0, 0);
    const b = vec3(1, 0, 0);
    const c = vec3(2, 0, 0); // collinear

    const result = triangleNormalChecked(a, b, c);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MEASURE_DEGENERATE");
      expect(result.error.stage).toBe("Measure");
    }
  });

  it("classifies degenerate triangle barycentric as MEASURE_DEGENERATE", () => {
    const a = vec3(0, 0, 0);
    const b = vec3(1, 0, 0);
    const c = vec3(2, 0, 0);

    const result = triangleBarycentricChecked(a, b, c, vec3(0.5, 0.5, 0));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MEASURE_DEGENERATE");
    }
  });

  it("classifies non-finite triangle measurement input through validation", () => {
    const result = triangleBarycentricChecked(
      vec3(0, 0, 0),
      vec3(1, 0, 0),
      vec3(0, 1, 0),
      vec3(0.25, Number.POSITIVE_INFINITY, 0)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_VEC3_NON_FINITE");
      expect(result.error.stage).toBe("Measure");
    }
  });

  it("classifies degenerate triangle closest point as MEASURE_DEGENERATE", () => {
    const a = vec3(0, 0, 0);
    const b = vec3(0, 0, 0); // duplicate vertex
    const c = vec3(1, 0, 0);

    const result = triangleClosestPointChecked(a, b, c, vec3(0, 1, 0));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MEASURE_DEGENERATE");
    }
  });

  it("returns ok for a real triangle through the checked entries", () => {
    const a = vec3(0, 0, 0);
    const b = vec3(1, 0, 0);
    const c = vec3(0, 1, 0);

    const normal = triangleNormalChecked(a, b, c);
    const bary = triangleBarycentricChecked(a, b, c, vec3(0.25, 0.25, 0));
    const closest = triangleClosestPointChecked(a, b, c, vec3(0.25, 0.25, 0));

    expect(normal.ok).toBe(true);
    expect(bary.ok).toBe(true);
    expect(closest.ok).toBe(true);
    if (normal.ok) expect(normal.value).toEqual(vec3(0, 0, 1));
  });
});
