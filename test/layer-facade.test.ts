import { describe, expect, it } from "vitest";
import { vec3 } from "../src/core/index.js";
import { aabb, ray, sphere } from "../src/geometry/index.js";
import { buildBvh } from "../src/accel/index.js";
import { gjk } from "../src/collision/index.js";
import { rayIntersectsSphere } from "../src/query/index.js";
import { aabbClosestPoint, capsuleGetAabb, triangleArea } from "../src/measure/index.js";
import { CollisionWorld } from "../src/world/index.js";
import {
  buildBvh as buildBvhCompat,
  CollisionWorld as CollisionWorldCompat,
  gjk as gjkCompat
} from "../src/physics/index.js";

describe("Layer facades", () => {
  it("keeps physics as a compatibility facade over public layers", () => {
    expect(buildBvhCompat).toBe(buildBvh);
    expect(gjkCompat).toBe(gjk);
    expect(CollisionWorldCompat).toBe(CollisionWorld);
  });

  it("exposes spatial queries separately from primitive construction", () => {
    const pickRay = ray(vec3(0, 0, 0), vec3(0, 0, -1));
    const target = sphere(vec3(0, 0, -3), 1);

    expect(rayIntersectsSphere(pickRay, target)).toBe(true);
  });

  it("exposes derived primitive measurements separately from queries", () => {
    expect(triangleArea(vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0))).toBe(0.5);
    expect(aabbClosestPoint(aabb(vec3(0, 0, 0), vec3(1, 1, 1)), vec3(2, 0.5, -1))).toEqual(vec3(1, 0.5, 0));
    expect(capsuleGetAabb({ point0: vec3(0, 0, 0), point1: vec3(0, 2, 0), radius: 0.5 }).max).toEqual(vec3(0.5, 2.5, 0.5));
  });

  it("builds acceleration structures from the accel layer", () => {
    const result = buildBvh([aabb(vec3(-1, -1, -2), vec3(1, 1, -1))]);

    expect(result.ok).toBe(true);
  });
});
