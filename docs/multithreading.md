# Multithreading

Mensura targets game and editor runtimes where collision narrowphase,
acceleration-structure traversal, and per-frame matrix work routinely cross
into Web Workers or Node `worker_threads`. The kernel is built around that
assumption.

## Rules

1. **Per-call scratch lives on a caller-owned context.** Long-running hot paths
   (`gjk`, `epa`, `mprIntersect`, `testObbObbSat`, `bvhRaycast`) take a context argument:
   `CollisionContext` from `@exornea/mensura/collision`, `AccelContext` from
   `@exornea/mensura/accel`. The caller decides who owns each context.
2. **One context per concurrent caller.** Two workers must each hold their own
   context. A single worker that issues two concurrent narrowphase calls
   (reentrancy via async/await or callbacks) must use two separate contexts.
   Mensura functions do not lock; they assume serial use of their context.
3. **Module-level scratch is forbidden in hot paths.** No `const _tmp = ...`
   shared across calls inside a module. Past code that did this has been
   migrated; new code should not reintroduce it. The legitimate exception is
   pure stateless helpers (no `MutableVec3` retained between calls).
4. **Public values are inspectable, not shared.** `Vec3`, `Mat4`, `Quat`, and
   the geometry primitives are plain objects/arrays. They are *not*
   transferable to a Worker, *not* clonable without alloc, and *not* expected
   to live on `SharedArrayBuffer`. Pass them by structured clone (worker
   `postMessage`) for one-shot delivery, or convert to `Float32Array`.
5. **`Float32Array` bridges are the shared-memory surface.** `gpu/float32.ts`
   and `unsafe/f32.ts` operate on any `Float32Array`, including views backed by
   `SharedArrayBuffer`. There are no implicit copies; the writer writes
   directly into the provided view.
6. **`Atomics` is the caller's responsibility.** Mensura writers do not use
   `Atomics.store` / `Atomics.notify`. If the buffer is shared, the caller
   coordinates publication.

## Pattern

```ts
import { CollisionWorld } from "@exornea/mensura/world";
import { AccelContext } from "@exornea/mensura/accel";
import {
  CollisionContext,
  gjk,
  mprIntersect,
  testObbObbSat
} from "@exornea/mensura/collision";

// One CollisionWorld per worker; its private accel context is not shared.
const world = new CollisionWorld();

// One context per concurrent caller in this worker.
const accel = new AccelContext();
const collision = new CollisionContext();

function step(): void {
  world.updateBvh();
  // world.raycast uses its own private context, so it is independent of `accel`.
  const hits = world.raycast(viewRay);
  const overlap = testObbObbSat(boxA, boxB, collision);
  const probe = gjk(supportAInto, supportBInto, collision);
  const portalProbe = mprIntersect(shapeAInto, shapeBInto, collision);
}
```

A second worker has its own `world`, `accel`, and `collision`. There is no
hidden shared state.

## SharedArrayBuffer Bridge

```ts
import { unsafeMat4WriteFloat32 } from "@exornea/mensura/unsafe";

const shared = new SharedArrayBuffer(16 * 4);
const view = new Float32Array(shared);

// On worker A:
unsafeMat4WriteFloat32(viewProjection, view, 0);
Atomics.store(new Int32Array(shared), 0, 1); // caller-managed publication

// On worker B (after Atomics.load sees the publication):
// reads `view` directly. No copy.
```

The writer does not allocate, does not retain references to the view, and does
not interact with `Atomics`. The caller decides on the publication protocol.

## What Mensura Does Not Provide

- Worker pools: outside scope. Mensura is the kernel; orchestration belongs to
  the consumer (Geukbit, Zeno, application code).
- `SharedArrayBuffer`-backed `Vec3` / `Mat4` value types: current public API
  stays as inspectable objects. A future packed view type would land in
  `unsafe/` with explicit naming.
- Lock-free narrowphase data structures: every callee assumes serial use of
  its context. Concurrency comes from worker isolation, not from sharing
  contexts across threads.

## Verifying

- `npm run benchmark` runs single-threaded. Throughput per worker scales with
  CPU cores in practice; cross-worker contention only appears when callers
  share a `SharedArrayBuffer` view, which is the caller's protocol.
- When introducing a new hot-path API, add it with a context argument from the
  start. Do not introduce a module-scratch helper as a "fast path" and migrate
  later; the migration cost has already been paid once.
