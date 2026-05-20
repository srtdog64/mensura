import { buildBvh } from "./dist/accel/index.js";
import { CollisionContext, mprIntersect } from "./dist/collision/index.js";
import {
  add3Into,
  lengthSq3,
  mat4Copy,
  mat4MultiplyInto,
  mat4Translation,
  mutableVec3,
  normalize3Into,
  vec3
} from "./dist/core/index.js";
import { aabb, ray } from "./dist/geometry/index.js";
import { rayAabbHitDistance } from "./dist/query/index.js";

declare const process: {
  readonly version: string;
  readonly versions: {
    readonly v8: string;
  };
};

// Focused smoke benchmark for humans. `benchmark-runner.js` owns release
// gates; this file stays shorter and uses enough operations to rise above
// timer noise in Node without making ad-hoc runs slow.
const COUNT = 200_000;
const WARMUPS = 2;
const SAMPLES = 7;

let checksum = 0;

function main(): void {
  console.log("Mensura focused perf benchmark");
  console.log("==============================");
  console.log(`Node: ${process.version}`);
  console.log(`V8: ${process.versions.v8}`);
  console.log(`Count: ${COUNT}`);
  console.log(`Samples: ${SAMPLES} median after ${WARMUPS} warmups\n`);

  // 128-element pools are powers of two so the hot loops can wrap indices with
  // `i & 127` instead of `% 128`; the benchmark should measure Mensura math,
  // not integer division in the harness.
  const vectors = Array.from({ length: 128 }, (_, i) =>
    vec3(i * 0.125 + 1, i * 0.25 + 2, i * 0.375 + 3)
  );
  const matrices = Array.from({ length: 128 }, (_, i) =>
    mat4Translation(vec3(i * 0.01, i * 0.02, i * 0.03))
  );
  const boxes = Array.from({ length: 128 }, (_, i) =>
    aabb(vec3(i, i % 7, -i - 2), vec3(i + 1, (i % 7) + 1, -i - 1))
  );
  const supportA = sphereSupport(vec3(0, 0, 0), 1);
  const supportB = sphereSupport(vec3(0.75, 0.25, 0), 1);
  const ctx = new CollisionContext();

  bench("vec3 add3Into", COUNT, () => {
    const out = mutableVec3();
    for (let i = 0; i < COUNT; i++) {
      const a = vectors[i & 127];
      const b = vectors[(i + 17) & 127];
      add3Into(a, b, out);
      checksum += out.x;
    }
  });

  bench("vec3 normalize3Into", COUNT, () => {
    const out = mutableVec3();
    for (let i = 0; i < COUNT; i++) {
      normalize3Into(vectors[i & 127], out);
      checksum += out.y;
    }
  });

  // Mat4 multiply performs substantially more arithmetic than a vec3 op, so
  // use fewer iterations to keep this focused benchmark interactive.
  bench("mat4 multiplyInto", COUNT / 8, () => {
    const out = mat4Copy(matrices[0]);
    for (let i = 0; i < COUNT / 8; i++) {
      mat4MultiplyInto(matrices[i & 127], matrices[(i + 31) & 127], out);
      checksum += out[12];
    }
  });

  bench("rayAabbHitDistance", COUNT, () => {
    const pick = ray(vec3(0.5, 0.5, 0), vec3(0, 0, -1));
    for (let i = 0; i < COUNT; i++) {
      checksum += rayAabbHitDistance(pick, boxes[i & 127]) ?? 0;
    }
  });

  // MPR is an iterative narrowphase; lower count keeps the benchmark useful as
  // a quick smoke rather than a full collision stress test.
  bench("MPR sphere/sphere", COUNT / 16, () => {
    for (let i = 0; i < COUNT / 16; i++) {
      const result = mprIntersect(
        { center: vec3(0, 0, 0), supportInto: supportA },
        { center: vec3(0.75, 0.25, 0), supportInto: supportB },
        ctx
      );
      checksum += result.ok && result.value.intersect ? 1 : 0;
    }
  });

  // BVH build allocates and sorts by design. 256 builds gives a visible median
  // without dominating the focused benchmark.
  bench("BVH build 128 AABBs", 256, () => {
    for (let i = 0; i < 256; i++) {
      const result = buildBvh(boxes, { maxPrimitivesPerLeaf: 4, splitMethod: "sah" });
      checksum += result.ok && result.value.root ? 1 : 0;
    }
  });

  console.log(`\nchecksum: ${checksum.toFixed(3)}`);
}

function bench(name: string, operations: number, fn: () => void): void {
  const samples: number[] = [];
  for (let i = 0; i < WARMUPS + SAMPLES; i++) {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    if (i >= WARMUPS) {
      samples.push(elapsed);
    }
  }

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const opsPerSecond = operations / (median / 1000);
  console.log(`${name.padEnd(24)} ${median.toFixed(2).padStart(8)}ms  ${formatOps(opsPerSecond)}`);
}

function sphereSupport(center: ReturnType<typeof vec3>, radius: number) {
  return (direction: ReturnType<typeof vec3>, out: ReturnType<typeof mutableVec3>) => {
    const lenSq = lengthSq3(direction);
    if (lenSq === 0) {
      out.x = center.x + radius;
      out.y = center.y;
      out.z = center.z;
      return out;
    }

    const scale = radius / Math.sqrt(lenSq);
    out.x = center.x + direction.x * scale;
    out.y = center.y + direction.y * scale;
    out.z = center.z + direction.z * scale;
    return out;
  };
}

function formatOps(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ops/s`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K ops/s`;
  }
  return `${value.toFixed(1)} ops/s`;
}

main();
