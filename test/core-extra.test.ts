import { describe, expect, it } from "vitest";
import {
  DUAL_QUAT_IDENTITY,
  EULER_ZERO,
  MAT3_IDENTITY,
  QUAT_IDENTITY,
  VEC4_ONE,
  add4,
  copyDualQuatInto,
  copyEulerInto,
  dot4,
  dualQuatFromTranslationRotation,
  dualQuatIdentityInto,
  dualQuatMultiply,
  euler,
  eulerFromQuat,
  mat3IdentityInto,
  mat3Multiply,
  mat3TransformPoint3,
  mutableDualQuat,
  mutableEuler,
  mutableQuat,
  mutableVec4,
  normalize4,
  ok,
  err,
  andThen,
  mapErr,
  quat,
  quatIdentityInto,
  quatInvert,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  scale4,
  vec3,
  vec4
} from "../src/core/index.js";

describe("Core extension primitives", () => {
  it("computes Vec4 arithmetic and normalization", () => {
    expect(add4(vec4(1, 2, 3, 4), vec4(4, 3, 2, 1))).toEqual(vec4(5, 5, 5, 5));
    expect(scale4(VEC4_ONE, 3)).toEqual(vec4(3, 3, 3, 3));
    expect(dot4(vec4(1, 2, 3, 4), vec4(2, 3, 4, 5))).toBe(40);
    expect(normalize4(vec4(0, 0, 0, 0))).toEqual(vec4(0, 0, 0, 0));
  });

  it("computes Mat3 identity, multiply, and vector transform", () => {
    const out = mat3IdentityInto([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    expect(out).toEqual(MAT3_IDENTITY);
    expect(mat3Multiply(MAT3_IDENTITY, MAT3_IDENTITY)).toEqual(MAT3_IDENTITY);
    expect(mat3TransformPoint3(MAT3_IDENTITY, vec3(1, 2, 3))).toEqual(vec3(1, 2, 3));
  });

  it("computes quaternion multiplication, inversion, normalization, and slerp", () => {
    const out = mutableQuat();

    expect(quatIdentityInto(out)).toEqual(QUAT_IDENTITY);
    expect(quatMultiply(QUAT_IDENTITY, quat(1, 2, 3, 4))).toEqual(quat(1, 2, 3, 4));
    expect(quatInvert(quat(1, 0, 0, 0))).toEqual(quat(-1, -0, -0, 0));
    expect(quatNormalize(quat(0, 0, 0, 0))).toEqual(QUAT_IDENTITY);
    expect(quatSlerp(QUAT_IDENTITY, QUAT_IDENTITY, 0.5)).toEqual(QUAT_IDENTITY);
  });

  it("copies and derives Euler angles", () => {
    const out = mutableEuler();

    expect(copyEulerInto(EULER_ZERO, out)).toBe(out);
    expect(out).toEqual(euler(0, 0, 0, "XYZ"));
    expect(eulerFromQuat(QUAT_IDENTITY)).toEqual(euler(0, 0, 0, "XYZ"));
  });

  it("computes dual quaternion identity, copy, multiply, and transform source", () => {
    const out = mutableDualQuat();

    expect(dualQuatIdentityInto(out)).toBe(out);
    expect(copyDualQuatInto(DUAL_QUAT_IDENTITY, out)).toBe(out);
    expect(dualQuatMultiply(DUAL_QUAT_IDENTITY, DUAL_QUAT_IDENTITY)).toEqual(DUAL_QUAT_IDENTITY);
    expect(dualQuatFromTranslationRotation(vec3(2, 4, 6), QUAT_IDENTITY).dual).toEqual(vec4(1, 2, 3, -0));
  });

  it("composes Result helpers without throwing", () => {
    const good = andThen(ok(2), (value) => ok(value * 3));
    const bad = mapErr(err({ code: "X", message: "x", stage: "test" }), (error) => ({
      ...error,
      code: "Y"
    }));

    expect(good).toEqual(ok(6));
    expect(bad).toEqual(err({ code: "Y", message: "x", stage: "test" }));
  });

  it("writes through mutable Vec4 outputs", () => {
    const out = mutableVec4();

    expect(out).toEqual(vec4(0, 0, 0, 0));
  });
});
