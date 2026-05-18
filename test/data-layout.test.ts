import { describe, expect, it } from "vitest";
import { mat4Translation, unwrap, vec3 } from "../src/core/index.js";
import {
  aabbReadWgslDataViewF32,
  aabbWriteWgslDataViewF32,
  mat4ReadDataViewF32,
  mat4WriteDataViewF32,
  validateDataViewLayout,
  wgslVec3ReadDataViewF32,
  wgslVec3WriteDataViewF32
} from "../src/data/index.js";
import { aabb } from "../src/geometry/index.js";
import {
  WGSL_AABB3F_LAYOUT,
  WGSL_MAT4X4F_LAYOUT,
  WGSL_VEC3F_LAYOUT,
  alignByteOffset,
  byteLengthForLayout,
  isByteOffsetAligned
} from "../src/layout/index.js";

describe("layout metadata", () => {
  it("describes WGSL vec3, mat4, and AABB records", () => {
    expect(WGSL_VEC3F_LAYOUT).toEqual({ sizeBytes: 12, alignBytes: 16, strideBytes: 16 });
    expect(WGSL_MAT4X4F_LAYOUT).toEqual({ sizeBytes: 64, alignBytes: 16, strideBytes: 64 });
    expect(WGSL_AABB3F_LAYOUT).toEqual({
      sizeBytes: 32,
      alignBytes: 16,
      strideBytes: 32,
      minOffsetBytes: 0,
      maxOffsetBytes: 16
    });
    expect(byteLengthForLayout(WGSL_VEC3F_LAYOUT, 3)).toBe(44);
    expect(alignByteOffset(17, 16)).toBe(32);
    expect(isByteOffsetAligned(32, 16)).toBe(true);
  });
});

describe("safe DataView projection", () => {
  it("reads and writes WGSL vec3f records with padding", () => {
    const view = new DataView(new ArrayBuffer(WGSL_VEC3F_LAYOUT.strideBytes));
    const written = wgslVec3WriteDataViewF32(vec3(1, 2, 3), view, 0);

    expect(written.ok).toBe(true);
    expect(view.getFloat32(12, true)).toBe(0);
    expect(unwrap(wgslVec3ReadDataViewF32(view, 0))).toEqual(vec3(1, 2, 3));
  });

  it("rejects unaligned WGSL writes through Result.error", () => {
    const view = new DataView(new ArrayBuffer(32));
    const result = wgslVec3WriteDataViewF32(vec3(1, 2, 3), view, 4);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DATA_OFFSET_UNALIGNED");
    }
  });

  it("rejects out-of-range DataView records through Result.error", () => {
    const view = new DataView(new ArrayBuffer(32));
    const result = validateDataViewLayout(view, 0, WGSL_MAT4X4F_LAYOUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DATA_OFFSET_OUT_OF_RANGE");
    }
  });

  it("reads and writes mat4x4f records", () => {
    const view = new DataView(new ArrayBuffer(WGSL_MAT4X4F_LAYOUT.sizeBytes));
    const matrix = mat4Translation(vec3(4, 5, 6));

    expect(mat4WriteDataViewF32(matrix, view, 0).ok).toBe(true);
    expect(unwrap(mat4ReadDataViewF32(view, 0))).toEqual(matrix);
  });

  it("reads and writes WGSL-compatible AABB records", () => {
    const view = new DataView(new ArrayBuffer(WGSL_AABB3F_LAYOUT.sizeBytes));
    const bounds = aabb(vec3(-1, -2, -3), vec3(4, 5, 6));

    expect(aabbWriteWgslDataViewF32(bounds, view, 0).ok).toBe(true);
    expect(unwrap(aabbReadWgslDataViewF32(view, 0))).toEqual(bounds);
    expect(view.getFloat32(12, true)).toBe(0);
    expect(view.getFloat32(28, true)).toBe(0);
  });
});
