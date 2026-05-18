// SharedArrayBuffer worker handoff with caller-owned Atomics publication.
//
// The host (main thread) packs vec3 inputs into a SharedArrayBuffer, posts the
// SAB to a worker, the worker runs Mensura's unsafe kernels directly on the
// shared memory, and publishes completion through an Int32Array control word.
//
// Key points this example exercises:
//
//   1. Mensura does not own threads. The worker is created by the host.
//   2. Mensura unsafe kernels read and write SharedArrayBuffer-backed
//      Float32Array views without allocating.
//   3. Synchronization is the caller's responsibility: we use Atomics on a
//      separate control SAB to publish "result ready". Mensura never touches
//      Atomics.
//   4. Each worker carries its own CollisionContext / AccelContext if it does
//      collision work, because module state is not shared across workers in
//      JS (every worker has its own module instance).
//
// Run with a runtime that supports Worker + SharedArrayBuffer
// (Node 18+ with `--experimental-vm-modules` or a browser served with the
// COOP/COEP headers needed for cross-origin isolation).

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import {
  unsafeAabbExpandByPointF32Many,
  unsafeVec3AddF32Many,
  unsafeVec3NormalizeF32Many
} from "@exornea/mensura/unsafe";
import { aabbEmptyInto, mutableAabb } from "@exornea/mensura/geometry";

const POINT_COUNT = 1024;

// Indices into the control SAB. STATUS is a publication flag toggled by the
// worker when the result is ready. Use Atomics.wait/notify across threads.
const STATUS_INDEX = 0;
const STATUS_PENDING = 0;
const STATUS_READY = 1;

if (isMainThread) {
  // 1. Allocate shared memory for inputs, outputs, and a tiny control word.
  const positionsSab = new SharedArrayBuffer(POINT_COUNT * 3 * 4);
  const velocitiesSab = new SharedArrayBuffer(POINT_COUNT * 3 * 4);
  const outSab = new SharedArrayBuffer(POINT_COUNT * 3 * 4);
  const aabbSab = new SharedArrayBuffer(6 * 4);
  const controlSab = new SharedArrayBuffer(4);

  const positions = new Float32Array(positionsSab);
  const velocities = new Float32Array(velocitiesSab);
  const aabb = new Float32Array(aabbSab);
  const control = new Int32Array(controlSab);

  // 2. Seed inputs in the host. Worker sees the exact same bytes.
  for (let i = 0; i < POINT_COUNT; i++) {
    positions[i * 3 + 0] = i * 0.01;
    positions[i * 3 + 1] = i * 0.02;
    positions[i * 3 + 2] = i * 0.03;
    velocities[i * 3 + 0] = 0.1;
    velocities[i * 3 + 1] = 0.2;
    velocities[i * 3 + 2] = 0.3;
  }

  // 3. Initialize the AABB to empty so the worker can grow it with
  //    unsafeAabbExpandByPointF32Many.
  aabbEmptyInto(mutableAabb()); // shows the semantic helper; below we seed packed bytes directly.
  aabb[0] = Number.POSITIVE_INFINITY;
  aabb[1] = Number.POSITIVE_INFINITY;
  aabb[2] = Number.POSITIVE_INFINITY;
  aabb[3] = Number.NEGATIVE_INFINITY;
  aabb[4] = Number.NEGATIVE_INFINITY;
  aabb[5] = Number.NEGATIVE_INFINITY;

  Atomics.store(control, STATUS_INDEX, STATUS_PENDING);

  // 4. Hand the SABs to the worker. Worker_threads serializes only the SAB
  //    descriptors; the backing memory is shared.
  const worker = new Worker(new URL(import.meta.url), {
    workerData: {
      positionsSab,
      velocitiesSab,
      outSab,
      aabbSab,
      controlSab,
      pointCount: POINT_COUNT
    }
  });

  worker.on("exit", () => {
    // 5. Read the worker's results out of shared memory. We waited for the
    //    publication flag below, so the data is visible.
    const result = new Float32Array(outSab);
    console.log("first packed result:", result[0], result[1], result[2]);
    console.log("AABB min:", aabb[0], aabb[1], aabb[2]);
    console.log("AABB max:", aabb[3], aabb[4], aabb[5]);
  });

  // 6. Wait until the worker publishes STATUS_READY. Atomics.wait blocks the
  //    main thread; use Atomics.waitAsync in real UI code.
  Atomics.wait(control, STATUS_INDEX, STATUS_PENDING);
  console.log("worker reported ready");
} else {
  const {
    positionsSab,
    velocitiesSab,
    outSab,
    aabbSab,
    controlSab,
    pointCount
  } = workerData as {
    positionsSab: SharedArrayBuffer;
    velocitiesSab: SharedArrayBuffer;
    outSab: SharedArrayBuffer;
    aabbSab: SharedArrayBuffer;
    controlSab: SharedArrayBuffer;
    pointCount: number;
  };

  const positions = new Float32Array(positionsSab);
  const velocities = new Float32Array(velocitiesSab);
  const out = new Float32Array(outSab);
  const aabb = new Float32Array(aabbSab);
  const control = new Int32Array(controlSab);

  // 7. Run Mensura kernels directly on shared memory. No allocation, no copy.
  //    `out`, `positions`, `velocities` all reference the same heap as the
  //    host thread.
  unsafeVec3AddF32Many(positions, velocities, out, pointCount);
  unsafeVec3NormalizeF32Many(out, out, pointCount);
  unsafeAabbExpandByPointF32Many(aabb, 0, out, pointCount);

  // 8. Publish completion. Atomics.store gives the host a happens-before
  //    relationship: anything written to shared memory before this point is
  //    visible to a reader that observes STATUS_READY.
  Atomics.store(control, STATUS_INDEX, STATUS_READY);
  Atomics.notify(control, STATUS_INDEX);

  // Worker exits naturally; the host's "exit" listener fires.
  parentPort?.close();
}

// Rules of thumb for SAB + Mensura unsafe kernels:
//
// - Mensura never allocates inside unsafe kernels, so reads/writes happen
//   directly on the shared bytes.
// - Mensura never calls Atomics. You decide when results are "published" and
//   you choose the synchronization primitive (Atomics.wait/notify, condvars
//   wrapped around Int32Array, postMessage as a coarse signal, etc.).
// - For pipeline patterns, dedicate a separate SAB region per stage so a
//   producer and a consumer never overlap their writes. Mensura kernels do
//   not enforce ownership; the caller does.
// - For collision/accel work in a worker, instantiate a fresh
//   CollisionContext or AccelContext inside the worker. Contexts are
//   not transferable.
