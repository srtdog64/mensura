// Result-first wrappers around `measure` functions.
//
// Raw `measure` functions are hot-path primitives. They return sentinel values
// for undefined domains where that is useful for branch-free predicates:
// `+Infinity` for empty AABB distance, `(1, 0, 0)` for degenerate barycentric
// coordinates, and zero normal for degenerate triangles.
//
// Boundary callers that need observable failure should use these `*Checked`
// variants. They reuse the `validation` layer for finite/non-empty/
// non-degenerate preconditions, then map geometric domain failures to
// measure-specific error codes.

import type { Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { mutableVec3 } from "../core/vec3.js";
import type { Aabb } from "../geometry/aabb.js";
import {
  aabbClosestPointInto,
  aabbDistanceSqToPoint,
  aabbGetBoundingSphereInto,
  aabbIsEmpty,
  aabbSignedDistanceToPoint
} from "../geometry/aabb.js";
import type { MutableSphere, Sphere } from "../geometry/sphere.js";
import { mutableSphere, sphereSignedDistanceToPoint } from "../geometry/sphere.js";
import {
  validateFiniteVec3,
  validateNonEmptyAabb,
  validateSphere,
  validateTriangle
} from "../validation/index.js";
import {
  triangleBarycentricInto,
  triangleClosestPointInto,
  triangleNormalInto
} from "./triangle.js";

const STAGE = "Measure";

function emptyDomain(detail: string, meta?: Record<string, unknown>): Result<never> {
  return err({
    code: "MEASURE_EMPTY_DOMAIN",
    stage: STAGE,
    message: detail,
    retryable: false,
    ...(meta ? { meta } : {})
  });
}

function degenerate(detail: string, meta?: Record<string, unknown>): Result<never> {
  return err({
    code: "MEASURE_DEGENERATE",
    stage: STAGE,
    message: detail,
    retryable: false,
    ...(meta ? { meta } : {})
  });
}

function validateAabbMeasureDomain(box: Aabb, point?: Vec3): Result<true> {
  // Empty AABBs use ±Infinity as the sentinel, which `validateFiniteAabb`
  // would reject with `VALIDATION_VEC3_NON_FINITE` before
  // `validateNonEmptyAabb` ever reached the emptiness check. Catch the empty
  // case up front and map it to the measure-domain error directly. The
  // finite-component pass below then sees a real bounded AABB.
  if (aabbIsEmpty(box)) {
    return emptyDomain("AABB measure requires a non-empty AABB", {
      min: box.min,
      max: box.max
    });
  }

  const boxResult = validateNonEmptyAabb(box, { label: "box", stage: STAGE });
  if (!boxResult.ok) {
    return boxResult;
  }

  if (point) {
    const pointResult = validateFiniteVec3(point, { label: "point", stage: STAGE });
    if (!pointResult.ok) {
      return pointResult;
    }
  }

  return ok(true);
}

function validateTriangleMeasureDomain(a: Vec3, b: Vec3, c: Vec3, p?: Vec3): Result<true> {
  const triangleResult = validateTriangle(a, b, c, { label: "triangle", stage: STAGE });
  if (!triangleResult.ok) {
    if (triangleResult.error.code === "VALIDATION_DEGENERATE_TRIANGLE") {
      return degenerate("Triangle measure requires a non-degenerate triangle", triangleResult.error.meta);
    }
    return triangleResult;
  }

  if (p) {
    const pointResult = validateFiniteVec3(p, { label: "point", stage: STAGE });
    if (!pointResult.ok) {
      return pointResult;
    }
  }

  return ok(true);
}

/**
 * Closest point on the AABB. Empty AABB returns `MEASURE_EMPTY_DOMAIN`
 * because there is no point on the empty set to choose.
 */
export function aabbClosestPointChecked(box: Aabb, point: Vec3): Result<MutableVec3> {
  return aabbClosestPointCheckedInto(box, point, mutableVec3());
}

export function aabbClosestPointCheckedInto(
  box: Aabb,
  point: Vec3,
  out: MutableVec3
): Result<MutableVec3> {
  const domain = validateAabbMeasureDomain(box, point);
  if (!domain.ok) {
    return domain;
  }
  return ok(aabbClosestPointInto(box, point, out));
}

/**
 * Squared distance to the AABB. Empty AABB returns `MEASURE_EMPTY_DOMAIN`.
 *
 * The raw `aabbDistanceSqToPoint` returns `+Infinity` for empty boxes by
 * convention, which is safe for ordering. Use this checked form when the
 * caller must explicitly observe the empty case.
 */
export function aabbDistanceSqToPointChecked(box: Aabb, point: Vec3): Result<number> {
  const domain = validateAabbMeasureDomain(box, point);
  if (!domain.ok) {
    return domain;
  }
  return ok(aabbDistanceSqToPoint(box, point));
}

/**
 * Signed distance to the AABB surface. Empty AABB returns
 * `MEASURE_EMPTY_DOMAIN`.
 */
export function aabbSignedDistanceToPointChecked(box: Aabb, point: Vec3): Result<number> {
  const domain = validateAabbMeasureDomain(box, point);
  if (!domain.ok) {
    return domain;
  }
  return ok(aabbSignedDistanceToPoint(box, point));
}

/**
 * Bounding sphere of the AABB. Empty AABB returns `MEASURE_EMPTY_DOMAIN`.
 *
 * The raw `aabbGetBoundingSphere` returns `radius = -1` (empty-sphere
 * sentinel) for empty boxes. Use this checked form to surface that as a
 * `Result`.
 */
export function aabbGetBoundingSphereChecked(box: Aabb): Result<MutableSphere> {
  return aabbGetBoundingSphereCheckedInto(box, mutableSphere());
}

export function aabbGetBoundingSphereCheckedInto(
  box: Aabb,
  out: MutableSphere
): Result<MutableSphere> {
  const domain = validateAabbMeasureDomain(box);
  if (!domain.ok) {
    return domain;
  }
  return ok(aabbGetBoundingSphereInto(box, out));
}

/**
 * Signed distance to the sphere surface. Invalid sphere radius returns the
 * validation layer's `VALIDATION_INVALID_RADIUS`.
 */
export function sphereSignedDistanceToPointChecked(value: Sphere, point: Vec3): Result<number> {
  const sphereResult = validateSphere(value, { label: "sphere", stage: STAGE });
  if (!sphereResult.ok) {
    return sphereResult;
  }

  const pointResult = validateFiniteVec3(point, { label: "point", stage: STAGE });
  if (!pointResult.ok) {
    return pointResult;
  }

  return ok(sphereSignedDistanceToPoint(value, point));
}

/**
 * Triangle normal. Degenerate triangle (zero area / collinear vertices)
 * returns `MEASURE_DEGENERATE`.
 */
export function triangleNormalChecked(a: Vec3, b: Vec3, c: Vec3): Result<MutableVec3> {
  return triangleNormalCheckedInto(a, b, c, mutableVec3());
}

export function triangleNormalCheckedInto(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  out: MutableVec3
): Result<MutableVec3> {
  const domain = validateTriangleMeasureDomain(a, b, c);
  if (!domain.ok) {
    return domain;
  }
  return ok(triangleNormalInto(a, b, c, out));
}

/**
 * Barycentric coordinates of `p` in triangle `(a, b, c)`. Degenerate
 * triangle returns `MEASURE_DEGENERATE`.
 */
export function triangleBarycentricChecked(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  p: Vec3
): Result<MutableVec3> {
  return triangleBarycentricCheckedInto(a, b, c, p, mutableVec3());
}

export function triangleBarycentricCheckedInto(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  p: Vec3,
  out: MutableVec3
): Result<MutableVec3> {
  const domain = validateTriangleMeasureDomain(a, b, c, p);
  if (!domain.ok) {
    return domain;
  }
  return ok(triangleBarycentricInto(a, b, c, p, out));
}

/**
 * Closest point on triangle `(a, b, c)` to `p`. Degenerate triangle returns
 * `MEASURE_DEGENERATE`; without a real triangle, "closest point on the
 * surface" is not well-defined (it collapses to a segment or a point).
 */
export function triangleClosestPointChecked(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  p: Vec3
): Result<MutableVec3> {
  return triangleClosestPointCheckedInto(a, b, c, p, mutableVec3());
}

export function triangleClosestPointCheckedInto(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  p: Vec3,
  out: MutableVec3
): Result<MutableVec3> {
  const domain = validateTriangleMeasureDomain(a, b, c, p);
  if (!domain.ok) {
    return domain;
  }
  return ok(triangleClosestPointInto(a, b, c, p, out));
}
