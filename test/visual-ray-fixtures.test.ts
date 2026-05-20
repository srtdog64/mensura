import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Vec3 } from "../src/core/index.js";
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
} from "../examples/visual-ray-fixtures.mjs";

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

const EPSILON = 1e-6;

describe("visual ray fixture regression", () => {
  it("ships a PNG smoke preview for the visual example", () => {
    const preview = readFileSync(new URL("../examples/visual-ray-fixtures-3d-preview.png", import.meta.url));
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    expect([...preview.subarray(0, pngSignature.length)]).toEqual(pngSignature);
    expect(preview.length).toBeGreaterThan(40_000);
  });

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

  it("keeps visual ray hits geometrically valid", () => {
    const data = createRayVisualFixtures(api);
    const byId = new Map(data.fixtures.map((fixture) => [fixture.id, fixture]));

    const aabbFixture = byId.get("ray-aabb");
    expect(aabbFixture).toBeDefined();
    if (aabbFixture?.hit) {
      const box = aabbFixture.shapes[0]?.value;
      assertRayHitPoint(aabbFixture.ray.origin, aabbFixture.ray.direction, aabbFixture.hit, EPSILON);
      assertAabbHit(aabbFixture.hit.point, box.min, box.max, EPSILON);
    }

    const sphereFixture = byId.get("ray-sphere");
    expect(sphereFixture).toBeDefined();
    if (sphereFixture?.hit) {
      const target = sphereFixture.shapes[0]?.value;
      assertRayHitPoint(sphereFixture.ray.origin, sphereFixture.ray.direction, sphereFixture.hit, EPSILON);
      assertSphereHit(sphereFixture.hit.point, target.center, target.radius, EPSILON);
      assertVec3Close(sphereFixture.hit.normal, normalize(sub(sphereFixture.hit.point, target.center)), EPSILON);
    }

    const triangleFixture = byId.get("ray-triangle");
    expect(triangleFixture).toBeDefined();
    if (triangleFixture?.hit) {
      assertRayHitPoint(triangleFixture.ray.origin, triangleFixture.ray.direction, triangleFixture.hit, EPSILON);
      assertTriangleBarycentric(
        triangleFixture.hit.barycentric.x,
        triangleFixture.hit.barycentric.y,
        triangleFixture.hit.barycentric.z,
        EPSILON
      );
    }

    const capsuleFixture = byId.get("ray-capsule");
    expect(capsuleFixture).toBeDefined();
    if (capsuleFixture?.hit) {
      const target = capsuleFixture.shapes[0]?.value;
      assertRayHitPoint(capsuleFixture.ray.origin, capsuleFixture.ray.direction, capsuleFixture.hit, EPSILON);
      assertCapsuleHit(capsuleFixture.hit.point, target.point0, target.point1, target.radius, EPSILON);
      expect(capsuleFixture.debug?.hitPart).toBe("Body");
      assertVec3Close(capsuleFixture.debug?.closestPoint, vec3(0, 0, -4.5), EPSILON);
      assertVec3Close(capsuleFixture.debug?.normal, vec3(1, 0, 0), EPSILON);
    }
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

function assertRayHitPoint(
  origin: Vec3,
  direction: Vec3,
  hit: { readonly distance: number; readonly point: Vec3 },
  epsilon: number
): void {
  const expected = add(origin, scale(direction, hit.distance));

  assertVec3Close(expected, hit.point, epsilon);
  expect(hit.distance).toBeGreaterThanOrEqual(0);
}

function assertAabbHit(point: Vec3, min: Vec3, max: Vec3, epsilon: number): void {
  expect(point.x).toBeGreaterThanOrEqual(min.x - epsilon);
  expect(point.x).toBeLessThanOrEqual(max.x + epsilon);
  expect(point.y).toBeGreaterThanOrEqual(min.y - epsilon);
  expect(point.y).toBeLessThanOrEqual(max.y + epsilon);
  expect(point.z).toBeGreaterThanOrEqual(min.z - epsilon);
  expect(point.z).toBeLessThanOrEqual(max.z + epsilon);

  const onBoundary =
    Math.abs(point.x - min.x) <= epsilon ||
    Math.abs(point.x - max.x) <= epsilon ||
    Math.abs(point.y - min.y) <= epsilon ||
    Math.abs(point.y - max.y) <= epsilon ||
    Math.abs(point.z - min.z) <= epsilon ||
    Math.abs(point.z - max.z) <= epsilon;

  expect(onBoundary).toBe(true);
}

function assertSphereHit(point: Vec3, center: Vec3, radius: number, epsilon: number): void {
  expect(length(sub(point, center))).toBeCloseTo(radius, decimalPlaces(epsilon));
}

function assertTriangleBarycentric(u: number, v: number, w: number, epsilon: number): void {
  expect(u).toBeGreaterThanOrEqual(-epsilon);
  expect(v).toBeGreaterThanOrEqual(-epsilon);
  expect(w).toBeGreaterThanOrEqual(-epsilon);
  expect(u + v + w).toBeCloseTo(1, decimalPlaces(epsilon));
}

function assertCapsuleHit(point: Vec3, capsuleA: Vec3, capsuleB: Vec3, radius: number, epsilon: number): void {
  const closest = closestPointOnSegment(capsuleA, capsuleB, point);
  const distanceToAxis = length(sub(point, closest));

  expect(distanceToAxis).toBeCloseTo(radius, decimalPlaces(epsilon));
}

function assertVec3Close(actual: Vec3, expected: Vec3, epsilon: number): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(epsilon);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(epsilon);
  expect(Math.abs(actual.z - expected.z)).toBeLessThanOrEqual(epsilon);
}

function closestPointOnSegment(a: Vec3, b: Vec3, point: Vec3): Vec3 {
  const ab = sub(b, a);
  const ap = sub(point, a);
  const denom = dot(ab, ab);
  const t = denom === 0 ? 0 : clamp(dot(ap, ab) / denom, 0, 1);

  return add(a, scale(ab, t));
}

function add(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

function scale(value: Vec3, scalar: number): Vec3 {
  return vec3(value.x * scalar, value.y * scalar, value.z * scalar);
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(value: Vec3): number {
  return Math.sqrt(dot(value, value));
}

function normalize(value: Vec3): Vec3 {
  const len = length(value);
  return len === 0 ? vec3(0, 0, 0) : scale(value, 1 / len);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function decimalPlaces(epsilon: number): number {
  return Math.max(0, Math.ceil(-Math.log10(epsilon)));
}
