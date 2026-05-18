import { describe, expect, it } from "vitest";
import { MAT3_IDENTITY, normalize3, scaleAndAdd3, vec3 } from "../src/core/index.js";
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

  it("reports degenerate EPA input through Result.error", () => {
    const support = sphereSupport(vec3(0, 0, 0), 1);
    const ctx = new CollisionContext();
    const result = epa([vec3(0, 0, 0)], support, support, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EPA_DEGENERATE_SIMPLEX");
    }
  });
});
