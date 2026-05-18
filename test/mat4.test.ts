import { describe, expect, it } from "vitest";
import {
  MAT4_IDENTITY,
  mat4Compose,
  mat4Decompose,
  mat4Determinant,
  mat4Index,
  mat4Invert,
  mat4LookAtRh,
  mat4Multiply,
  mat4Scaling,
  mat4TransformAffinePoint3,
  mat4TransformDirection3,
  mat4TransformPoint3,
  mat4Translation,
  nearlyEqualAbsRel,
  quat,
  unwrap,
  vec3
} from "../src/core/index.js";
import { mat4PerspectiveWebGpuRh, mat4ReadFloat32, mat4WriteFloat32 } from "../src/gpu/index.js";

describe("Mat4", () => {
  it("uses column-major indexing", () => {
    expect(mat4Index(2, 3)).toBe(14);
  });

  it("multiplies transform matrices for column-vector math", () => {
    const translation = mat4Translation(vec3(10, 20, 30));
    const scaling = mat4Scaling(vec3(2, 3, 4));
    const transform = mat4Multiply(translation, scaling);

    expect(mat4TransformPoint3(transform, vec3(1, 1, 1))).toEqual(vec3(12, 23, 34));
    expect(mat4TransformAffinePoint3(transform, vec3(1, 1, 1))).toEqual(vec3(12, 23, 34));
    expect(mat4TransformDirection3(transform, vec3(1, 1, 1))).toEqual(vec3(2, 3, 4));
  });

  it("keeps identity stable under multiplication", () => {
    const translation = mat4Translation(vec3(1, 2, 3));

    expect(mat4Multiply(MAT4_IDENTITY, translation)).toEqual(translation);
    expect(mat4Multiply(translation, MAT4_IDENTITY)).toEqual(translation);
  });

  it("maps right-handed camera depth to WebGPU NDC z 0..1", () => {
    const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 10));
    const near = mat4TransformPoint3(projection, vec3(0, 0, -1));
    const far = mat4TransformPoint3(projection, vec3(0, 0, -10));

    expect(nearlyEqualAbsRel(near.z, 0)).toBe(true);
    expect(nearlyEqualAbsRel(far.z, 1)).toBe(true);
  });

  it("writes and reads packed Float32Array matrices", () => {
    const matrix = mat4Translation(vec3(1, 2, 3));
    const packed = new Float32Array(20);

    expect(mat4WriteFloat32(matrix, packed, 2)).toBe(packed);
    expect(mat4ReadFloat32(packed, 2)).toEqual(matrix);
  });

  it("computes determinants of common transforms", () => {
    expect(mat4Determinant(MAT4_IDENTITY)).toBe(1);
    expect(mat4Determinant(mat4Translation(vec3(1, 2, 3)))).toBe(1);
    expect(mat4Determinant(mat4Scaling(vec3(2, 3, 4)))).toBe(24);
  });

  it("inverts a translation matrix", () => {
    const t = mat4Translation(vec3(1, 2, 3));
    const inverted = unwrap(mat4Invert(t));

    expect(mat4TransformPoint3(inverted, vec3(11, 12, 13))).toEqual(vec3(10, 10, 10));
  });

  it("reports singular matrices through Result.error", () => {
    const singular = mat4Scaling(vec3(1, 0, 1));
    const result = mat4Invert(singular);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRANSFORM_SINGULAR");
      expect(result.error.stage).toBe("Transform");
    }
  });

  it("builds a right-handed view matrix", () => {
    const view = unwrap(mat4LookAtRh(vec3(0, 0, 5), vec3(0, 0, 0), vec3(0, 1, 0)));
    const origin = mat4TransformPoint3(view, vec3(0, 0, 0));

    expect(nearlyEqualAbsRel(origin.x, 0)).toBe(true);
    expect(nearlyEqualAbsRel(origin.y, 0)).toBe(true);
    expect(nearlyEqualAbsRel(origin.z, -5)).toBe(true);
  });

  it("rejects degenerate lookAt inputs through Result.error", () => {
    const sameEyeAndCenter = mat4LookAtRh(vec3(0, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0));
    expect(sameEyeAndCenter.ok).toBe(false);
    if (!sameEyeAndCenter.ok) {
      expect(sameEyeAndCenter.error.code).toBe("TRANSFORM_DEGENERATE_BASIS");
    }

    const upParallelToView = mat4LookAtRh(vec3(0, 1, 0), vec3(0, 0, 0), vec3(0, 1, 0));
    expect(upParallelToView.ok).toBe(false);
  });

  it("composes and decomposes a T*R*S transform", () => {
    const rotation = quat(0, Math.SQRT1_2, 0, Math.SQRT1_2);
    const translation = vec3(1, 2, 3);
    const scale = vec3(2, 3, 4);
    const composed = mat4Compose(translation, rotation, scale);
    const decomposed = mat4Decompose(composed);

    expect(nearlyEqualAbsRel(decomposed.translation.x, 1)).toBe(true);
    expect(nearlyEqualAbsRel(decomposed.translation.y, 2)).toBe(true);
    expect(nearlyEqualAbsRel(decomposed.translation.z, 3)).toBe(true);
    expect(nearlyEqualAbsRel(decomposed.scale.x, 2)).toBe(true);
    expect(nearlyEqualAbsRel(decomposed.scale.y, 3)).toBe(true);
    expect(nearlyEqualAbsRel(decomposed.scale.z, 4)).toBe(true);

    const dot =
      rotation.x * decomposed.rotation.x +
      rotation.y * decomposed.rotation.y +
      rotation.z * decomposed.rotation.z +
      rotation.w * decomposed.rotation.w;
    expect(nearlyEqualAbsRel(Math.abs(dot), 1)).toBe(true);
  });

  it("flips scale.x in decompose when the matrix has negative determinant", () => {
    const mirrored = mat4Scaling(vec3(-1, 1, 1));
    const decomposed = mat4Decompose(mirrored);

    expect(nearlyEqualAbsRel(decomposed.scale.x, -1)).toBe(true);
    expect(nearlyEqualAbsRel(decomposed.scale.y, 1)).toBe(true);
    expect(nearlyEqualAbsRel(decomposed.scale.z, 1)).toBe(true);
  });
});
