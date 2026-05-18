import { describe, expect, it } from "vitest";
import {
  mat4Identity,
  mat4MultiplyInto,
  mat4TransformAffinePoint3Into,
  mutableVec3,
  normalize3,
  vec3,
  type Mat4Like,
  type MutableMat4,
  type MutableVec3,
  type Vec3
} from "../src/core/index.js";
import {
  add3IntoMany,
  cross3IntoMany,
  dot3IntoMany,
  mat4TransformAffinePoint3IntoMany,
  normalize3IntoMany,
  scaleAndAdd3IntoMany,
  vec3ArrayWriteFloat32
} from "../src/batch/index.js";
import {
  unsafeMat4MultiplyF32Many,
  unsafeMat4TransformAffinePoint3F32Many,
  unsafeVec3AddF32Many,
  unsafeVec3CrossF32Many,
  unsafeVec3DotF32Many,
  unsafeVec3NormalizeF32Many,
  unsafeVec3ScaleAndAddF32Many
} from "../src/unsafe/index.js";
import { aabb, ray } from "../src/geometry/index.js";
import { rayIntersectsAabb } from "../src/query/index.js";
import { AccelContext, buildBvh, bvhRaycast } from "../src/accel/index.js";
import { unwrap } from "../src/core/result.js";

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function range(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function maxVec3PackedError(values: ArrayLike<Vec3>, packed: Float32Array, count: number): number {
  let maxError = 0;
  for (let i = 0; i < count; i++) {
    const offset = i * 3;
    const value = values[i];
    maxError = Math.max(maxError, Math.abs(value.x - packed[offset + 0]));
    maxError = Math.max(maxError, Math.abs(value.y - packed[offset + 1]));
    maxError = Math.max(maxError, Math.abs(value.z - packed[offset + 2]));
  }
  return maxError;
}

function maxNumberPackedError(values: ArrayLike<number>, packed: Float32Array, count: number): number {
  let maxError = 0;
  for (let i = 0; i < count; i++) {
    maxError = Math.max(maxError, Math.abs(values[i] - packed[i]));
  }
  return maxError;
}

function writeMat4Array(values: ArrayLike<Mat4Like>, out: Float32Array, count: number): Float32Array {
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const value = values[i];
    for (let j = 0; j < 16; j++) {
      out[offset + j] = value[j];
    }
    offset += 16;
  }
  return out;
}

function sortedNumbers(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

describe("deterministic stress coverage", () => {
  it("keeps object batch and unsafe packed vec3 kernels aligned over large inputs", () => {
    const count = 4096;
    const rng = makeRng(0x4d454e53);
    const a: MutableVec3[] = [];
    const b: MutableVec3[] = [];
    const batchOut = Array.from({ length: count }, () => mutableVec3());
    const batchVecOut = Array.from({ length: count }, () => mutableVec3());
    const scalarOut = new Float64Array(count);

    for (let i = 0; i < count; i++) {
      a.push(mutableVec3(Math.fround(range(rng, -100, 100)), Math.fround(range(rng, -50, 50)), Math.fround(range(rng, -25, 25))));
      b.push(mutableVec3(Math.fround(range(rng, -10, 10)), Math.fround(range(rng, -20, 20)), Math.fround(range(rng, -30, 30))));
    }

    const packedA = vec3ArrayWriteFloat32(a, new Float32Array(count * 3), count);
    const packedB = vec3ArrayWriteFloat32(b, new Float32Array(count * 3), count);
    const packedOut = new Float32Array(count * 3);
    const packedScalarOut = new Float32Array(count);

    add3IntoMany(a, b, batchOut, count);
    unsafeVec3AddF32Many(packedA, packedB, packedOut, count);
    expect(maxVec3PackedError(batchOut, packedOut, count)).toBeLessThanOrEqual(0.00002);

    cross3IntoMany(a, b, batchOut, count);
    unsafeVec3CrossF32Many(packedA, packedB, packedOut, count);
    expect(maxVec3PackedError(batchOut, packedOut, count)).toBeLessThanOrEqual(0.001);

    scaleAndAdd3IntoMany(a, b, 0.25, batchOut, count);
    unsafeVec3ScaleAndAddF32Many(packedA, packedB, 0.25, packedOut, count);
    expect(maxVec3PackedError(batchOut, packedOut, count)).toBeLessThanOrEqual(0.00002);

    dot3IntoMany(a, b, scalarOut, count);
    unsafeVec3DotF32Many(packedA, packedB, packedScalarOut, count);
    expect(maxNumberPackedError(scalarOut, packedScalarOut, count)).toBeLessThanOrEqual(0.001);

    normalize3IntoMany(a, batchVecOut, count);
    unsafeVec3NormalizeF32Many(packedA, packedOut, count);
    expect(maxVec3PackedError(batchVecOut, packedOut, count)).toBeLessThanOrEqual(0.000002);
  });

  it("keeps matrix batch, unsafe matrix kernels, and scalar transforms aligned", () => {
    const count = 2048;
    const rng = makeRng(0x5446534d);
    const points: MutableVec3[] = [];
    const batchOut = Array.from({ length: count }, () => mutableVec3());
    const scalarOut = Array.from({ length: count }, () => mutableVec3());
    const matrix = new Float32Array([
      1.25, 0.125, -0.25, 0,
      -0.375, 0.75, 0.5, 0,
      0.625, -0.125, 1.5, 0,
      12, -8, 4, 1
    ]);

    for (let i = 0; i < count; i++) {
      points.push(mutableVec3(Math.fround(range(rng, -200, 200)), Math.fround(range(rng, -200, 200)), Math.fround(range(rng, -200, 200))));
    }

    const packedPoints = vec3ArrayWriteFloat32(points, new Float32Array(count * 3), count);
    const packedOut = new Float32Array(count * 3);

    mat4TransformAffinePoint3IntoMany(matrix, points, batchOut, count);
    unsafeMat4TransformAffinePoint3F32Many(matrix, 0, packedPoints, packedOut, count);
    for (let i = 0; i < count; i++) {
      mat4TransformAffinePoint3Into(matrix, points[i], scalarOut[i]);
    }

    expect(maxVec3PackedError(batchOut, packedOut, count)).toBeLessThanOrEqual(0.00005);
    expect(maxVec3PackedError(scalarOut, packedOut, count)).toBeLessThanOrEqual(0.00005);
  });

  it("matches unsafe packed mat4 multiplication against scalar mat4MultiplyInto", () => {
    const count = 256;
    const rng = makeRng(0x4d415434);
    const a: MutableMat4[] = [];
    const b: MutableMat4[] = [];
    const expected: MutableMat4[] = [];

    for (let i = 0; i < count; i++) {
      const ma = mat4Identity();
      const mb = mat4Identity();
      ma[0] = Math.fround(range(rng, 0.5, 3));
      ma[5] = Math.fround(range(rng, 0.5, 3));
      ma[10] = Math.fround(range(rng, 0.5, 3));
      ma[12] = Math.fround(range(rng, -20, 20));
      ma[13] = Math.fround(range(rng, -20, 20));
      ma[14] = Math.fround(range(rng, -20, 20));
      mb[0] = Math.fround(range(rng, 0.5, 3));
      mb[5] = Math.fround(range(rng, 0.5, 3));
      mb[10] = Math.fround(range(rng, 0.5, 3));
      mb[12] = Math.fround(range(rng, -20, 20));
      mb[13] = Math.fround(range(rng, -20, 20));
      mb[14] = Math.fround(range(rng, -20, 20));
      a.push(ma);
      b.push(mb);
      expected.push(mat4MultiplyInto(ma, mb, mat4Identity()));
    }

    const packedA = writeMat4Array(a, new Float32Array(count * 16), count);
    const packedB = writeMat4Array(b, new Float32Array(count * 16), count);
    const packedOut = new Float32Array(count * 16);

    unsafeMat4MultiplyF32Many(packedA, packedB, packedOut, count);

    let maxError = 0;
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 16; j++) {
        maxError = Math.max(maxError, Math.abs(expected[i][j] - packedOut[i * 16 + j]));
      }
    }
    expect(maxError).toBeLessThanOrEqual(0.00001);
  });

  it("matches BVH raycast candidates against brute-force AABB ray tests", () => {
    const boxes = [];
    for (let z = 0; z < 8; z++) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const cx = (x - 3.5) * 3;
          const cy = (y - 3.5) * 3;
          const cz = -4 - z * 3;
          boxes.push(aabb(vec3(cx - 0.75, cy - 0.75, cz - 0.75), vec3(cx + 0.75, cy + 0.75, cz + 0.75)));
        }
      }
    }

    const bvh = unwrap(buildBvh(boxes, 1));
    const ctx = new AccelContext();
    const rng = makeRng(0x42564831);

    for (let i = 0; i < 96; i++) {
      const origin = vec3(range(rng, -16, 16), range(rng, -16, 16), 8 + range(rng, 0, 6));
      const target = vec3(range(rng, -9, 9), range(rng, -9, 9), range(rng, -26, -4));
      const direction = normalize3(vec3(target.x - origin.x, target.y - origin.y, target.z - origin.z));
      const r = ray(origin, direction);
      const brute = [];

      for (let boxIndex = 0; boxIndex < boxes.length; boxIndex++) {
        if (rayIntersectsAabb(r, boxes[boxIndex])) {
          brute.push(boxIndex);
        }
      }

      expect(sortedNumbers(bvhRaycast(bvh, r, ctx))).toEqual(sortedNumbers(brute));
      expect(ctx.bvhStack).toHaveLength(0);
    }
  });
});
