import { describe, expect, it } from "vitest";
import { normalize3, scaleAndAdd3, vec3 } from "../src/core/index.js";
import { aabb, sphere } from "../src/geometry/index.js";
import { AccelContext, buildBvh, bvhOverlapPairs, bvhRaycast } from "../src/accel/index.js";
import {
  CollisionContext,
  mprIntersect,
  sweptAabbTimeOfImpact,
  sweptSphereTimeOfImpact
} from "../src/collision/index.js";
import { ray } from "../src/geometry/index.js";
import { CollisionWorld } from "../src/world/index.js";
import { detectWasmSimd } from "../src/wasm/index.js";

function sphereSupport(center: ReturnType<typeof vec3>, radius: number) {
  return (direction: ReturnType<typeof vec3>) => {
    const normalized = normalize3(direction);
    return scaleAndAdd3(center, normalized, radius);
  };
}

describe("SAH BVH and broadphase pairs", () => {
  it("builds an SAH BVH that preserves raycast behavior", () => {
    const boxes = [
      aabb(vec3(-1, -1, -5), vec3(1, 1, -3)),
      aabb(vec3(4, 4, -5), vec3(5, 5, -3)),
      aabb(vec3(-1, -1, -10), vec3(1, 1, -8))
    ];
    const bvh = buildBvh(boxes, { maxPrimitivesPerLeaf: 1, splitMethod: "sah", sahBins: 4 });
    const ctx = new AccelContext();

    expect(bvh.ok).toBe(true);
    if (!bvh.ok) return;
    expect(bvhRaycast(bvh.value, ray(vec3(0, 0, 0), vec3(0, 0, -1)), ctx).sort()).toEqual([0, 2]);
  });

  it("emits broadphase overlap pairs from a BVH and CollisionWorld", () => {
    const boxes = [
      aabb(vec3(0, 0, 0), vec3(2, 2, 2)),
      aabb(vec3(1, 1, 1), vec3(3, 3, 3)),
      aabb(vec3(10, 10, 10), vec3(11, 11, 11))
    ];
    const bvh = buildBvh(boxes, { maxPrimitivesPerLeaf: 1, splitMethod: "sah" });
    const ctx = new AccelContext();

    expect(bvh.ok).toBe(true);
    if (!bvh.ok) return;
    expect(bvhOverlapPairs(bvh.value, ctx)).toEqual([{ a: 0, b: 1 }]);

    const world = new CollisionWorld();
    const first = world.addBody(boxes[0]);
    const second = world.addBody(boxes[1]);
    world.addBody(boxes[2]);
    expect(world.updateBvh({ splitMethod: "sah", maxPrimitivesPerLeaf: 1 }).ok).toBe(true);
    expect(world.broadphasePairs()).toEqual([{ a: first, b: second }]);
  });
});

describe("continuous collision detection", () => {
  it("computes swept AABB time of impact", () => {
    const moving = aabb(vec3(0, 0, 0), vec3(1, 1, 1));
    const target = aabb(vec3(3, 0, 0), vec3(4, 1, 1));
    const hit = sweptAabbTimeOfImpact(moving, vec3(4, 0, 0), target);

    expect(hit).not.toBeNull();
    if (!hit) return;
    expect(hit.time).toBeCloseTo(0.5, 10);
    expect(hit.normal).toEqual(vec3(-1, 0, 0));
  });

  it("computes swept sphere time of impact", () => {
    const moving = sphere(vec3(0, 0, 0), 1);
    const target = sphere(vec3(5, 0, 0), 1);
    const hit = sweptSphereTimeOfImpact(moving, vec3(10, 0, 0), target);

    expect(hit).not.toBeNull();
    if (!hit) return;
    expect(hit.time).toBeCloseTo(0.3, 10);
    expect(hit.normal).toEqual(vec3(-1, 0, 0));
  });
});

describe("MPR-style support map query and WASM SIMD status", () => {
  it("classifies convex support-map pairs through the MPR entry point", () => {
    const ctx = new CollisionContext();
    const hit = mprIntersect(
      { center: vec3(0, 0, 0), support: sphereSupport(vec3(0, 0, 0), 1) },
      { center: vec3(1, 0, 0), support: sphereSupport(vec3(1, 0, 0), 1) },
      ctx
    );
    const miss = mprIntersect(
      { center: vec3(0, 0, 0), support: sphereSupport(vec3(0, 0, 0), 1) },
      { center: vec3(4, 0, 0), support: sphereSupport(vec3(4, 0, 0), 1) },
      ctx
    );

    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value.intersect).toBe(true);
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value.intersect).toBe(false);
  });

  it("reports WASM SIMD feature support without requiring a shipped wasm kernel", () => {
    const report = detectWasmSimd();
    expect(typeof report.supported).toBe("boolean");
    expect(report.checkedBytes).toBeGreaterThan(0);
  });
});
