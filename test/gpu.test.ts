import { describe, expect, it } from "vitest";
import { mat4TransformPoint3, nearlyEqualAbsRel, unwrap, vec3 } from "../src/core/index.js";
import {
  mat4PerspectiveReverseZWebGpuRh,
  mat4PerspectiveReverseZWebGpuRhInto,
  mat4PerspectiveWebGpuRh,
  mat4PerspectiveWebGpuRhInto,
  mat4ReadFloat32,
  mat4WriteFloat32,
  vec3ReadFloat32,
  vec3WriteFloat32,
  vec3WriteFloat32x4
} from "../src/gpu/index.js";

describe("GPU adapters", () => {
  it("reports invalid perspective arguments through Result.error", () => {
    const invalidFov = mat4PerspectiveWebGpuRh(0, 1, 1, 10);
    expect(invalidFov.ok).toBe(false);
    if (!invalidFov.ok) {
      expect(invalidFov.error.code).toBe("VALIDATION_INVALID_FORMAT");
      expect(invalidFov.error.stage).toBe("ValidateInput");
    }

    expect(mat4PerspectiveWebGpuRh(Math.PI / 2, 0, 1, 10).ok).toBe(false);
    expect(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 0, 10).ok).toBe(false);
    expect(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 10, 1).ok).toBe(false);
  });

  it("writes WebGPU perspective matrices into caller-owned outputs", () => {
    const mutable = [
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    ] as [
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
      number, number, number, number
    ];

    const result = mat4PerspectiveWebGpuRhInto(Math.PI / 2, 1, 1, 10, mutable);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(mutable);
    expect(nearlyEqualAbsRel(mat4TransformPoint3(mutable, vec3(0, 0, -1)).z, 0)).toBe(true);
    expect(nearlyEqualAbsRel(mat4TransformPoint3(mutable, vec3(0, 0, -10)).z, 1)).toBe(true);
  });

  it("supports infinite far perspective depth", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, Number.POSITIVE_INFINITY));

    expect(nearlyEqualAbsRel(mat4TransformPoint3(projection, vec3(0, 0, -1)).z, 0)).toBe(true);
    expect(nearlyEqualAbsRel(mat4TransformPoint3(projection, vec3(0, 0, -1_000_000)).z, 0.999999)).toBe(true);
  });

  it("maps reverse-Z WebGPU perspective with near to 1 and far to 0", () => {
    const projection = unwrap(mat4PerspectiveReverseZWebGpuRh(Math.PI / 2, 1, 1, 10));

    expect(nearlyEqualAbsRel(mat4TransformPoint3(projection, vec3(0, 0, -1)).z, 1)).toBe(true);
    expect(nearlyEqualAbsRel(mat4TransformPoint3(projection, vec3(0, 0, -10)).z, 0)).toBe(true);
  });

  it("supports infinite far reverse-Z perspective by default", () => {
    const projection = unwrap(mat4PerspectiveReverseZWebGpuRh(Math.PI / 2, 1, 1));

    expect(nearlyEqualAbsRel(mat4TransformPoint3(projection, vec3(0, 0, -1)).z, 1)).toBe(true);
    expect(nearlyEqualAbsRel(mat4TransformPoint3(projection, vec3(0, 0, -1_000_000)).z, 0, { abs: 1e-5, rel: 0 })).toBe(true);
  });

  it("writes reverse-Z perspective into caller-owned outputs", () => {
    const mutable = [
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    ] as [
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
      number, number, number, number
    ];

    const result = mat4PerspectiveReverseZWebGpuRhInto(Math.PI / 2, 1, 1, 10, mutable);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(mutable);
  });

  it("bridges vectors and matrices through Float32Array", () => {
    const packed = new Float32Array(24);
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 10));

    expect(vec3WriteFloat32(vec3(1, 2, 3), packed, 0)).toBe(packed);
    expect(vec3WriteFloat32x4(vec3(4, 5, 6), packed, 4, 1)).toBe(packed);
    expect(vec3ReadFloat32(packed, 0)).toEqual(vec3(1, 2, 3));
    expect([...packed.slice(4, 8)]).toEqual([4, 5, 6, 1]);

    expect(mat4WriteFloat32(projection, packed, 8)).toBe(packed);
    expect(mat4ReadFloat32(packed, 8)).toEqual(projection.map((value) => Math.fround(value)));
  });
});
