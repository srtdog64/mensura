# Mensura TODO

This file tracks remaining work after the v0.1 kernel pass. It should reflect
the current package shape, not the historical reference-reading checklist.

## Current Baseline

Already in place:

- `core`: float policy, conversion loss, vec3/vec4, mat3/mat4, quat, euler,
  dual-quat, `Result`.
- `geometry`: ray, plane, AABB, sphere, OBB, capsule, frustum, triangle mesh.
- `query`: ray hit data, ray/plane/AABB/sphere/triangle tests, frustum tests.
- `collision`: SAT, GJK, EPA with caller-owned `CollisionContext`.
- `accel`: BVH with caller-owned `AccelContext`.
- `world`: `CollisionWorld` orchestration over bodies and BVH.
- `layout` / `data`: WGSL-compatible layout metadata and checked DataView
  projection.
- `validation`: `Result`-first finite, range, float32-stability, non-empty, and
  non-degenerate checks before measurement or serialization.
- `batch`: object-array `*IntoMany` kernels.
- `gpu`: WebGPU projection and Float32Array bridge.
- `unsafe`: explicit packed Float32Array and DataView helpers.
- Verification gates: `npm run check`, `npm run benchmark`,
  `npm pack --dry-run`.

## P0: API Freeze Prep

- Maintain `docs/api-stability.md` as the source of truth for stable 0.1,
  experimental, compatibility, and unsafe surfaces.
- Keep naming consistent:
  - `Into` means caller-owned single output.
  - `IntoMany` means object-array batch.
  - `unsafe*F32Many` means packed Float32Array batch.
- Before promoting `collision`, `accel`, or `world` from experimental, add the
  witness coverage listed below and update README plus `docs/api-stability.md`.

## P1: Collision Witnesses

Collision is the least mature public area. Before calling it public-ready:

- SAT: rotated OBB overlap, separation, touching boundary, near-parallel axes
  are now covered in `test/physics.test.ts`.
- GJK: sphere support hit/miss, box support hit/miss, containment, touching
  boundary classification, and a `GJK_MAX_ITERATIONS` Result witness are
  covered.
- EPA: degenerate simplex Result is covered, plus a successful penetration
  recovery witness from a real GJK simplex.
- GJK hot path no longer allocates per call: `CollisionContext` now owns the
  simplex pool, the initial direction, and the working direction. `GjkResult`
  exposes `simplex` and `simplexSize` as a view into the context (valid until
  the next `gjk` call). `epa(simplex, simplexSize, ...)` takes the explicit
  size so it never slices.
- Remaining: a deterministic non-converging EPA witness; a wider sweep over
  randomized OBB pairs.

## P2: Geometry Breadth

- `aabbEmpty()` / `aabbEmptyInto()` / `aabbIsEmpty()` ship in
  `geometry/aabb.ts`; derived AABB projections such as closest point and
  bounding sphere are exposed from `measure`.
- Triangle measurement operations ship in `measure/triangle.ts`:
  `triangleNormal(Into)`, `triangleArea`, `triangleDoubleArea`,
  `triangleBarycentric(Into)`, `triangleClosestPoint(Into)`.
- Result-first counterparts ship in `measure/checked.ts`:
  `aabbClosestPointChecked(/Into)`, `aabbDistanceSqToPointChecked`,
  `aabbGetBoundingSphereChecked(/Into)`,
  `triangleNormalChecked(/Into)`, `triangleBarycentricChecked(/Into)`,
  `triangleClosestPointChecked(/Into)`. They pre-test via the
  `validation` layer and return `MEASURE_EMPTY_DOMAIN` or
  `MEASURE_DEGENERATE` instead of relying on sentinels.
- Raw `aabbDistanceSqToPoint` now returns `+Infinity` for empty AABBs
  (`dist(p, ∅) = +∞`), keeping `dist² ≤ r²` predicates safely false.
- Capsule predicates ship in `geometry/capsule.ts`; derived bounds/distance
  projections are exposed from `measure`:
  `capsuleContainsPoint`, `capsuleIntersectsSphere`,
  `capsuleSegmentDistanceSqToPoint`, `capsuleGetAabb(Into)`.
- Frustum extraction:
  - WebGPU forward-Z remains the default.
  - Reverse-Z perspective ships as `mat4PerspectiveReverseZWebGpuRh(Into)`.
  - OpenGL NDC variant is not added unless a real consumer asks; named,
    not inferred.

## P3: Batch And Unsafe Coverage

- Keep object batch and unsafe packed kernels semantically paired where useful.
- Do not add unsafe kernels without tests that cover:
  - count-limited writes.
  - aliasing contract.
  - packed layout stride.
  - at least one realistic numeric case.
- Shipped additions: `unsafeVec3MinF32Many`, `unsafeVec3MaxF32Many`,
  `unsafeAabbExpandByPointF32Many` (mutates a stride-6 box buffer in place).
- Optional follow-up: `unsafeMat4ComposeTrsF32Many` only if measured useful.
- Defer WebAssembly/SIMD mat4 multiply for now.
  - Current `unsafeMat4MultiplyF32Many` is competitive with the scalar object
    loop and already beats the measured gl-matrix loop.
  - WASM only makes sense after a real workload shows repeated batches around
    N >= 512 where matrix multiply is the bottleneck.
  - Do not add WASM to the root or normal unsafe surface. If this is revived,
    create an explicit `wasm` or `unsafe/wasm` layer with documented
    `WebAssembly.Memory` ownership, fallback behavior, generation steps, and
    checksum/provenance for the shipped binary.

## P4: Compiler And Worker Integration

- Add checked safe counterparts before exposing new unsafe binary projections.
- Keep generated-code-friendly layout constants next to read/write functions.
- `examples/shared-array-buffer-worker.ts` demonstrates
  `SharedArrayBuffer` + caller-owned `Atomics` publication. Mensura never
  owns worker pools, scheduling, or `Atomics` calls.

## P5: Documentation Cleanup

- Keep `docs/performance.md` tied to a real `npm run benchmark` output.
- Keep `docs/multithreading.md` aligned with context-based collision/accel
  APIs.
- Keep reference-library notes as historical rationale only; do not let them
  override current code truth.
- Add `README` badges or status only after the API freeze policy is written.

## Package Boundary

Mensura must not depend on Geukbit, Three.js, React, Zeno, Insere, Ordo, or any
host engine. Those packages may consume Mensura, but Mensura remains the
lower-level spatial math and geometry kernel.
