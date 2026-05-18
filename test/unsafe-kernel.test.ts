import { describe, expect, it } from "vitest";
import {
  unsafeMat4MultiplyF32Many,
  unsafeMat4TransformAffinePoint3F32Many,
  unsafeMat4TransformDirection3F32Many,
  unsafeMat4TransformPoint3F32Many,
  unsafeQuatMultiplyF32Many,
  unsafeVec3AddF32,
  unsafeVec3AddF32Many,
  unsafeVec3AddF32ManyStride16,
  unsafeVec3CrossF32Many,
  unsafeVec3DistanceF32Many,
  unsafeVec3DotF32Many,
  unsafeVec3LengthF32Many,
  unsafeVec3NormalizeF32Many,
  unsafeVec3ScaleF32,
  unsafeVec3ScaleAndAddF32Many,
  unsafeVec3ScaleF32Many,
  unsafeVec3SubF32,
  unsafeVec3SubF32Many
} from "../src/unsafe/index.js";

describe("unsafe Float32Array kernels", () => {
  it("runs single vec3 kernels with explicit offsets", () => {
    const a = new Float32Array([0, 1, 2, 3, 4, 5]);
    const b = new Float32Array([10, 20, 30, 40, 50, 60]);
    const out = new Float32Array(8);

    unsafeVec3AddF32(a, 1, b, 2, out, 3);
    expect([...out.slice(3, 6)]).toEqual([31, 42, 53]);

    unsafeVec3SubF32(b, 2, a, 1, out, 0);
    expect([...out.slice(0, 3)]).toEqual([29, 38, 47]);

    unsafeVec3ScaleF32(a, 1, 2, out, 0);
    expect([...out.slice(0, 3)]).toEqual([2, 4, 6]);
  });

  it("runs packed vec3 many kernels with count-limited writes", () => {
    const a = new Float32Array([1, 2, 3, 4, 5, 6, 100, 100, 100]);
    const b = new Float32Array([10, 20, 30, 40, 50, 60, 100, 100, 100]);
    const out = new Float32Array([-1, -1, -1, -1, -1, -1, -1, -1, -1]);

    unsafeVec3AddF32Many(a, b, out, 2);
    expect([...out]).toEqual([11, 22, 33, 44, 55, 66, -1, -1, -1]);

    unsafeVec3SubF32Many(b, a, out, 2);
    expect([...out.slice(0, 6)]).toEqual([9, 18, 27, 36, 45, 54]);

    unsafeVec3ScaleF32Many(a, 2, out, 2);
    expect([...out.slice(0, 6)]).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it("normalizes packed vec3 values and preserves zero vectors", () => {
    const values = new Float32Array([0, 3, 4, 0, 0, 0]);
    const out = new Float32Array(6);

    unsafeVec3NormalizeF32Many(values, out, 2);

    expect([...out]).toEqual([0, 0.6000000238418579, 0.800000011920929, 0, 0, 0]);
  });

  it("runs packed vec3 scalar-output kernels", () => {
    const a = new Float32Array([1, 2, 3, 4, 5, 6]);
    const b = new Float32Array([10, 20, 30, 40, 50, 60]);
    const out = new Float32Array(2);

    unsafeVec3DotF32Many(a, b, out, 2);
    expect([...out]).toEqual([140, 770]);

    unsafeVec3LengthF32Many(new Float32Array([0, 3, 4, 1, 2, 2]), out, 2);
    expect([...out]).toEqual([5, 3]);

    unsafeVec3DistanceF32Many(
      new Float32Array([0, 0, 0, 1, 1, 1]),
      new Float32Array([0, 3, 4, 4, 5, 1]),
      out,
      2
    );
    expect([...out]).toEqual([5, 5]);
  });

  it("runs packed vec3 cross and scale-and-add kernels", () => {
    const a = new Float32Array([1, 0, 0, 0, 1, 0]);
    const b = new Float32Array([0, 1, 0, 0, 0, 1]);
    const out = new Float32Array(6);

    unsafeVec3CrossF32Many(a, b, out, 2);
    expect([...out]).toEqual([0, 0, 1, 1, 0, 0]);

    unsafeVec3ScaleAndAddF32Many(
      new Float32Array([1, 2, 3, 4, 5, 6]),
      new Float32Array([10, 20, 30, 40, 50, 60]),
      0.5,
      out,
      2
    );
    expect([...out]).toEqual([6, 12, 18, 24, 30, 36]);
  });

  it("runs WGSL stride-16 add and clears the padding lane", () => {
    const a = new Float32Array([1, 2, 3, 99, 4, 5, 6, 99]);
    const b = new Float32Array([10, 20, 30, 99, 40, 50, 60, 99]);
    const out = new Float32Array(8).fill(-1);

    unsafeVec3AddF32ManyStride16(a, b, out, 2);

    expect([...out]).toEqual([11, 22, 33, 0, 44, 55, 66, 0]);
  });

  it("transforms packed vec3 points with an affine matrix", () => {
    const matrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 20, 30, 1
    ]);
    const points = new Float32Array([1, 2, 3, 4, 5, 6]);
    const out = new Float32Array(6);

    unsafeMat4TransformAffinePoint3F32Many(matrix, 0, points, out, 2);

    expect([...out]).toEqual([11, 22, 33, 14, 25, 36]);
  });

  it("transforms packed directions without translation", () => {
    const matrix = new Float32Array([
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      10, 20, 30, 1
    ]);
    const directions = new Float32Array([1, 1, 1, 2, 3, 4]);
    const out = new Float32Array(6);

    unsafeMat4TransformDirection3F32Many(matrix, 0, directions, out, 2);

    expect([...out]).toEqual([2, 3, 4, 4, 9, 16]);
  });

  it("transforms packed vec3 points with a perspective row", () => {
    const matrix = new Float32Array([
      2, 0, 0, 1,
      0, 2, 0, 0,
      0, 0, 2, 0,
      0, 0, 0, 1
    ]);
    const points = new Float32Array([1, 2, 3, 3, 6, 9]);
    const out = new Float32Array(6);

    unsafeMat4TransformPoint3F32Many(matrix, 0, points, out, 2);

    expect([...out]).toEqual([1, 2, 3, 1.5, 3, 4.5]);
  });

  it("multiplies packed quaternions", () => {
    const a = new Float32Array([0, Math.SQRT1_2, 0, Math.SQRT1_2, 0, 0, 0, 1]);
    const b = new Float32Array([0, 0, 0, 1, 0, Math.SQRT1_2, 0, Math.SQRT1_2]);
    const out = new Float32Array(8);

    unsafeQuatMultiplyF32Many(a, b, out, 2);

    expect([...out]).toEqual([
      0,
      Math.fround(Math.SQRT1_2),
      0,
      Math.fround(Math.SQRT1_2),
      0,
      Math.fround(Math.SQRT1_2),
      0,
      Math.fround(Math.SQRT1_2)
    ]);
  });

  it("multiplies packed mat4 pairs and supports output aliasing", () => {
    const translation = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 20, 30, 1
    ];
    const scale = [
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      0, 0, 0, 1
    ];
    const a = new Float32Array([...translation, ...scale]);
    const b = new Float32Array([...scale, ...translation]);
    const out = new Float32Array(32);

    unsafeMat4MultiplyF32Many(a, b, out, 2);

    expect([...out.slice(0, 16)]).toEqual([
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      10, 20, 30, 1
    ]);

    const alias = new Float32Array([...translation]);
    unsafeMat4MultiplyF32Many(alias, new Float32Array(scale), alias, 1);
    expect([...alias]).toEqual([...out.slice(0, 16)]);
  });
});
