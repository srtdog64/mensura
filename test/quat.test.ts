import { describe, expect, it } from "vitest";
import {
  QUAT_SLERP_LINEAR_THRESHOLD,
  nearlyEqualAbsRel,
  quat,
  quatConjugate,
  quatFromRotationMatrix3,
  quatFromUnitVectors,
  quatIdentity,
  quatSlerp,
  unwrap,
  vec3
} from "../src/core/index.js";

describe("Quat", () => {
  it("conjugates by negating x, y, z", () => {
    const c = quatConjugate(quat(1, 2, 3, 4));

    expect(c.x).toBe(-1);
    expect(c.y).toBe(-2);
    expect(c.z).toBe(-3);
    expect(c.w).toBe(4);
  });

  it("recovers the identity quaternion from the identity rotation matrix", () => {
    const q = quatFromRotationMatrix3([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    expect(nearlyEqualAbsRel(q.w, 1)).toBe(true);
    expect(nearlyEqualAbsRel(q.x, 0)).toBe(true);
    expect(nearlyEqualAbsRel(q.y, 0)).toBe(true);
    expect(nearlyEqualAbsRel(q.z, 0)).toBe(true);
  });

  it("recovers a 180-degree Y-axis rotation from its matrix form", () => {
    const q = quatFromRotationMatrix3([-1, 0, 0, 0, 1, 0, 0, 0, -1]);

    expect(nearlyEqualAbsRel(Math.abs(q.y), 1)).toBe(true);
    expect(nearlyEqualAbsRel(q.x, 0)).toBe(true);
    expect(nearlyEqualAbsRel(q.z, 0)).toBe(true);
    expect(nearlyEqualAbsRel(q.w, 0)).toBe(true);
  });

  it("returns identity for parallel unit vectors", () => {
    const q = unwrap(quatFromUnitVectors(vec3(1, 0, 0), vec3(1, 0, 0)));

    expect(q.x).toBe(0);
    expect(q.y).toBe(0);
    expect(q.z).toBe(0);
    expect(q.w).toBe(1);
  });

  it("rotates one unit vector onto another via a 90-degree quaternion", () => {
    const q = unwrap(quatFromUnitVectors(vec3(1, 0, 0), vec3(0, 1, 0)));

    expect(nearlyEqualAbsRel(q.x, 0)).toBe(true);
    expect(nearlyEqualAbsRel(q.y, 0)).toBe(true);
    expect(nearlyEqualAbsRel(Math.abs(q.z), Math.SQRT1_2)).toBe(true);
    expect(nearlyEqualAbsRel(Math.abs(q.w), Math.SQRT1_2)).toBe(true);
  });

  it("handles anti-parallel unit vectors with a 180-degree rotation around an orthogonal axis", () => {
    const q = unwrap(quatFromUnitVectors(vec3(1, 0, 0), vec3(-1, 0, 0)));

    expect(nearlyEqualAbsRel(q.w, 0)).toBe(true);
    expect(nearlyEqualAbsRel(q.x, 0)).toBe(true);

    const axisLen = Math.sqrt(q.y * q.y + q.z * q.z);
    expect(nearlyEqualAbsRel(axisLen, 1)).toBe(true);
  });

  it("falls back to normalized lerp when quaternions are near-parallel", () => {
    const a = quatIdentity();
    const b = quat(0, 0, 0.001, Math.sqrt(1 - 0.001 * 0.001));
    const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

    expect(dot).toBeGreaterThan(QUAT_SLERP_LINEAR_THRESHOLD);

    const s = quatSlerp(a, b, 0.5);
    const len = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z + s.w * s.w);

    expect(nearlyEqualAbsRel(len, 1)).toBe(true);
  });
});
