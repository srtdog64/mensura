import { describe, expect, it } from "vitest";
import {
  add3,
  add3Into,
  cross3,
  cross3Into,
  distance3,
  distanceSq3,
  dot3,
  length3,
  mutableVec3,
  nearlyEqualAbsRel,
  normalize3,
  scale3,
  scaleAndAdd3,
  sub3,
  vec3
} from "../src/core/index.js";
import { vec3ReadFloat32, vec3WriteFloat32, vec3WriteFloat32x4 } from "../src/gpu/index.js";

describe("Vec3", () => {
  it("computes basic vector operations", () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);

    expect(add3(a, b)).toEqual(vec3(5, 7, 9));
    expect(sub3(b, a)).toEqual(vec3(3, 3, 3));
    expect(scale3(a, 2)).toEqual(vec3(2, 4, 6));
    expect(dot3(a, b)).toBe(32);
    expect(cross3(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
    expect(distanceSq3(a, b)).toBe(27);
    expect(distance3(a, b)).toBe(Math.sqrt(27));
    expect(length3(vec3(0, 3, 4))).toBe(5);
    expect(scaleAndAdd3(a, b, 2)).toEqual(vec3(9, 12, 15));
  });

  it("writes into caller-owned vector objects for hot paths", () => {
    const out = mutableVec3();

    expect(add3Into(vec3(1, 2, 3), vec3(4, 5, 6), out)).toBe(out);
    expect(out).toEqual(vec3(5, 7, 9));

    expect(cross3Into(vec3(1, 0, 0), vec3(0, 1, 0), out)).toBe(out);
    expect(out).toEqual(vec3(0, 0, 1));
  });

  it("normalizes while keeping zero vectors stable", () => {
    const normalized = normalize3(vec3(0, 3, 4));

    expect(normalized.x).toBe(0);
    expect(nearlyEqualAbsRel(normalized.y, 0.6)).toBe(true);
    expect(nearlyEqualAbsRel(normalized.z, 0.8)).toBe(true);
    expect(normalize3(vec3(0, 0, 0))).toEqual(vec3(0, 0, 0));
  });

  it("bridges to packed Float32Array storage without changing the public shape", () => {
    const packed = new Float32Array(8);

    vec3WriteFloat32(vec3(1, 2, 3), packed, 1);
    expect([...packed.slice(1, 4)]).toEqual([1, 2, 3]);
    expect(vec3ReadFloat32(packed, 1)).toEqual(vec3(1, 2, 3));

    vec3WriteFloat32x4(vec3(4, 5, 6), packed, 4, 1);
    expect([...packed.slice(4, 8)]).toEqual([4, 5, 6, 1]);
  });
});
