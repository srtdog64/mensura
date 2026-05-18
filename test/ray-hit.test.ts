import { describe, expect, it } from "vitest";
import { nearlyEqualAbsRel, vec3 } from "../src/core/index.js";
import { aabb, plane, ray, sphere } from "../src/geometry/index.js";
import { rayAabbHit, rayPlaneHit, raySphereHit, rayTriangleHit } from "../src/query/index.js";

describe("Ray hit data", () => {
  it("returns plane hit distance, point, and normal", () => {
    const hit = rayPlaneHit(ray(vec3(0, 0, 0), vec3(0, 0, -1)), plane(vec3(0, 0, 1), 5));

    expect(hit).not.toBeNull();
    expect(hit?.distance).toBe(5);
    expect(hit?.point).toEqual(vec3(0, 0, -5));
    expect(hit?.normal).toEqual(vec3(0, 0, 1));
  });

  it("returns AABB hit distance and point", () => {
    const hit = rayAabbHit(
      ray(vec3(0, 0, 0), vec3(0, 0, -1)),
      aabb(vec3(-1, -1, -6), vec3(1, 1, -4))
    );

    expect(hit).not.toBeNull();
    expect(hit?.distance).toBe(4);
    expect(hit?.point).toEqual(vec3(0, 0, -4));
  });

  it("returns sphere hit distance, point, and outward normal", () => {
    const hit = raySphereHit(ray(vec3(0, 0, 0), vec3(0, 0, -1)), sphere(vec3(0, 0, -5), 1));

    expect(hit).not.toBeNull();
    expect(hit?.distance).toBe(4);
    expect(hit?.point).toEqual(vec3(0, 0, -4));
    expect(hit?.normal).toEqual(vec3(0, 0, 1));
  });

  it("returns triangle hit barycentric data", () => {
    const hit = rayTriangleHit(
      ray(vec3(0, 0, 0), vec3(0, 0, -1)),
      vec3(-1, -1, -5),
      vec3(1, -1, -5),
      vec3(0, 1, -5)
    );

    expect(hit).not.toBeNull();
    expect(hit?.distance).toBe(5);
    expect(hit?.point).toEqual(vec3(0, 0, -5));
    expect(nearlyEqualAbsRel((hit?.barycentric.x ?? 0) + (hit?.barycentric.y ?? 0) + (hit?.barycentric.z ?? 0), 1)).toBe(true);
  });

  it("rejects hits behind the ray origin", () => {
    const hit = raySphereHit(ray(vec3(0, 0, 0), vec3(0, 0, -1)), sphere(vec3(0, 0, 5), 1));

    expect(hit).toBeNull();
  });
});
