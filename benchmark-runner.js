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

const SAMPLES = 7;
const WARMUP = 2;
const VEC_ITERATIONS = 1_000_000;
const MAT_ITERATIONS = 250_000;
const GEOMETRY_ITERATIONS = 500_000;
const WRITE_ITERATIONS = 500_000;

let sink = 0;

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
const dataView = new DataView(new ArrayBuffer(256));

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
console.log(`Samples: ${SAMPLES} median after ${WARMUP} warmups`);
console.log("");

let currentGroup = "";
let groupBaseline = 0;

for (const result of cases.map(measure)) {
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
