import { describe, expect, it } from "vitest";
import {
  mat4Compose,
  mat4Identity,
  mat4TransformPoint3,
  mutableTransform3,
  mutableVec3,
  nearlyEqualAbsRel,
  quat,
  transform3,
  transform3Copy,
  transform3CopyInto,
  transform3FromMat4,
  transform3FromMat4Checked,
  transform3FromMat4Into,
  transform3Identity,
  transform3IdentityInto,
  transform3Multiply,
  transform3MultiplyInto,
  transform3ToMat4,
  transform3ToMat4Into,
  transform3TransformDirection3,
  transform3TransformDirection3Into,
  transform3TransformPoint3,
  transform3TransformPoint3Into,
  vec3
} from "../src/core/index.js";

describe("Transform3", () => {
  it("creates identity TRS records", () => {
    expect(transform3Identity()).toEqual({
      translation: vec3(0, 0, 0),
      rotation: quat(0, 0, 0, 1),
      scale: vec3(1, 1, 1)
    });

    const out = mutableTransform3(vec3(9, 8, 7), quat(1, 2, 3, 4), vec3(5, 6, 7));
    expect(transform3IdentityInto(out)).toBe(out);
    expect(out).toEqual({
      translation: vec3(0, 0, 0),
      rotation: quat(0, 0, 0, 1),
      scale: vec3(1, 1, 1)
    });
  });

  it("copies nested values without aliasing the source", () => {
    const value = transform3(vec3(1, 2, 3), quat(0, Math.SQRT1_2, 0, Math.SQRT1_2), vec3(2, 3, 4));
    const copied = transform3Copy(value);

    expect(copied).toEqual(value);
    expect(copied.translation).not.toBe(value.translation);
    expect(copied.rotation).not.toBe(value.rotation);
    expect(copied.scale).not.toBe(value.scale);

    const out = mutableTransform3();
    expect(transform3CopyInto(value, out)).toBe(out);
    expect(out).toEqual(value);
  });

  it("uses mat4Compose as the TRS matrix source of truth", () => {
    const value = transform3(vec3(1, 2, 3), quat(0, Math.SQRT1_2, 0, Math.SQRT1_2), vec3(2, 3, 4));
    const expected = mat4Compose(value.translation, value.rotation, value.scale);

    expect(transform3ToMat4(value)).toEqual(expected);

    const out = mat4Identity();
    expect(transform3ToMat4Into(value, out)).toBe(out);
    expect(out).toEqual(expected);
  });

  it("decomposes matrices into caller-owned TRS output", () => {
    const rotation = quat(0, Math.SQRT1_2, 0, Math.SQRT1_2);
    const matrix = mat4Compose(vec3(1, 2, 3), rotation, vec3(2, 3, 4));
    const decomposed = transform3FromMat4(matrix);

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

    const out = mutableTransform3();
    expect(transform3FromMat4Into(matrix, out)).toBe(out);
    expect(out.translation).toEqual(decomposed.translation);
    expect(out.scale).toEqual(decomposed.scale);
  });

  it("transforms points directly without an intermediate mat4", () => {
    const t = transform3(vec3(10, 20, 30), quat(0, Math.SQRT1_2, 0, Math.SQRT1_2), vec3(2, 3, 4));
    const point = vec3(1, 1, 1);

    const direct = transform3TransformPoint3(t, point);
    const matrix = transform3ToMat4(t);
    const viaMatrix = mat4TransformPoint3(matrix, point);

    expect(nearlyEqualAbsRel(direct.x, viaMatrix.x)).toBe(true);
    expect(nearlyEqualAbsRel(direct.y, viaMatrix.y)).toBe(true);
    expect(nearlyEqualAbsRel(direct.z, viaMatrix.z)).toBe(true);
  });

  it("supports aliasing on transform3TransformPoint3Into", () => {
    const t = transform3(vec3(1, 2, 3), quat(0, Math.SQRT1_2, 0, Math.SQRT1_2), vec3(2, 3, 4));
    const aliased = mutableVec3(1, 0, 0);
    const expected = transform3TransformPoint3(t, aliased);

    transform3TransformPoint3Into(t, aliased, aliased);
    expect(nearlyEqualAbsRel(aliased.x, expected.x)).toBe(true);
    expect(nearlyEqualAbsRel(aliased.y, expected.y)).toBe(true);
    expect(nearlyEqualAbsRel(aliased.z, expected.z)).toBe(true);
  });

  it("ignores translation for direction transforms but keeps scale and rotation", () => {
    const t = transform3(vec3(99, 99, 99), quat(0, Math.SQRT1_2, 0, Math.SQRT1_2), vec3(2, 1, 1));
    const direction = vec3(1, 0, 0);

    const transformed = transform3TransformDirection3(t, direction);
    // 90 degrees around y rotates +x to -z; scale.x = 2 doubles the magnitude before rotation.
    expect(nearlyEqualAbsRel(transformed.x, 0, { abs: 1e-12, rel: 0 })).toBe(true);
    expect(nearlyEqualAbsRel(transformed.y, 0, { abs: 1e-12, rel: 0 })).toBe(true);
    expect(nearlyEqualAbsRel(transformed.z, -2)).toBe(true);

    // Round-trip via Into.
    const out = mutableVec3();
    transform3TransformDirection3Into(t, direction, out);
    expect(out).toEqual(transformed);
  });

  it("composes two transforms equivalently to mat4 multiply + decompose", () => {
    const a = transform3(vec3(1, 0, 0), quat(0, Math.SQRT1_2, 0, Math.SQRT1_2), vec3(2, 2, 2));
    const b = transform3(vec3(0, 1, 0), quat(Math.SQRT1_2, 0, 0, Math.SQRT1_2), vec3(3, 3, 3));
    const probe = vec3(1, 2, 3);

    const composed = transform3Multiply(a, b);
    const direct = transform3TransformPoint3(composed, probe);

    // Apply b then a manually to match `M_a * M_b * p`.
    const viaSequence = transform3TransformPoint3(a, transform3TransformPoint3(b, probe));

    expect(nearlyEqualAbsRel(direct.x, viaSequence.x)).toBe(true);
    expect(nearlyEqualAbsRel(direct.y, viaSequence.y)).toBe(true);
    expect(nearlyEqualAbsRel(direct.z, viaSequence.z)).toBe(true);
  });

  it("supports caller-owned mat4 scratches in transform3MultiplyInto", () => {
    const a = transform3(vec3(2, 0, 0), quat(0, 0, 0, 1), vec3(1, 1, 1));
    const b = transform3(vec3(0, 3, 0), quat(0, 0, 0, 1), vec3(1, 1, 1));
    const scratchA = mat4Identity();
    const scratchB = mat4Identity();
    const out = mutableTransform3();

    expect(transform3MultiplyInto(a, b, scratchA, scratchB, out)).toBe(out);
    expect(nearlyEqualAbsRel(out.translation.x, 2)).toBe(true);
    expect(nearlyEqualAbsRel(out.translation.y, 3)).toBe(true);
    expect(nearlyEqualAbsRel(out.translation.z, 0)).toBe(true);
  });

  it("classifies non-finite mat4 components through transform3FromMat4Checked", () => {
    const broken: number[] = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      Number.NaN, 0, 0, 1
    ];
    const result = transform3FromMat4Checked(broken);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_MAT4_NON_FINITE");
      expect(result.error.stage).toBe("Transform");
    }
  });

  it("classifies near-zero axis scale through transform3FromMat4Checked", () => {
    // y-axis scale is zero; the decompose would divide by zero.
    const singular: number[] = [
      1, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
    const result = transform3FromMat4Checked(singular);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRANSFORM_SINGULAR");
      expect(result.error.stage).toBe("Transform");
    }
  });

  it("returns ok with the decomposed transform for a well-formed matrix", () => {
    const matrix = mat4Compose(vec3(1, 2, 3), quat(0, Math.SQRT1_2, 0, Math.SQRT1_2), vec3(2, 3, 4));
    const result = transform3FromMat4Checked(matrix);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(nearlyEqualAbsRel(result.value.translation.x, 1)).toBe(true);
      expect(nearlyEqualAbsRel(result.value.scale.x, 2)).toBe(true);
    }
  });

  it("rejects invalid transform3FromMat4Checked thresholds", () => {
    const result = transform3FromMat4Checked(mat4Identity(), { minAxisScaleSq: Number.NaN });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_INVALID_RANGE");
      expect(result.error.stage).toBe("Transform");
    }
  });
});
