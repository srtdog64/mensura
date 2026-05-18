import { performance } from "node:perf_hooks";
import {
  add3,
  add3Into,
  mat4Identity,
  mat4Multiply,
  mat4MultiplyInto,
  mat4TransformPoint3,
  mat4TransformPoint3Into,
  mutableVec3,
  normalize3,
  normalize3Into,
  vec3
} from "./dist/core/index.js";
import { aabb, ray, rayAabbHitDistance } from "./dist/geometry/index.js";
import { vec3WriteFloat32 } from "./dist/gpu/index.js";
import {
  unsafeMat4WriteDataViewF32,
  unsafeVec3WriteDataViewF32,
  unsafeVec3WriteFloat32
} from "./dist/unsafe/index.js";

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
const rays = Array.from({ length: 128 }, (_, index) =>
  ray(vec3(index * 0.01, 0, 5), vec3(0, 0, -1))
);
const boxes = Array.from({ length: 128 }, (_, index) =>
  aabb(vec3(index * 0.01 - 1, -1, -1), vec3(index * 0.01 + 1, 1, 1))
);
const packed = new Float32Array(64);
const dataView = new DataView(new ArrayBuffer(256));

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
    name: "unsafeMat4WriteDataViewF32",
    iterations: WRITE_ITERATIONS,
    run: () => {
      for (let index = 0; index < WRITE_ITERATIONS; index += 1) {
        unsafeMat4WriteDataViewF32(matrices[index & 127], dataView, 64);
        sink += dataView.getFloat32(64, true);
      }
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
