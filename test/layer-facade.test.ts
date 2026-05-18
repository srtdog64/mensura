import { describe, expect, it } from "vitest";
import { vec3 } from "../src/core/index.js";
import { aabb, ray, sphere } from "../src/geometry/index.js";
import { buildBvh } from "../src/accel/index.js";
import { gjk } from "../src/collision/index.js";
import { rayIntersectsSphere } from "../src/query/index.js";
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

  it("builds acceleration structures from the accel layer", () => {
    const result = buildBvh([aabb(vec3(-1, -1, -2), vec3(1, 1, -1))]);

    expect(result.ok).toBe(true);
  });
});
