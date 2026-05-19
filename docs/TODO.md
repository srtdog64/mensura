# Mensura TODO

This file tracks remaining work after the v0.1 kernel pass. It should reflect
the current package shape, not the historical reference-reading checklist.

## Current Baseline

Already in place:

- `core`: float policy, conversion loss, vec3/vec4, mat3/mat4, quat, euler,
  dual-quat, `Result`.
- `geometry`: ray, plane, AABB, sphere, OBB, capsule, frustum, triangle mesh.
- `query`: ray hit data, ray/plane/AABB/sphere/triangle tests, frustum tests.
- `collision`: SAT, GJK, EPA, MPR, and CCD with caller-owned
  `CollisionContext`.
- `accel`: median and SAH BVH builders with caller-owned `AccelContext`, ray
  traversal, and broadphase overlap pair generation.
- `world`: `CollisionWorld` orchestration over bodies, BVH, raycast, and
  broadphase pairs.
- `layout` / `data`: WGSL-compatible layout metadata and checked DataView
  projection.
- `validation`: `Result`-first finite, range, float32-stability, non-empty,
  non-degenerate, and reproducibility seed/RNG/distribution checks before
  measurement, serialization, or deterministic stress generation. Includes
  `gaussian` / `triangular` distributions, `sampleDeterministicInt`,
  `shuffleInPlace`, `sampleUnitDirection3Into` / `sampleInUnitBall3Into` /
  `sampleInAabbInto`, `forkRng` named sub-streams, and bias diagnostics
  (`summarizeSamples`, `validateUniformBias`).
- `batch`: object-array `*IntoMany` kernels.
- `gpu`: WebGPU projection and Float32Array bridge.
- `unsafe`: explicit packed Float32Array and DataView helpers.
- `wasm`: WebAssembly SIMD feature probing. Actual SIMD kernels remain
  deferred until a workload proves the JS unsafe kernel is the bottleneck.
- Verification gates: `npm run check`, `npm run benchmark`,
  `npm pack --dry-run`, `npm run check:contracts`, and
  `npm run check:release`.
- Release hardening has started: golden fixtures, deterministic fuzz
  invariants, experimental-module build output (`dist-experimental/`, ignored),
  package export plus `dist/*.d.ts` symbol snapshot, packaged
  bundler-resolution smoke checks, Vite browser bundle smoke checks, and a
  longer deterministic fuzz corpus.

## P0: API Freeze Prep

- Maintain `docs/api-stability.md` as the source of truth for stable 0.1,
  experimental, compatibility, and unsafe surfaces.
- Treat `test/golden/api-surface.json` as an intentional-change gate. It pins
  package exports and generated `.d.ts` symbols, so public API drift should be
  reviewed before running `npm run api:snapshot:write`.
- Keep `packages/bundler-smoke` and `packages/browser-smoke` package-shaped.
  They are release checks, not published packages; generated output belongs in
  `.mensura-smoke/`.
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
- CCD: `sweptAabbTimeOfImpact` and `sweptSphereTimeOfImpact` cover linear
  time-of-impact for common tunneling cases.
- MPR: `mprIntersect` now runs portal discovery and portal refinement directly
  over support-mapped convex shapes. Remaining MPR work is penetration/contact
  recovery, not binary intersection.
- Release guard: public source is checked by `release:stub-check`, so
  placeholder collision exports cannot pass `npm run check:release` or
  `prepublishOnly`.
- GJK hot path no longer allocates per call: `CollisionContext` now owns the
  simplex pool, the initial direction, and the working direction. `GjkResult`
  exposes `simplex` and `simplexSize` as a view into the context (valid until
  the next `gjk` call). `epa(simplex, simplexSize, ...)` takes the explicit
  size so it never slices.
- Deterministic non-converging EPA witness lands by calling `epa` with
  `maxIterations = 0` against a real GJK 4-simplex, so the loop never enters
  and the function falls through to `EPA_MAX_ITERATIONS`.
- Randomized OBB pair sweep (`test/physics.test.ts`) generates 80 OBB pairs
  with a deterministic seed, runs both SAT and GJK, and requires agreement
  within a 5% boundary-noise budget (SAT skips near-parallel cross axes and
  GJK uses strict-positive support, so a small disagreement rate is
  documented and expected).

## P1.5: Shape Pair Coverage

Filled the previously empty cells in the shape-pair matrix:

- OBB now exposes predicates and measurements:
  `obbContainsPoint`, `obbClosestPoint(/Into)`, `obbGetAabb(/Into)`,
  `obbGetCorners(/Into)`.
- Sphere measurements: `sphereGetAabb(/Into)`, `sphereSurfaceArea`,
  `sphereVolume`.
- Plane vs shape: `planeIntersectsSphere`, `planeIntersectsAabb`.
- Ray vs OBB / Capsule: `rayObbHit(Distance)`, `rayIntersectsObb`,
  `rayCapsuleHit(Distance)`, `rayIntersectsCapsule`.
- Frustum vs OBB / Capsule: `frustumIntersectsObb`,
  `frustumIntersectsCapsule`.
- Validation: `validateRay`, `validateMat4` (finite + optional singular
  determinant), `validateObb` (extents non-negative, optional orthonormal
  rotation), `validateFrustum` (six plane validation).
- `CollisionWorld.updateBody(id, aabb)` plus `hasBody` / `bodyCount`
  conveniences. BVH is invalidated lazily; the next `updateBvh` rebuilds.

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
- WebAssembly/SIMD mat4 multiply kernel is still deferred.
  - Current `unsafeMat4MultiplyF32Many` is competitive with the scalar object
    loop and already beats the measured gl-matrix loop.
  - WASM only makes sense after a real workload shows repeated batches around
    N >= 512 where matrix multiply is the bottleneck.
  - `@exornea/mensura/wasm` now exists only as a feature-probe layer. Do not
    ship a binary kernel there without documented `WebAssembly.Memory`
    ownership, fallback behavior, generation steps, and checksum/provenance
    for the shipped binary.

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
