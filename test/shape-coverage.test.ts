import { describe, expect, it } from "vitest";
import { MAT3_IDENTITY, mat3, vec3 } from "../src/core/index.js";
import {
  aabb,
  aabbEmpty,
  capsule,
  frustumFromMatrixWebGpu,
  obb,
  plane,
  ray,
  sphere
} from "../src/geometry/index.js";
import {
  frustumIntersectsCapsule,
  frustumIntersectsObb,
  obbContainsPoint,
  planeIntersectsAabb,
  planeIntersectsSphere,
  rayCapsuleHitDistance,
  rayIntersectsCapsule,
  rayIntersectsObb,
  rayObbHit,
  rayObbHitDistance
} from "../src/query/index.js";
import {
  obbClosestPoint,
  obbGetAabb,
  obbGetCorners,
  sphereGetAabb,
  sphereSurfaceArea,
  sphereVolume
} from "../src/measure/index.js";
import { mat4PerspectiveWebGpuRh } from "../src/gpu/index.js";
import { unwrap } from "../src/core/index.js";
import {
  validateFrustum,
  validateMat4,
  validateObb,
  validateRay
} from "../src/validation/index.js";

function rotationYMat3(radians: number) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return mat3(
    c, 0, -s,
    0, 1, 0,
    s, 0, c
  );
}

describe("sphere measurements", () => {
  it("computes AABB / surface area / volume", () => {
    const s = sphere(vec3(1, 2, 3), 2);
    const box = sphereGetAabb(s);

    expect(box.min).toEqual(vec3(-1, 0, 1));
    expect(box.max).toEqual(vec3(3, 4, 5));
    expect(sphereSurfaceArea(s)).toBeCloseTo(4 * Math.PI * 4, 10);
    expect(sphereVolume(s)).toBeCloseTo((4 / 3) * Math.PI * 8, 10);
  });

  it("returns an empty AABB and zero area/volume for negative-radius sphere", () => {
    const empty = sphere(vec3(0, 0, 0), -1);
    const box = sphereGetAabb(empty);

    expect(box.min.x).toBe(Number.POSITIVE_INFINITY);
    expect(box.max.x).toBe(Number.NEGATIVE_INFINITY);
    expect(sphereSurfaceArea(empty)).toBe(0);
    expect(sphereVolume(empty)).toBe(0);
  });
});

describe("OBB predicates and measurements", () => {
  it("contains points inside the axis-aligned box and rejects outside", () => {
    const box = obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);

    expect(obbContainsPoint(box, vec3(0, 0, 0))).toBe(true);
    expect(obbContainsPoint(box, vec3(0.9, 0.9, 0.9))).toBe(true);
    expect(obbContainsPoint(box, vec3(1.1, 0, 0))).toBe(false);
  });

  it("respects rotation when classifying point containment", () => {
    const rotated = obb(vec3(0, 0, 0), vec3(1, 1, 1), rotationYMat3(Math.PI / 4));
    // A point sitting on world x=1.2 is outside the world axis box but the
    // rotated frame puts it inside the local box extent on the x axis.
    expect(obbContainsPoint(rotated, vec3(1.2, 0, 0))).toBe(true);
    expect(obbContainsPoint(rotated, vec3(1.5, 0, 0))).toBe(false);
  });

  it("clamps points to the closest surface point in world space", () => {
    const rotated = obb(vec3(0, 0, 0), vec3(1, 1, 1), rotationYMat3(Math.PI / 4));
    const closest = obbClosestPoint(rotated, vec3(3, 0, 0));
    // Closest world x on the rotated box is sqrt(2) ~= 1.414, on the box face.
    expect(closest.x).toBeCloseTo(Math.SQRT2, 6);
    expect(Math.abs(closest.y)).toBeLessThan(1e-12);
  });

  it("computes the world-aligned AABB of a rotated OBB", () => {
    const rotated = obb(vec3(0, 0, 0), vec3(1, 1, 1), rotationYMat3(Math.PI / 4));
    const world = obbGetAabb(rotated);

    expect(world.min.x).toBeCloseTo(-Math.SQRT2, 6);
    expect(world.max.x).toBeCloseTo(Math.SQRT2, 6);
    expect(world.min.y).toBeCloseTo(-1, 10);
    expect(world.max.y).toBeCloseTo(1, 10);
  });

  it("emits 8 corners around the center", () => {
    const corners = obbGetCorners(obb(vec3(0, 0, 0), vec3(1, 2, 3), MAT3_IDENTITY));

    expect(corners).toHaveLength(8);
    expect(corners[0]).toEqual(vec3(-1, -2, -3));
    expect(corners[7]).toEqual(vec3(1, 2, 3));
  });
});

describe("plane intersection coverage", () => {
  it("intersects sphere when |distance| <= radius", () => {
    const xy = plane(vec3(0, 0, 1), 0);

    expect(planeIntersectsSphere(xy, sphere(vec3(0, 0, 0), 1))).toBe(true);
    expect(planeIntersectsSphere(xy, sphere(vec3(0, 0, 0.5), 1))).toBe(true);
    expect(planeIntersectsSphere(xy, sphere(vec3(0, 0, 2), 1))).toBe(false);
  });

  it("intersects AABB by projected extent test", () => {
    const xy = plane(vec3(0, 0, 1), 0);
    const crossing = aabb(vec3(-1, -1, -0.5), vec3(1, 1, 0.5));
    const above = aabb(vec3(-1, -1, 1), vec3(1, 1, 2));

    expect(planeIntersectsAabb(xy, crossing)).toBe(true);
    expect(planeIntersectsAabb(xy, above)).toBe(false);
    expect(planeIntersectsAabb(xy, aabbEmpty())).toBe(false);
  });
});

describe("ray vs OBB / capsule", () => {
  it("hits a rotated OBB through the local-frame slab test", () => {
    const rotated = obb(vec3(0, 0, -5), vec3(1, 1, 1), rotationYMat3(Math.PI / 4));
    const pick = ray(vec3(0, 0, 0), vec3(0, 0, -1));

    expect(rayIntersectsObb(pick, rotated)).toBe(true);
    const hit = rayObbHit(pick, rotated);
    expect(hit).not.toBeNull();
    if (hit) {
      expect(hit.distance).toBeGreaterThan(0);
      expect(hit.distance).toBeLessThan(5);
    }
  });

  it("misses a rotated OBB that is offset off-axis", () => {
    const rotated = obb(vec3(5, 0, -5), vec3(1, 1, 1), rotationYMat3(Math.PI / 4));
    expect(rayObbHitDistance(ray(vec3(0, 0, 0), vec3(0, 0, -1)), rotated)).toBeNull();
  });

  it("hits a capsule body and a capsule cap", () => {
    const cap = capsule(vec3(0, -1, 0), vec3(0, 1, 0), 0.5);
    const middle = rayCapsuleHitDistance(ray(vec3(2, 0, 0), vec3(-1, 0, 0)), cap);
    const top = rayCapsuleHitDistance(ray(vec3(0, 3, 0), vec3(0, -1, 0)), cap);

    expect(middle).not.toBeNull();
    expect(top).not.toBeNull();
    if (middle !== null) expect(middle).toBeCloseTo(1.5, 6);
    if (top !== null) expect(top).toBeCloseTo(1.5, 6);
  });

  it("misses a capsule that is out of range", () => {
    const cap = capsule(vec3(0, -1, 0), vec3(0, 1, 0), 0.5);
    expect(rayIntersectsCapsule(ray(vec3(0, 0, 5), vec3(1, 0, 0)), cap)).toBe(false);
  });

  it("falls through to a sphere when the capsule segment is degenerate", () => {
    const point = capsule(vec3(0, 0, 0), vec3(0, 0, 0), 0.5);
    expect(rayIntersectsCapsule(ray(vec3(-2, 0, 0), vec3(1, 0, 0)), point)).toBe(true);
    expect(rayIntersectsCapsule(ray(vec3(-2, 5, 0), vec3(1, 0, 0)), point)).toBe(false);
  });
});

describe("frustum vs OBB / capsule", () => {
  it("classifies OBB inside and outside the camera frustum", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 0.1, 50));
    const frustum = frustumFromMatrixWebGpu(projection);

    const inside = obb(vec3(0, 0, -5), vec3(1, 1, 1), rotationYMat3(0.3));
    const behind = obb(vec3(0, 0, 5), vec3(1, 1, 1), MAT3_IDENTITY);

    expect(frustumIntersectsObb(frustum, inside)).toBe(true);
    expect(frustumIntersectsObb(frustum, behind)).toBe(false);
  });

  it("classifies capsule inside and outside the camera frustum", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 0.1, 50));
    const frustum = frustumFromMatrixWebGpu(projection);

    const inside = capsule(vec3(0, -1, -5), vec3(0, 1, -5), 0.5);
    const behind = capsule(vec3(0, -1, 5), vec3(0, 1, 5), 0.5);

    expect(frustumIntersectsCapsule(frustum, inside)).toBe(true);
    expect(frustumIntersectsCapsule(frustum, behind)).toBe(false);
    expect(frustumIntersectsCapsule(frustum, capsule(vec3(0, 0, 0), vec3(0, 1, 0), -1))).toBe(false);
  });
});

describe("validation: ray / mat4 / obb / frustum", () => {
  it("validates rays with a non-zero direction", () => {
    expect(validateRay(ray(vec3(0, 0, 0), vec3(1, 0, 0))).ok).toBe(true);

    const zero = validateRay(ray(vec3(0, 0, 0), vec3(0, 0, 0)));
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.error.code).toBe("VALIDATION_DEGENERATE_RAY");
    }

    const nan = validateRay({ origin: vec3(0, 0, 0), direction: vec3(Number.NaN, 0, 0) });
    expect(nan.ok).toBe(false);
    if (!nan.ok) {
      expect(nan.error.code).toBe("VALIDATION_VEC3_NON_FINITE");
    }
  });

  it("validates mat4 finiteness and singular determinant", () => {
    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
    expect(validateMat4(identity, { requireFiniteDeterminant: true }).ok).toBe(true);

    const singular = [
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 1
    ];
    const singularResult = validateMat4(singular, { requireFiniteDeterminant: true });
    expect(singularResult.ok).toBe(false);
    if (!singularResult.ok) {
      expect(singularResult.error.code).toBe("VALIDATION_MAT4_SINGULAR");
    }

    const nan = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, Number.NaN];
    const nanResult = validateMat4(nan);
    expect(nanResult.ok).toBe(false);
    if (!nanResult.ok) {
      expect(nanResult.error.code).toBe("VALIDATION_MAT4_NON_FINITE");
    }
  });

  it("validates OBB extents and orthonormal rotation when requested", () => {
    expect(validateObb(obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY)).ok).toBe(true);

    const negativeExtents = validateObb(obb(vec3(0, 0, 0), vec3(-1, 1, 1), MAT3_IDENTITY));
    expect(negativeExtents.ok).toBe(false);
    if (!negativeExtents.ok) {
      expect(negativeExtents.error.code).toBe("VALIDATION_OBB_NEGATIVE_EXTENTS");
    }

    const skewed = obb(vec3(0, 0, 0), vec3(1, 1, 1), mat3(2, 0, 0, 0, 1, 0, 0, 0, 1));
    const orthonormal = validateObb(skewed, { requireOrthonormalRotation: true });
    expect(orthonormal.ok).toBe(false);
    if (!orthonormal.ok) {
      expect(orthonormal.error.code).toBe("VALIDATION_OBB_NON_ORTHONORMAL");
    }
  });

  it("validates each plane in a frustum", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 10));
    const frustum = frustumFromMatrixWebGpu(projection);

    expect(validateFrustum(frustum).ok).toBe(true);

    const broken = { ...frustum, top: plane(vec3(0, 0, 0), 0) };
    const result = validateFrustum(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_DEGENERATE_PLANE");
    }
  });
});
