import { describe, expect, it } from "vitest";
import { normalize3, vec3 } from "../src/core/index.js";
import { aabb, capsule, ray, sphere } from "../src/geometry/index.js";
import {
  rayAabbHit,
  rayCapsuleHit,
  raySphereHit,
  rayTriangleHit
} from "../src/query/index.js";
import {
  createRayVisualFixtures,
  renderRayVisual3dHtml,
  stableStringify
} from "../scripts/visual-ray-fixtures.mjs";

const api = {
  normalize3,
  vec3,
  aabb,
  capsule,
  ray,
  sphere,
  rayAabbHit,
  rayCapsuleHit,
  raySphereHit,
  rayTriangleHit
};

describe("visual ray fixture regression", () => {
  it("keeps the rendered 3D manifest equal to the computed fixture data", () => {
    const data = createRayVisualFixtures(api);
    const html = renderRayVisual3dHtml(data);
    const match = html.match(/<script id="ray-fixture-data" type="application\/json">([\s\S]*?)<\/script>/);

    expect(match).not.toBeNull();
    if (!match) return;
    expect(JSON.parse(match[1])).toEqual(JSON.parse(stableStringify(data)));
  });

  it("keeps core ray hit values stable for visual fixtures", () => {
    const data = createRayVisualFixtures(api);
    const byId = new Map(data.fixtures.map((fixture) => [fixture.id, fixture]));

    expectHit(byId.get("ray-aabb")?.hit, {
      distance: 4,
      point: vec3(0, 0, -4)
    });

    expectHit(byId.get("ray-sphere")?.hit, {
      distance: 3.8851648071345037,
      point: vec3(-0.5570860145311557, 0, -3.6072849636721103),
      normal: vec3(-0.3713906763541038, 0, 0.9284766908852594)
    });

    const triangle = byId.get("ray-triangle")?.hit;
    expectHit(triangle, {
      distance: 5,
      point: vec3(0.25, 0.25, -5),
      normal: vec3(0, 0, 1)
    });
    expect(triangle?.barycentric.x).toBeCloseTo(0.0625, 12);
    expect(triangle?.barycentric.y).toBeCloseTo(0.3125, 12);
    expect(triangle?.barycentric.z).toBeCloseTo(0.625, 12);
    expect(triangle?.frontFace).toBe(false);

    expectHit(byId.get("ray-capsule")?.hit, {
      distance: 1.5,
      point: vec3(0.5, 0, -4.5)
    });
  });
});

function expectHit(
  actual: { readonly distance: number; readonly point: ReturnType<typeof vec3>; readonly normal?: ReturnType<typeof vec3> } | null | undefined,
  expected: { readonly distance: number; readonly point: ReturnType<typeof vec3>; readonly normal?: ReturnType<typeof vec3> }
): void {
  expect(actual).not.toBeNull();
  expect(actual).toBeDefined();
  if (!actual) return;

  expect(actual.distance).toBeCloseTo(expected.distance, 12);
  expectVec3Close(actual.point, expected.point);
  if (expected.normal) {
    expect(actual.normal).toBeDefined();
    if (actual.normal) {
      expectVec3Close(actual.normal, expected.normal);
    }
  }
}

function expectVec3Close(actual: ReturnType<typeof vec3>, expected: ReturnType<typeof vec3>): void {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
}
