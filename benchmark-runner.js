import { performance } from "node:perf_hooks";
import { mat4 as glMat4, vec3 as glVec3 } from "gl-matrix";
import { mat4 as wgpuMat4, vec3 as wgpuVec3 } from "wgpu-matrix";
import {
  add3,
  add3Into,
  mat4Identity,
  mat4Multiply,
  mat4MultiplyInto,
  mat4TransformAffinePoint3Into,
  mat4TransformPoint3,
  mat4TransformPoint3Into,
  mutableVec3,
  normalize3,
  normalize3Into,
  vec3
} from "./dist/core/index.js";
import { aabb, ray, rayAabbHitDistance } from "./dist/geometry/index.js";
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
  scaleAndAdd3IntoMany
} from "./dist/batch/index.js";
import { mat4WriteFloat32, vec3WriteFloat32 } from "./dist/gpu/index.js";
import {
  unsafeMat4WriteDataViewF32,
  unsafeMat4WriteFloat32,
  unsafeVec3WriteDataViewF32,
  unsafeVec3WriteFloat32
} from "./dist/unsafe/index.js";
import {
  unsafeMat4MultiplyF32Many,
  unsafeMat4TransformAffinePoint3F32Many,
  unsafeMat4TransformDirection3F32Many,
  unsafeMat4TransformPoint3F32Many,
  unsafeQuatMultiplyF32Many,
  unsafeVec3AddF32Many,
  unsafeVec3AddF32ManyStride16,
  unsafeVec3CrossF32Many,
  unsafeVec3DistanceF32Many,
  unsafeVec3DotF32Many,
  unsafeVec3LengthF32Many,
  unsafeVec3NormalizeF32Many,
  unsafeVec3ScaleAndAddF32Many
} from "./dist/unsafe/f32-kernel.js";

// Seven post-warmup samples keep the median stable enough for local V8
// tiering noise without making `check:release` painfully slow. Two warmups
// give TurboFan a chance to tier up the tiny kernels before sampling.
const SAMPLES = 7;
const WARMUP = 2;
// Gate ratios are themselves noisy, so release checks use the median ratio of
// three full benchmark rounds. This catches real regressions while tolerating
// short OS scheduling spikes.
const CHECK_ROUNDS = 3;
// Iteration counts are intentionally asymmetric: vec3 kernels are tiny and
// need more calls to rise above timer noise; mat4 kernels do more arithmetic
// per call and can use fewer iterations.
const VEC_ITERATIONS = 1_000_000;
const MAT_ITERATIONS = 250_000;
const GEOMETRY_ITERATIONS = 500_000;
const WRITE_ITERATIONS = 500_000;

let sink = 0;

// 256 vec entries and 128 matrices are power-of-two pools. The benchmark uses
// `index & 255` / `index & 127` so the index wrap does not add `%` division
// overhead to the inner loop being measured.
const vecA = Array.from({ length: 256 }, (_, index) =>
  vec3(index * 0.125 + 1, index * 0.25 + 2, index * 0.375 + 3)
);
const vecB = Array.from({ length: 256 }, (_, index) =>
  vec3(index * 0.175 + 4, index * 0.275 + 5, index * 0.475 + 6)
);
const glVecA = vecA.map((value) => glVec3.fromValues(value.x, value.y, value.z));
const glVecB = vecB.map((value) => glVec3.fromValues(value.x, value.y, value.z));
const wgpuVecA = vecA.map((value) => wgpuVec3.fromValues(value.x, value.y, value.z));
const wgpuVecB = vecB.map((value) => wgpuVec3.fromValues(value.x, value.y, value.z));
const matrices = Array.from({ length: 128 }, (_, index) => {
  const matrix = mat4Identity();
  matrix[0] = 1 + index * 0.001;
  matrix[5] = 1 + index * 0.002;
  matrix[10] = 1 + index * 0.003;
  matrix[12] = index * 0.1;
  matrix[13] = index * 0.2;
  matrix[14] = index * 0.3;
  return matrix;
});
const glMatrices = matrices.map((matrix) => glMat4.fromValues(
  matrix[0], matrix[1], matrix[2], matrix[3],
  matrix[4], matrix[5], matrix[6], matrix[7],
  matrix[8], matrix[9], matrix[10], matrix[11],
  matrix[12], matrix[13], matrix[14], matrix[15]
));
const wgpuMatrices = matrices.map((matrix) => wgpuMat4.create(
  matrix[0], matrix[1], matrix[2], matrix[3],
  matrix[4], matrix[5], matrix[6], matrix[7],
  matrix[8], matrix[9], matrix[10], matrix[11],
  matrix[12], matrix[13], matrix[14], matrix[15]
));
const rays = Array.from({ length: 128 }, (_, index) =>
  ray(vec3(index * 0.01, 0, 5), vec3(0, 0, -1))
);
const boxes = Array.from({ length: 128 }, (_, index) =>
  aabb(vec3(index * 0.01 - 1, -1, -1), vec3(index * 0.01 + 1, 1, 1))
);
const packed = new Float32Array(64);
// 256 bytes is enough for the write-offset probes below while staying small
// enough to remain hot in cache. It is not a layout recommendation.
const dataView = new DataView(new ArrayBuffer(256));

// Batch size 256 amortizes one JS function call over enough elements to expose
// the intended `*Many` advantage, but remains small enough to resemble editor
// and game-frame chunks rather than a synthetic million-element stream.
const BATCH_SIZE = 256;
const BATCH_REPEATS = Math.floor(VEC_ITERATIONS / BATCH_SIZE);
const MAT_BATCH_REPEATS = Math.floor(MAT_ITERATIONS / BATCH_SIZE);

const packedVecA = new Float32Array(BATCH_SIZE * 3);
const packedVecB = new Float32Array(BATCH_SIZE * 3);
const packedVecOut = new Float32Array(BATCH_SIZE * 3);
for (let index = 0; index < BATCH_SIZE; index += 1) {
  packedVecA[index * 3 + 0] = vecA[index].x;
  packedVecA[index * 3 + 1] = vecA[index].y;
  packedVecA[index * 3 + 2] = vecA[index].z;
  packedVecB[index * 3 + 0] = vecB[index].x;
  packedVecB[index * 3 + 1] = vecB[index].y;
  packedVecB[index * 3 + 2] = vecB[index].z;
}
const packedMatrix = new Float32Array(16);
for (let i = 0; i < 16; i += 1) {
  packedMatrix[i] = matrices[0][i];
}
const batchVecOut = Array.from({ length: BATCH_SIZE }, () => mutableVec3());
const batchDotOut = new Float64Array(BATCH_SIZE);
const packedDotOut = new Float32Array(BATCH_SIZE);
const glOutPool = Array.from({ length: BATCH_SIZE }, () => glVec3.create());

const quatA = Array.from({ length: BATCH_SIZE }, (_, index) => ({
  x: Math.sin(index * 0.1) * 0.3,
  y: Math.cos(index * 0.1) * 0.3,
  z: Math.sin(index * 0.07) * 0.3,
  w: Math.cos(index * 0.07) * 0.9
}));
const quatB = Array.from({ length: BATCH_SIZE }, (_, index) => ({
  x: Math.sin(index * 0.13) * 0.2,
  y: Math.cos(index * 0.13) * 0.2,
  z: Math.sin(index * 0.09) * 0.2,
  w: Math.cos(index * 0.09) * 0.95
}));
const quatOut = Array.from({ length: BATCH_SIZE }, () => ({ x: 0, y: 0, z: 0, w: 1 }));
const packedQuatA = new Float32Array(BATCH_SIZE * 4);
const packedQuatB = new Float32Array(BATCH_SIZE * 4);
const packedQuatOut = new Float32Array(BATCH_SIZE * 4);
for (let index = 0; index < BATCH_SIZE; index += 1) {
  packedQuatA[index * 4 + 0] = quatA[index].x;
  packedQuatA[index * 4 + 1] = quatA[index].y;
  packedQuatA[index * 4 + 2] = quatA[index].z;
  packedQuatA[index * 4 + 3] = quatA[index].w;
  packedQuatB[index * 4 + 0] = quatB[index].x;
  packedQuatB[index * 4 + 1] = quatB[index].y;
  packedQuatB[index * 4 + 2] = quatB[index].z;
  packedQuatB[index * 4 + 3] = quatB[index].w;
}

const packedVecAStride16 = new Float32Array(BATCH_SIZE * 4);
const packedVecBStride16 = new Float32Array(BATCH_SIZE * 4);
const packedVecOutStride16 = new Float32Array(BATCH_SIZE * 4);
for (let index = 0; index < BATCH_SIZE; index += 1) {
  packedVecAStride16[index * 4 + 0] = vecA[index].x;
  packedVecAStride16[index * 4 + 1] = vecA[index].y;
  packedVecAStride16[index * 4 + 2] = vecA[index].z;
  packedVecBStride16[index * 4 + 0] = vecB[index].x;
  packedVecBStride16[index * 4 + 1] = vecB[index].y;
  packedVecBStride16[index * 4 + 2] = vecB[index].z;
}

// Matrix batches are 128 because each element is 16 floats; doubling this makes
// the packed arrays larger without improving signal on current Node/V8.
const MAT_BATCH_SIZE = 128;
const MAT_PAIR_REPEATS = Math.floor(MAT_ITERATIONS / MAT_BATCH_SIZE);
const packedMatA = new Float32Array(MAT_BATCH_SIZE * 16);
const packedMatB = new Float32Array(MAT_BATCH_SIZE * 16);
const packedMatOut = new Float32Array(MAT_BATCH_SIZE * 16);
for (let index = 0; index < MAT_BATCH_SIZE; index += 1) {
  const source = matrices[index & 127];
  for (let k = 0; k < 16; k += 1) {
    packedMatA[index * 16 + k] = source[k];
    packedMatB[index * 16 + k] = matrices[(index + 1) & 127][k];
  }
}
const glMatPool = Array.from({ length: MAT_BATCH_SIZE }, () => glMat4.create());

const cases = [
  {
    group: "vec3 add",
    name: "naive object baseline",
    iterations: VEC_ITERATIONS,
    run: () => {
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        const a = vecA[index & 255];
        const b = vecB[index & 255];
        const value = { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
        sink += value.x;
      }
    }
  },
  {
    group: "vec3 add",
    name: "Mensura add3",
    iterations: VEC_ITERATIONS,
    run: () => {
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        const value = add3(vecA[index & 255], vecB[index & 255]);
        sink += value.x;
      }
    }
  },
  {
    group: "vec3 add",
    name: "Mensura add3Into",
    iterations: VEC_ITERATIONS,
    run: () => {
      const out = mutableVec3();
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        add3Into(vecA[index & 255], vecB[index & 255], out);
        sink += out.x;
      }
    }
  },
  {
    group: "vec3 add",
    name: "gl-matrix vec3.add",
    iterations: VEC_ITERATIONS,
    run: () => {
      const out = glVec3.create();
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        glVec3.add(out, glVecA[index & 255], glVecB[index & 255]);
        sink += out[0];
      }
    }
  },
  {
    group: "vec3 add",
    name: "wgpu-matrix vec3.add",
    iterations: VEC_ITERATIONS,
    run: () => {
      const out = wgpuVec3.create();
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        wgpuVec3.add(wgpuVecA[index & 255], wgpuVecB[index & 255], out);
        sink += out[0];
      }
    }
  },
  {
    group: "vec3 normalize",
    name: "naive object baseline",
    iterations: VEC_ITERATIONS,
    run: () => {
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        const v = vecA[index & 255];
        const lenSq = v.x * v.x + v.y * v.y + v.z * v.z;
        const invLen = lenSq > 0 ? 1 / Math.sqrt(lenSq) : 0;
        const value = { x: v.x * invLen, y: v.y * invLen, z: v.z * invLen };
        sink += value.y;
      }
    }
  },
  {
    group: "vec3 normalize",
    name: "Mensura normalize3",
    iterations: VEC_ITERATIONS,
    run: () => {
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        const value = normalize3(vecA[index & 255]);
        sink += value.y;
      }
    }
  },
  {
    group: "vec3 normalize",
    name: "Mensura normalize3Into",
    iterations: VEC_ITERATIONS,
    run: () => {
      const out = mutableVec3();
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        normalize3Into(vecA[index & 255], out);
        sink += out.y;
      }
    }
  },
  {
    group: "vec3 normalize",
    name: "gl-matrix vec3.normalize",
    iterations: VEC_ITERATIONS,
    run: () => {
      const out = glVec3.create();
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        glVec3.normalize(out, glVecA[index & 255]);
        sink += out[1];
      }
    }
  },
  {
    group: "vec3 normalize",
    name: "wgpu-matrix vec3.normalize",
    iterations: VEC_ITERATIONS,
    run: () => {
      const out = wgpuVec3.create();
      for (let index = 0; index < VEC_ITERATIONS; index += 1) {
        wgpuVec3.normalize(wgpuVecA[index & 255], out);
        sink += out[1];
      }
    }
  },
  {
    group: "mat4 multiply",
    name: "Mensura mat4Multiply",
    iterations: MAT_ITERATIONS,
    run: () => {
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        const value = mat4Multiply(matrices[index & 127], matrices[(index + 1) & 127]);
        sink += value[12];
      }
    }
  },
  {
    group: "mat4 multiply",
    name: "Mensura mat4MultiplyInto",
    iterations: MAT_ITERATIONS,
    run: () => {
      const out = mat4Identity();
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        mat4MultiplyInto(matrices[index & 127], matrices[(index + 1) & 127], out);
        sink += out[12];
      }
    }
  },
  {
    group: "mat4 multiply",
    name: "gl-matrix mat4.multiply",
    iterations: MAT_ITERATIONS,
    run: () => {
      const out = glMat4.create();
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        glMat4.multiply(out, glMatrices[index & 127], glMatrices[(index + 1) & 127]);
        sink += out[12];
      }
    }
  },
  {
    group: "mat4 multiply",
    name: "wgpu-matrix mat4.multiply",
    iterations: MAT_ITERATIONS,
    run: () => {
      const out = wgpuMat4.create();
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        wgpuMat4.multiply(wgpuMatrices[index & 127], wgpuMatrices[(index + 1) & 127], out);
        sink += out[12];
      }
    }
  },
  {
    group: "mat4 transform",
    name: "Mensura mat4TransformPoint3",
    iterations: MAT_ITERATIONS,
    run: () => {
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        const value = mat4TransformPoint3(matrices[index & 127], vecA[index & 255]);
        sink += value.z;
      }
    }
  },
  {
    group: "mat4 transform",
    name: "Mensura mat4TransformPoint3Into",
    iterations: MAT_ITERATIONS,
    run: () => {
      const out = mutableVec3();
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        mat4TransformPoint3Into(matrices[index & 127], vecA[index & 255], out);
        sink += out.z;
      }
    }
  },
  {
    group: "mat4 transform",
    name: "Mensura affinePoint3Into",
    iterations: MAT_ITERATIONS,
    run: () => {
      const out = mutableVec3();
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        mat4TransformAffinePoint3Into(matrices[index & 127], vecA[index & 255], out);
        sink += out.z;
      }
    }
  },
  {
    group: "mat4 transform",
    name: "gl-matrix vec3.transformMat4",
    iterations: MAT_ITERATIONS,
    run: () => {
      const out = glVec3.create();
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        glVec3.transformMat4(out, glVecA[index & 255], glMatrices[index & 127]);
        sink += out[2];
      }
    }
  },
  {
    group: "mat4 transform",
    name: "wgpu-matrix vec3.transformMat4",
    iterations: MAT_ITERATIONS,
    run: () => {
      const out = wgpuVec3.create();
      for (let index = 0; index < MAT_ITERATIONS; index += 1) {
        wgpuVec3.transformMat4(wgpuVecA[index & 255], wgpuMatrices[index & 127], out);
        sink += out[2];
      }
    }
  },
  {
    group: "ray/aabb",
    name: "Mensura rayAabbHitDistance",
    iterations: GEOMETRY_ITERATIONS,
    run: () => {
      for (let index = 0; index < GEOMETRY_ITERATIONS; index += 1) {
        sink += rayAabbHitDistance(rays[index & 127], boxes[index & 127]) ?? 0;
      }
    }
  },
  {
    group: "f32 write",
    name: "gpu vec3WriteFloat32",
    iterations: WRITE_ITERATIONS,
    run: () => {
      for (let index = 0; index < WRITE_ITERATIONS; index += 1) {
        vec3WriteFloat32(vecA[index & 255], packed, 4);
        sink += packed[4];
      }
    }
  },
  {
    group: "f32 write",
    name: "unsafeVec3WriteFloat32",
    iterations: WRITE_ITERATIONS,
    run: () => {
      for (let index = 0; index < WRITE_ITERATIONS; index += 1) {
        unsafeVec3WriteFloat32(vecA[index & 255], packed, 4);
        sink += packed[4];
      }
    }
  },
  {
    group: "f32 write",
    name: "unsafeVec3WriteDataViewF32",
    iterations: WRITE_ITERATIONS,
    run: () => {
      for (let index = 0; index < WRITE_ITERATIONS; index += 1) {
        unsafeVec3WriteDataViewF32(vecA[index & 255], dataView, 16);
        sink += dataView.getFloat32(16, true);
      }
    }
  },
  {
    group: "f32 write",
    name: "gpu mat4WriteFloat32",
    iterations: WRITE_ITERATIONS,
    run: () => {
      for (let index = 0; index < WRITE_ITERATIONS; index += 1) {
        mat4WriteFloat32(matrices[index & 127], packed, 16);
        sink += packed[16];
      }
    }
  },
  {
    group: "f32 write",
    name: "unsafeMat4WriteFloat32",
    iterations: WRITE_ITERATIONS,
    run: () => {
      for (let index = 0; index < WRITE_ITERATIONS; index += 1) {
        unsafeMat4WriteFloat32(matrices[index & 127], packed, 16);
        sink += packed[16];
      }
    }
  },
  {
    group: "f32 write",
    name: "unsafeMat4WriteDataViewF32",
    iterations: WRITE_ITERATIONS,
    run: () => {
      for (let index = 0; index < WRITE_ITERATIONS; index += 1) {
        unsafeMat4WriteDataViewF32(matrices[index & 127], dataView, 64);
        sink += dataView.getFloat32(64, true);
      }
    }
  },
  {
    group: "vec3 add batch",
    name: "scalar object loop (add3Into)",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          add3Into(vecA[i], vecB[i], batchVecOut[i]);
        }
      }
      sink += batchVecOut[0].x;
    }
  },
  {
    group: "vec3 add batch",
    name: "Mensura add3IntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        add3IntoMany(vecA, vecB, batchVecOut, BATCH_SIZE);
      }
      sink += batchVecOut[0].x;
    }
  },
  {
    group: "vec3 add batch",
    name: "unsafe vec3 F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3AddF32Many(packedVecA, packedVecB, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[0];
    }
  },
  {
    group: "vec3 add batch",
    name: "gl-matrix loop",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          glVec3.add(glOutPool[i], glVecA[i], glVecB[i]);
        }
      }
      sink += glOutPool[0][0];
    }
  },
  {
    group: "vec3 normalize batch",
    name: "scalar object loop (normalize3Into)",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          normalize3Into(vecA[i], batchVecOut[i]);
        }
      }
      sink += batchVecOut[0].y;
    }
  },
  {
    group: "vec3 normalize batch",
    name: "Mensura normalize3IntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        normalize3IntoMany(vecA, batchVecOut, BATCH_SIZE);
      }
      sink += batchVecOut[0].y;
    }
  },
  {
    group: "vec3 normalize batch",
    name: "unsafe vec3 F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3NormalizeF32Many(packedVecA, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[1];
    }
  },
  {
    group: "vec3 normalize batch",
    name: "gl-matrix loop",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          glVec3.normalize(glOutPool[i], glVecA[i]);
        }
      }
      sink += glOutPool[0][1];
    }
  },
  {
    group: "mat4 affine transform batch",
    name: "scalar object loop (affinePoint3Into)",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          mat4TransformAffinePoint3Into(matrices[0], vecA[i], batchVecOut[i]);
        }
      }
      sink += batchVecOut[0].z;
    }
  },
  {
    group: "mat4 affine transform batch",
    name: "Mensura affinePoint3IntoMany",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        mat4TransformAffinePoint3IntoMany(matrices[0], vecA, batchVecOut, BATCH_SIZE);
      }
      sink += batchVecOut[0].z;
    }
  },
  {
    group: "mat4 affine transform batch",
    name: "unsafe mat4 affine F32 Many",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        unsafeMat4TransformAffinePoint3F32Many(packedMatrix, 0, packedVecA, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[2];
    }
  },
  {
    group: "mat4 affine transform batch",
    name: "gl-matrix loop",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          glVec3.transformMat4(glOutPool[i], glVecA[i], glMatrices[0]);
        }
      }
      sink += glOutPool[0][2];
    }
  },
  {
    group: "vec3 add batch (WGSL stride 16)",
    name: "unsafe vec3 F32 Many (stride 12)",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3AddF32Many(packedVecA, packedVecB, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[0];
    }
  },
  {
    group: "vec3 add batch (WGSL stride 16)",
    name: "unsafe vec3 F32 Many (stride 16, WGSL)",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3AddF32ManyStride16(
          packedVecAStride16,
          packedVecBStride16,
          packedVecOutStride16,
          BATCH_SIZE
        );
      }
      sink += packedVecOutStride16[0];
    }
  },
  {
    group: "mat4 multiply batch",
    name: "scalar object loop (mat4MultiplyInto)",
    iterations: MAT_BATCH_SIZE * MAT_PAIR_REPEATS,
    run: () => {
      const out = mat4Identity();
      for (let r = 0; r < MAT_PAIR_REPEATS; r += 1) {
        for (let i = 0; i < MAT_BATCH_SIZE; i += 1) {
          mat4MultiplyInto(matrices[i & 127], matrices[(i + 1) & 127], out);
        }
      }
      sink += out[12];
    }
  },
  {
    group: "mat4 multiply batch",
    name: "unsafe mat4 F32 Many",
    iterations: MAT_BATCH_SIZE * MAT_PAIR_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_PAIR_REPEATS; r += 1) {
        unsafeMat4MultiplyF32Many(packedMatA, packedMatB, packedMatOut, MAT_BATCH_SIZE);
      }
      sink += packedMatOut[12];
    }
  },
  {
    group: "mat4 multiply batch",
    name: "gl-matrix loop",
    iterations: MAT_BATCH_SIZE * MAT_PAIR_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_PAIR_REPEATS; r += 1) {
        for (let i = 0; i < MAT_BATCH_SIZE; i += 1) {
          glMat4.multiply(glMatPool[i], glMatrices[i & 127], glMatrices[(i + 1) & 127]);
        }
      }
      sink += glMatPool[0][12];
    }
  },
  {
    group: "vec3 dot batch",
    name: "Mensura dot3IntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        dot3IntoMany(vecA, vecB, batchDotOut, BATCH_SIZE);
      }
      sink += batchDotOut[0];
    }
  },
  {
    group: "vec3 dot batch",
    name: "unsafe vec3 dot F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3DotF32Many(packedVecA, packedVecB, packedDotOut, BATCH_SIZE);
      }
      sink += packedDotOut[0];
    }
  },
  {
    group: "vec3 dot batch",
    name: "gl-matrix loop",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          batchDotOut[i] = glVec3.dot(glVecA[i], glVecB[i]);
        }
      }
      sink += batchDotOut[0];
    }
  },
  {
    group: "vec3 cross batch",
    name: "Mensura cross3IntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        cross3IntoMany(vecA, vecB, batchVecOut, BATCH_SIZE);
      }
      sink += batchVecOut[0].x;
    }
  },
  {
    group: "vec3 cross batch",
    name: "unsafe vec3 cross F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3CrossF32Many(packedVecA, packedVecB, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[0];
    }
  },
  {
    group: "vec3 cross batch",
    name: "gl-matrix loop",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          glVec3.cross(glOutPool[i], glVecA[i], glVecB[i]);
        }
      }
      sink += glOutPool[0][0];
    }
  },
  {
    group: "mat4 transform batch (perspective)",
    name: "Mensura transformPoint3IntoMany",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        mat4TransformPoint3IntoMany(matrices[0], vecA, batchVecOut, BATCH_SIZE);
      }
      sink += batchVecOut[0].z;
    }
  },
  {
    group: "mat4 transform batch (perspective)",
    name: "unsafe mat4 transformPoint3 F32 Many",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        unsafeMat4TransformPoint3F32Many(packedMatrix, 0, packedVecA, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[2];
    }
  },
  {
    group: "mat4 transform batch (perspective)",
    name: "gl-matrix loop",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        for (let i = 0; i < BATCH_SIZE; i += 1) {
          glVec3.transformMat4(glOutPool[i], glVecA[i], glMatrices[0]);
        }
      }
      sink += glOutPool[0][2];
    }
  },
  {
    group: "vec3 length batch",
    name: "Mensura length3IntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        length3IntoMany(vecA, batchDotOut, BATCH_SIZE);
      }
      sink += batchDotOut[0];
    }
  },
  {
    group: "vec3 length batch",
    name: "unsafe vec3 length F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3LengthF32Many(packedVecA, packedDotOut, BATCH_SIZE);
      }
      sink += packedDotOut[0];
    }
  },
  {
    group: "vec3 distance batch",
    name: "Mensura distance3IntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        distance3IntoMany(vecA, vecB, batchDotOut, BATCH_SIZE);
      }
      sink += batchDotOut[0];
    }
  },
  {
    group: "vec3 distance batch",
    name: "unsafe vec3 distance F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3DistanceF32Many(packedVecA, packedVecB, packedDotOut, BATCH_SIZE);
      }
      sink += packedDotOut[0];
    }
  },
  {
    group: "vec3 scaleAndAdd batch",
    name: "Mensura scaleAndAdd3IntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        scaleAndAdd3IntoMany(vecA, vecB, 0.25, batchVecOut, BATCH_SIZE);
      }
      sink += batchVecOut[0].x;
    }
  },
  {
    group: "vec3 scaleAndAdd batch",
    name: "unsafe vec3 scaleAndAdd F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeVec3ScaleAndAddF32Many(packedVecA, packedVecB, 0.25, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[0];
    }
  },
  {
    group: "quat multiply batch",
    name: "Mensura quatMultiplyIntoMany",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        quatMultiplyIntoMany(quatA, quatB, quatOut, BATCH_SIZE);
      }
      sink += quatOut[0].w;
    }
  },
  {
    group: "quat multiply batch",
    name: "unsafe quat multiply F32 Many",
    iterations: BATCH_SIZE * BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < BATCH_REPEATS; r += 1) {
        unsafeQuatMultiplyF32Many(packedQuatA, packedQuatB, packedQuatOut, BATCH_SIZE);
      }
      sink += packedQuatOut[3];
    }
  },
  {
    group: "mat4 transform direction batch",
    name: "Mensura transformDirection3IntoMany",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        mat4TransformDirection3IntoMany(matrices[0], vecA, batchVecOut, BATCH_SIZE);
      }
      sink += batchVecOut[0].z;
    }
  },
  {
    group: "mat4 transform direction batch",
    name: "unsafe mat4 transformDirection3 F32 Many",
    iterations: BATCH_SIZE * MAT_BATCH_REPEATS,
    run: () => {
      for (let r = 0; r < MAT_BATCH_REPEATS; r += 1) {
        unsafeMat4TransformDirection3F32Many(packedMatrix, 0, packedVecA, packedVecOut, BATCH_SIZE);
      }
      sink += packedVecOut[2];
    }
  }
];

function measure(testCase) {
  const samples = [];
  for (let sample = 0; sample < WARMUP + SAMPLES; sample += 1) {
    const start = performance.now();
    testCase.run();
    const elapsed = performance.now() - start;
    if (sample >= WARMUP) {
      samples.push(elapsed);
    }
  }

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const opsPerSecond = testCase.iterations / (median / 1000);
  return {
    ...testCase,
    median,
    opsPerSecond
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

console.log("Mensura Benchmark");
console.log("=================");
console.log(`Node: ${process.version}`);
console.log(`V8: ${process.versions.v8}`);
console.log(`Samples: ${SAMPLES} median after ${WARMUP} warmups`);
console.log("");

let currentGroup = "";
let groupBaseline = 0;
const results = cases.map(measure);

for (const result of results) {
  if (result.group !== currentGroup) {
    currentGroup = result.group;
    groupBaseline = result.opsPerSecond;
    console.log(`\n${currentGroup}`);
    console.log("-".repeat(currentGroup.length));
  }

  const relative = result.opsPerSecond / groupBaseline;
  console.log(
    `${result.name.padEnd(34)} ${formatMs(result.median).padStart(10)}  ${formatNumber(result.opsPerSecond).padStart(14)} ops/s  ${relative.toFixed(2)}x`
  );
}

console.log(`\nchecksum: ${sink.toFixed(3)}`);

if (process.argv.includes("--check")) {
  checkPerformanceGates(results);
}

function checkPerformanceGates(initialResults) {
  // Release-blocking gates intentionally target the APIs Mensura recommends for
  // hot paths. Immutable helpers such as `add3` allocate inspectable objects;
  // they are ergonomic surface, not a gl-matrix replacement claim.
  //
  // V8 benchmark ratios move with CPU scheduling, tier-up timing, and tiny
  // kernel shape. The thresholds below are therefore relative gates, not
  // absolute ops/sec promises:
  // - direct `Into` APIs must stay competitive with gl-matrix, and the set must
  //   contain concrete wins. Mensura keeps inspectable `{x,y,z}` objects, so it
  //   should not claim every scalar kernel beats gl-matrix's typed arrays.
  // - object batch APIs must beat the equivalent gl-matrix loop. Tiny/sqrt-heavy
  //   object batches are not always faster than an inlined Mensura scalar loop
  //   because V8 can inline that local loop aggressively; matrix batches that
  //   hoist shared matrix reads must still show a real scalar-loop win.
  // - unsafe gates cover only the documented packed-buffer fast cases. Packed
  //   APIs that mainly exist for layout interop, or that fluctuate around the
  //   object batch path in V8 (mat4 multiply, quat multiply), are intentionally
  //   not release blockers.
  const gates = [
    {
      name: "add3Into >= 0.90x gl-matrix vec3.add",
      actual: "Mensura add3Into",
      actualGroup: "vec3 add",
      reference: "gl-matrix vec3.add",
      referenceGroup: "vec3 add",
      // 0.90x is a competitiveness floor, not a claim that object-property
      // stores always beat gl-matrix typed-array stores on every V8 build.
      minRatio: 0.9,
      competitive: true
    },
    {
      name: "normalize3Into >= 0.90x gl-matrix vec3.normalize",
      actual: "Mensura normalize3Into",
      actualGroup: "vec3 normalize",
      reference: "gl-matrix vec3.normalize",
      referenceGroup: "vec3 normalize",
      // Normalize includes a sqrt and can move with V8 math intrinsic tiering;
      // keep it near gl-matrix while requiring other direct APIs to win too.
      minRatio: 0.9,
      competitive: true
    },
    {
      name: "mat4MultiplyInto >= 0.90x gl-matrix mat4.multiply",
      actual: "Mensura mat4MultiplyInto",
      actualGroup: "mat4 multiply",
      reference: "gl-matrix mat4.multiply",
      referenceGroup: "mat4 multiply",
      // Mat4 multiply is arithmetic-heavy, so a small margin below gl-matrix
      // can be host noise rather than a real architectural failure.
      minRatio: 0.9,
      competitive: true
    },
    {
      name: "affinePoint3Into >= 0.90x gl-matrix vec3.transformMat4",
      actual: "Mensura affinePoint3Into",
      actualGroup: "mat4 transform",
      reference: "gl-matrix vec3.transformMat4",
      referenceGroup: "mat4 transform",
      // Affine transform should usually win, but the gate remains a
      // competitive floor because this section also checks direct wins count.
      minRatio: 0.9,
      competitive: true
    },
    {
      name: "add3IntoMany >= 1.20x gl-matrix vec3.add loop",
      actual: "Mensura add3IntoMany",
      actualGroup: "vec3 add batch",
      reference: "gl-matrix loop",
      referenceGroup: "vec3 add batch",
      // Batch object APIs should clear cross-package call overhead by a visible
      // margin; 1.20x has held across local Node/V8 runs without being flaky.
      minRatio: 1.2
    },
    {
      name: "normalize3IntoMany >= 1.20x gl-matrix normalize loop",
      actual: "Mensura normalize3IntoMany",
      actualGroup: "vec3 normalize batch",
      reference: "gl-matrix loop",
      referenceGroup: "vec3 normalize batch",
      // Sqrt-heavy normalize batches get less headroom than add, but should
      // still beat the gl-matrix loop after call overhead is amortized.
      minRatio: 1.2
    },
    {
      name: "affinePoint3IntoMany >= 1.15x scalar affine loop",
      actual: "Mensura affinePoint3IntoMany",
      actualGroup: "mat4 affine transform batch",
      reference: "scalar object loop (affinePoint3Into)",
      referenceGroup: "mat4 affine transform batch",
      // Matrix hoisting is the expected win here; 1.15x leaves room for host
      // variance while blocking regressions that remove the hoist benefit.
      minRatio: 1.15
    },
    {
      name: "unsafeVec3AddF32Many >= 2.0x scalar add3Into loop",
      actual: "unsafe vec3 F32 Many",
      actualGroup: "vec3 add batch",
      reference: "scalar object loop (add3Into)",
      referenceGroup: "vec3 add batch",
      // Packed vec3 add is the flagship unsafe kernel: tiny body, contiguous
      // typed-array lanes. If it is not at least 2x scalar object loop, the
      // unsafe path is not earning its complexity on that runtime.
      minRatio: 2
    },
    {
      name: "unsafeVec3DotF32Many >= 1.25x Mensura dot3IntoMany",
      actual: "unsafe vec3 dot F32 Many",
      actualGroup: "vec3 dot batch",
      reference: "Mensura dot3IntoMany",
      referenceGroup: "vec3 dot batch",
      // Dot writes scalar outputs and benefits from packed input reads, but
      // has less work than cross/scaleAndAdd; use a lower unsafe floor.
      minRatio: 1.25
    },
    {
      name: "unsafeVec3CrossF32Many >= 1.75x Mensura cross3IntoMany",
      actual: "unsafe vec3 cross F32 Many",
      actualGroup: "vec3 cross batch",
      reference: "Mensura cross3IntoMany",
      referenceGroup: "vec3 cross batch",
      // Cross has six mul/sub terms and enough packed-lane reuse to justify a
      // higher unsafe floor.
      minRatio: 1.75
    },
    {
      name: "unsafeVec3ScaleAndAddF32Many >= 1.75x Mensura scaleAndAdd3IntoMany",
      actual: "unsafe vec3 scaleAndAdd F32 Many",
      actualGroup: "vec3 scaleAndAdd batch",
      reference: "Mensura scaleAndAdd3IntoMany",
      referenceGroup: "vec3 scaleAndAdd batch",
      // Scale-and-add is an integrator hot path and should show a clear packed
      // buffer win before being promoted as unsafe guidance.
      minRatio: 1.75
    },
    {
      name: "transformPoint3IntoMany >= 1.00x gl-matrix transform loop",
      actual: "Mensura transformPoint3IntoMany",
      actualGroup: "mat4 transform batch (perspective)",
      reference: "gl-matrix loop",
      referenceGroup: "mat4 transform batch (perspective)",
      // Perspective transform batch only needs to beat the gl-matrix loop; the
      // unsafe variant is deliberately not gated because current V8 can already
      // inline the object batch well.
      minRatio: 1
    }
  ];

  const rounds = [initialResults];
  while (rounds.length < CHECK_ROUNDS) {
    rounds.push(cases.map(measure));
  }

  const failures = [];
  let competitiveWins = 0;
  console.log(`\nPerformance gates (${CHECK_ROUNDS}-round median ratios)`);
  console.log("-------------------------------------------");

  for (const gate of gates) {
    const ratios = rounds.map((round) => gateRatio(round, gate)).filter((value) => value !== undefined);
    if (ratios.length !== CHECK_ROUNDS) {
      failures.push(`${gate.name}: missing benchmark case`);
      console.log(`${gate.name.padEnd(76)} MISSING`);
      continue;
    }

    ratios.sort((a, b) => a - b);
    const ratio = ratios[Math.floor(ratios.length / 2)];
    const passed = ratio >= gate.minRatio;
    console.log(
      `${gate.name.padEnd(76)} ${ratio.toFixed(2)}x >= ${gate.minRatio.toFixed(2)}x ${passed ? "PASS" : "FAIL"}`
    );

    if (!passed) {
      failures.push(`${gate.name}: median ${ratio.toFixed(2)}x < ${gate.minRatio.toFixed(2)}x`);
    }

    if (gate.competitive === true && ratio > 1) {
      competitiveWins += 1;
    }
  }

  if (competitiveWins < 2) {
    failures.push(`direct Into APIs need at least 2 gl-matrix wins; got ${competitiveWins}`);
  }

  if (failures.length > 0) {
    console.error("\nPerformance gate failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

function gateRatio(results, gate) {
  const byGroupAndName = new Map(results.map((result) => [`${result.group}\0${result.name}`, result]));
  const byName = new Map();
  for (const result of results) {
    if (!byName.has(result.name)) {
      byName.set(result.name, []);
    }
    byName.get(result.name).push(result);
  }

  const actual = lookupResult(gate.actual, gate.actualGroup, byName, byGroupAndName);
  const reference = lookupResult(gate.reference, gate.referenceGroup ?? actual?.group, byName, byGroupAndName);
  if (!actual || !reference) {
    return undefined;
  }
  return actual.opsPerSecond / reference.opsPerSecond;
}

function lookupResult(name, group, byName, byGroupAndName) {
  if (group) {
    return byGroupAndName.get(`${group}\0${name}`);
  }

  const matches = byName.get(name);
  if (!matches || matches.length === 0) {
    return undefined;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return undefined;
}
