import { describe, expect, it } from "vitest";
import { mat4Translation, vec3 } from "../src/core/index.js";
import {
  WGSL_VEC3F_ALIGN_BYTES,
  unsafeMat4ReadDataViewF32,
  unsafeMat4ReadFloat32,
  unsafeMat4WriteDataViewF32,
  unsafeMat4WriteFloat32,
  unsafeVec3ReadDataViewF32,
  unsafeVec3ReadFloat32,
  unsafeVec3WriteDataViewF32,
  unsafeVec3WriteFloat32,
  unsafeWgslVec3WriteDataViewF32
} from "../src/unsafe/index.js";

describe("unsafe f32 projection", () => {
  it("reads and writes vec3 values without ownership checks", () => {
    const packed = new Float32Array(8);

    unsafeVec3WriteFloat32(vec3(1, 2, 3), packed, 2);

    expect(unsafeVec3ReadFloat32(packed, 2)).toEqual(vec3(1, 2, 3));
  });

  it("reads and writes vec3 values through DataView byte offsets", () => {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);

    unsafeVec3WriteDataViewF32(vec3(4, 5, 6), view, 4);

    expect(unsafeVec3ReadDataViewF32(view, 4)).toEqual(vec3(4, 5, 6));
  });

  it("writes vec3 values with WGSL vec3f stride padding", () => {
    const view = new DataView(new ArrayBuffer(WGSL_VEC3F_ALIGN_BYTES));

    unsafeWgslVec3WriteDataViewF32(vec3(7, 8, 9), view, 0);

    expect(unsafeVec3ReadDataViewF32(view, 0)).toEqual(vec3(7, 8, 9));
    expect(view.getFloat32(12, true)).toBe(0);
  });

  it("reads and writes mat4 values through typed arrays and DataView", () => {
    const matrix = mat4Translation(vec3(1, 2, 3));
    const packed = new Float32Array(20);

    unsafeMat4WriteFloat32(matrix, packed, 2);
    expect(unsafeMat4ReadFloat32(packed, 2)).toEqual(matrix);

    const view = new DataView(new ArrayBuffer(64));
    unsafeMat4WriteDataViewF32(matrix, view, 0);
    expect(unsafeMat4ReadDataViewF32(view, 0)).toEqual(matrix);
  });
});
