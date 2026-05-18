import { performance } from "perf_hooks";
import { MAT3_IDENTITY, vec3 } from "../src/core/index.js";
import { obb } from "../src/geometry/index.js";
import { testObbObbSat, gjk, epa, CollisionContext } from "../src/collision/index.js";
import { normalize3, scaleAndAdd3 } from "../src/core/vec3.js";

function sphereSupport(center: ReturnType<typeof vec3>, radius: number) {
  return (direction: ReturnType<typeof vec3>) => {
    const normalized = normalize3(direction);
    return scaleAndAdd3(center, normalized, radius);
  };
}

function runBenchmark() {
  console.log("--- Benchmark Start ---");

  // 1. Benchmark SAT (OBB vs OBB)
  const obbA = obb(vec3(0, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
  const obbB = obb(vec3(1.5, 0, 0), vec3(1, 1, 1), MAT3_IDENTITY);
  const ctx = new CollisionContext();

  let start = performance.now();
  let hits = 0;
  const iterations = 100_000;
  for (let i = 0; i < iterations; i++) {
    if (testObbObbSat(obbA, obbB, ctx)) {
      hits++;
    }
  }
  let end = performance.now();
  console.log(`SAT (OBB vs OBB) x ${iterations}: ${(end - start).toFixed(2)} ms`);

  // 2. Benchmark GJK
  const supportA = sphereSupport(vec3(0, 0, 0), 1);
  const supportB = sphereSupport(vec3(1, 0, 0), 1);

  start = performance.now();
  let gjkHits = 0;
  for (let i = 0; i < iterations; i++) {
    const res = gjk(supportA, supportB, ctx);
    if (res.ok && res.value.intersect) {
      gjkHits++;
    }
  }
  end = performance.now();
  console.log(`GJK (Sphere vs Sphere) x ${iterations}: ${(end - start).toFixed(2)} ms`);
}

runBenchmark();
