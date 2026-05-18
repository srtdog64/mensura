import { describe, expect, it } from "vitest";
import {
  mat4Identity,
  mat4Scaling,
  mat4Translation,
  mutableQuat,
  mutableVec3,
  nearlyEqualAbsRel,
  quat,
  vec3
} from "../src/core/index.js";
import {
  add3IntoMany,
  cross3IntoMany,
  distance3IntoMany,
  dot3IntoMany,
  length3IntoMany,
  mat4TransformAffinePoint3IntoMany,
  mat4TransformDirection3IntoMany,
  mat4TransformPoint3IntoMany,
  normalize3IntoMany,
  quatMultiplyIntoMany,
  scale3IntoMany,
  scaleAndAdd3IntoMany,
  sub3IntoMany
} from "../src/batch/index.js";

describe("batch object kernels", () => {
  it("adds, subtracts, and scales vec3 arrays into caller-owned outputs", () => {
    const a = [vec3(1, 2, 3), vec3(4, 5, 6), vec3(100, 100, 100)];
    const b = [vec3(10, 20, 30), vec3(40, 50, 60), vec3(100, 100, 100)];
    const out = [mutableVec3(), mutableVec3(), mutableVec3(-1, -1, -1)];

    expect(add3IntoMany(a, b, out, 2)).toBe(out);
    expect(out[0]).toEqual(vec3(11, 22, 33));
    expect(out[1]).toEqual(vec3(44, 55, 66));
    expect(out[2]).toEqual(vec3(-1, -1, -1));

    sub3IntoMany(b, a, out, 2);
    expect(out[0]).toEqual(vec3(9, 18, 27));
    expect(out[1]).toEqual(vec3(36, 45, 54));

    scale3IntoMany(a, 2, out, 2);
    expect(out[0]).toEqual(vec3(2, 4, 6));
    expect(out[1]).toEqual(vec3(8, 10, 12));
  });

  it("normalizes vec3 arrays and keeps zero vectors stable", () => {
    const values = [vec3(0, 3, 4), vec3(0, 0, 0)];
    const out = [mutableVec3(), mutableVec3(1, 1, 1)];

    normalize3IntoMany(values, out, 2);

    expect(out[0].x).toBe(0);
    expect(nearlyEqualAbsRel(out[0].y, 0.6)).toBe(true);
    expect(nearlyEqualAbsRel(out[0].z, 0.8)).toBe(true);
    expect(out[1]).toEqual(vec3(0, 0, 0));
  });

  it("computes scalar and cross-product vec3 batches", () => {
    const a = [vec3(1, 2, 3), vec3(4, 5, 6), vec3(100, 100, 100)];
    const b = [vec3(10, 20, 30), vec3(40, 50, 60), vec3(100, 100, 100)];
    const scalarOut = new Float64Array(3);
    const vectorOut = [mutableVec3(), mutableVec3(), mutableVec3(-1, -1, -1)];

    expect(dot3IntoMany(a, b, scalarOut, 2)).toBe(scalarOut);
    expect([...scalarOut]).toEqual([140, 770, 0]);

    length3IntoMany([vec3(0, 3, 4), vec3(1, 2, 2)], scalarOut, 2);
    expect([...scalarOut]).toEqual([5, 3, 0]);

    distance3IntoMany([vec3(0, 0, 0), vec3(1, 1, 1)], [vec3(0, 3, 4), vec3(4, 5, 1)], scalarOut, 2);
    expect([...scalarOut]).toEqual([5, 5, 0]);

    cross3IntoMany([vec3(1, 0, 0), vec3(0, 1, 0), vec3(1, 1, 1)], [vec3(0, 1, 0), vec3(0, 0, 1), vec3(1, 1, 1)], vectorOut, 2);
    expect(vectorOut[0]).toEqual(vec3(0, 0, 1));
    expect(vectorOut[1]).toEqual(vec3(1, 0, 0));
    expect(vectorOut[2]).toEqual(vec3(-1, -1, -1));

    scaleAndAdd3IntoMany(a, b, 0.5, vectorOut, 2);
    expect(vectorOut[0]).toEqual(vec3(6, 12, 18));
    expect(vectorOut[1]).toEqual(vec3(24, 30, 36));
  });

  it("transforms points and directions through a single matrix with matrix reads hoisted", () => {
    const matrix = mat4Translation(vec3(10, 20, 30));
    const points = [vec3(1, 2, 3), vec3(4, 5, 6)];
    const out = [mutableVec3(), mutableVec3()];

    expect(mat4TransformAffinePoint3IntoMany(matrix, points, out, 2)).toBe(out);
    expect(out[0]).toEqual(vec3(11, 22, 33));
    expect(out[1]).toEqual(vec3(14, 25, 36));

    const scale = mat4Scaling(vec3(2, 3, 4));
    expect(mat4TransformDirection3IntoMany(scale, [vec3(1, 1, 1), vec3(2, 3, 4)], out, 2)).toBe(out);
    expect(out[0]).toEqual(vec3(2, 3, 4));
    expect(out[1]).toEqual(vec3(4, 9, 16));
  });

  it("uses the perspective-aware mat4 batch path when w is non-trivial", () => {
    const matrix = mat4Identity();
    matrix[0] = 2;
    matrix[5] = 2;
    matrix[10] = 2;
    matrix[3] = 1;
    const out = [mutableVec3(), mutableVec3()];

    mat4TransformPoint3IntoMany(matrix, [vec3(1, 2, 3), vec3(3, 6, 9)], out, 2);

    expect(out[0]).toEqual(vec3(1, 2, 3));
    expect(out[1]).toEqual(vec3(1.5, 3, 4.5));
  });

  it("multiplies quaternion arrays", () => {
    const y90 = quat(0, Math.SQRT1_2, 0, Math.SQRT1_2);
    const identity = quat(0, 0, 0, 1);
    const out = [mutableQuat(), mutableQuat()];

    expect(quatMultiplyIntoMany([y90, identity], [identity, y90], out, 2)).toBe(out);
    expect(out[0]).toEqual(y90);
    expect(out[1]).toEqual(y90);
  });
});
