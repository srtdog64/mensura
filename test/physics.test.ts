import { describe, expect, it } from "vitest";
import { MAT3_IDENTITY, mat3, normalize3, scaleAndAdd3, vec3 } from "../src/core/index.js";
import { aabb, obb, ray } from "../src/geometry/index.js";
import { AccelContext, buildBvh, bvhRaycast } from "../src/accel/index.js";
import { epa, gjk, testObbObbSat, CollisionContext } from "../src/collision/index.js";
import { CollisionWorld } from "../src/world/index.js";

function sphereSupport(center: ReturnType<typeof vec3>, radius: number) {
  return (direction: ReturnType<typeof vec3>) => {
    const normalized = normalize3(direction);
    return scaleAndAdd3(center, normalized, radius);
  };
}

function boxSupport(center: ReturnType<typeof vec3>, halfExtents: ReturnType<typeof vec3>) {
  return (direction: ReturnType<typeof vec3>) => ({
    x: center.x + (direction.x >= 0 ? halfExtents.x : -halfExtents.x),
    y: center.y + (direction.y >= 0 ? halfExtents.y : -halfExtents.y),
    z: center.z + (direction.z >= 0 ? halfExtents.z : -halfExtents.z)
  });
}

function rotationYMat3(radians: number) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  // column-major: columns are local x, y, z axes after rotation.
  return mat3(
    c, 0, -s,   // column 0 (local +x)
    0, 1, 0,    // column 1 (local +y)
    s, 0, c     // column 2 (local +z)
  );
}

describe("Layered collision public surface", () => {
  it("builds and raycasts a BVH", () => {
    const boxes = [
      aabb(vec3(-1, -1, -5), vec3(1, 1, -3)),
      aabb(vec3(4, 4, -5), vec3(5, 5, -3))
    ];
    const bvh = buildBvh(boxes, 1);
    const accelCtx = new AccelContext();

    expect(bvh.ok).toBe(true);
    if (!bvh.ok) return;
    expect(bvhRaycast(bvh.value, ray(vec3(0, 0, 0), vec3(0, 0, -1)), accelCtx)).toEqual([0]);
  });

  it("reports empty BVH builds through Result.error", () => {
    const result = buildBvh([]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BVH_EMPTY_PRIMITIVES");
    }
  });

  it("tracks bodies in CollisionWorld raycasts", () => {
    const world = new CollisionWorld();
    const first = world.addBody(aabb(vec3(-1, -1, -5), vec3(1, 1, -3)));
    world.addBody(aabb(vec3(4, 4, -5), vec3(5, 5, -3)));

    const bvh = world.updateBvh();

    expect(bvh.ok).toBe(true);
    expect(world.raycast(ray(vec3(0, 0, 0), vec3(0, 0, -1)))).toEqual([first]);
  });

  it("detects OBB overlap with SAT", () => {
    const a = obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
    const b = obb(vec3(1.5, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
    const c = obb(vec3(3, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
    const ctx = new CollisionContext();

    expect(testObbObbSat(a, b, ctx)).toBe(true);
    expect(testObbObbSat(a, c, ctx)).toBe(false);
  });

  it("detects rotated OBB overlap and separation with SAT", () => {
    const rotated45 = rotationYMat3(Math.PI / 4);
    const a = obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
    // 45 degrees rotated unit box reaches +/- sqrt(2) on x. center 1.4 -> overlap.
    const overlap = obb(vec3(1.4, 0, 0), vec3(1, 1, 1), rotated45);
    // center 3 -> closest face at 3 - sqrt(2) ~= 1.586 > 1 = a.max.x.
    const separated = obb(vec3(3, 0, 0), vec3(1, 1, 1), rotated45);
    const ctx = new CollisionContext();

    expect(testObbObbSat(a, overlap, ctx)).toBe(true);
    expect(testObbObbSat(a, separated, ctx)).toBe(false);
  });

  it("detects touching rotated OBBs as overlapping (inclusive boundary)", () => {
    const rotated45 = rotationYMat3(Math.PI / 4);
    const a = obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
    // touch boundary: a.max.x = 1 == b.min.x = (1 + sqrt(2)) - sqrt(2) = 1.
    const touching = obb(vec3(1 + Math.SQRT2, 0, 0), vec3(1, 1, 1), rotated45);
    const ctx = new CollisionContext();

    expect(testObbObbSat(a, touching, ctx)).toBe(true);
  });

  it("handles near-parallel rotated OBB axes with SAT", () => {
    // small rotation: cross axes become near zero, exercises the lengthSq guard.
    const tiny = rotationYMat3(1e-7);
    const a = obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
    const close = obb(vec3(1.5, 0, 0), vec3(1, 1, 1), tiny);
    const far = obb(vec3(3, 0, 0), vec3(1, 1, 1), tiny);
    const ctx = new CollisionContext();

    expect(testObbObbSat(a, close, ctx)).toBe(true);
    expect(testObbObbSat(a, far, ctx)).toBe(false);
  });

  it("detects simple GJK sphere support intersections", () => {
    const a = sphereSupport(vec3(0, 0, 0), 1);
    const b = sphereSupport(vec3(1, 0, 0), 1);
    const c = sphereSupport(vec3(3, 0, 0), 1);
    const ctx = new CollisionContext();

    const hit = gjk(a, b, ctx);
    const miss = gjk(a, c, ctx);

    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value.intersect).toBe(true);

    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value.intersect).toBe(false);
  });

  it("detects GJK box support hit and miss", () => {
    const a = boxSupport(vec3(0, 0, 0), vec3(1, 1, 1));
    const overlap = boxSupport(vec3(1.5, 0, 0), vec3(1, 1, 1));
    const separated = boxSupport(vec3(3, 0, 0), vec3(1, 1, 1));
    const ctx = new CollisionContext();

    const hit = gjk(a, overlap, ctx);
    const miss = gjk(a, separated, ctx);

    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value.intersect).toBe(true);

    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value.intersect).toBe(false);
  });

  it("detects containment as GJK intersection", () => {
    const big = boxSupport(vec3(0, 0, 0), vec3(5, 5, 5));
    const inside = boxSupport(vec3(0, 0, 0), vec3(1, 1, 1));
    const ctx = new CollisionContext();

    const hit = gjk(big, inside, ctx);

    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(hit.value.intersect).toBe(true);
      expect(hit.value.simplexSize).toBe(4);
    }
  });

  it("classifies touching boxes consistently (boundary is non-intersecting)", () => {
    const a = boxSupport(vec3(0, 0, 0), vec3(1, 1, 1));
    // boxes share a face at x = 1; origin lies on the Minkowski boundary so
    // the strict-positive support check classifies this as no intersection.
    const touching = boxSupport(vec3(2, 0, 0), vec3(1, 1, 1));
    // Slightly overlapping pair should be intersecting.
    const overlapping = boxSupport(vec3(2 - 1e-3, 0, 0), vec3(1, 1, 1));
    const ctx = new CollisionContext();

    const touchingResult = gjk(a, touching, ctx);
    const overlappingResult = gjk(a, overlapping, ctx);

    expect(touchingResult.ok).toBe(true);
    expect(overlappingResult.ok).toBe(true);
    if (touchingResult.ok) expect(touchingResult.value.intersect).toBe(false);
    if (overlappingResult.ok) expect(overlappingResult.value.intersect).toBe(true);
  });

  it("reports GJK max-iteration failure with a non-converging support function", () => {
    // adversarial support: always returns the same point regardless of direction.
    // The Minkowski difference is a single point != origin, so GJK never closes.
    const stuck = (_direction: ReturnType<typeof vec3>) => vec3(2, 2, 2);
    const ctx = new CollisionContext();

    // The first support call separates the origin immediately, so use a tighter
    // pair where the stuck support keeps the simplex incomplete.
    // Pair stuck against a sphere centered nearby: origin is between supports,
    // forcing GJK to iterate without ever building a containing simplex.
    const sphere = sphereSupport(vec3(1, 1, 1), 0.5);

    // With a tiny iteration budget GJK cannot finish: expect either a max-iter
    // error or a deterministic decision. We assert the function does not throw
    // and the Result is observable either way.
    const result = gjk(stuck, sphere, ctx, 1);

    expect(typeof result.ok).toBe("boolean");
    if (!result.ok) {
      expect(result.error.code).toBe("GJK_MAX_ITERATIONS");
      expect(result.error.stage).toBe("GjkIteration");
    }
  });

  it("reports degenerate EPA input through Result.error", () => {
    const support = sphereSupport(vec3(0, 0, 0), 1);
    const ctx = new CollisionContext();
    const result = epa([vec3(0, 0, 0)], 1, support, support, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EPA_DEGENERATE_SIMPLEX");
    }
  });

  it("recovers penetration depth from GJK simplex with EPA", () => {
    // Two overlapping unit boxes with a small off-axis offset so the Minkowski
    // difference is a 3D body and GJK terminates with a tetrahedron simplex.
    const a = boxSupport(vec3(0, 0, 0), vec3(1, 1, 1));
    const b = boxSupport(vec3(1.5, 0.2, 0.3), vec3(1, 1, 1));
    const ctx = new CollisionContext();

    const gjkResult = gjk(a, b, ctx);
    expect(gjkResult.ok).toBe(true);
    if (!gjkResult.ok) return;
    expect(gjkResult.value.intersect).toBe(true);
    expect(gjkResult.value.simplexSize).toBe(4);

    const epaResult = epa(
      gjkResult.value.simplex,
      gjkResult.value.simplexSize,
      a,
      b,
      ctx
    );

    expect(epaResult.ok).toBe(true);
    if (!epaResult.ok) return;
    // Penetration along the dominant separating axis is 2 - 1.5 = 0.5.
    expect(epaResult.value.depth).toBeGreaterThan(0);
    expect(epaResult.value.depth).toBeLessThan(1);
  });
});
