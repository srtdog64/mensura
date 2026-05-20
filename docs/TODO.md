# Mensura TODO

This file tracks remaining work after the v0.3 kernel pass. It should reflect
the current package shape, not the historical reference-reading checklist.

## Current Baseline

Already in place:

- `core`: float policy, conversion loss, vec3/vec4, mat3/mat4, quat, euler,
  dual-quat, WebGPU viewport project/unproject helpers, `Result`.
- `geometry`: ray, plane, AABB, sphere, OBB, capsule, frustum, triangle mesh,
  and pure spatial grid coordinate helpers.
- `query`: ray hit data, ray/plane/AABB/sphere/triangle tests, frustum tests,
  indexed AABB raycast/nearest-hit/overlap primitives.
- `measure`: closest points, bounds, triangle helpers, and signed distance
  helpers for AABB/sphere surfaces.
- `collision`: SAT, GJK, EPA, MPR, scalar CCD, and rich sweep hit wrappers
  with caller-owned `CollisionContext`.
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
  (`summarizeSamples`, `validateUniformBias`). Observation suitability gates
  sit here before measurement/analyzer/anchor/compare code paths.
- `batch`: object-array `*IntoMany` kernels.
- `gpu`: WebGPU projection and Float32Array bridge.
- `unsafe`: explicit packed Float32Array and DataView helpers.
- `wasm`: WebAssembly SIMD feature probing. Actual SIMD kernels remain
  deferred until a workload proves the JS unsafe kernel is the bottleneck.
- Verification gates: `npm run check`, `npm run benchmark`,
  `npm pack --dry-run`, `npm run check:contracts`, and
  `npm run check:release`.
- Human visual inspection: `npm run visual:ray` writes dependency-free ray hit
  SVG, 2D HTML, 3D Canvas HTML, and JSON manifest fixtures into ignored
  `.mensura-visual/` through `examples/visual-ray-fixtures.mjs`.
  `test/visual-ray-fixtures.test.ts` keeps the visual manifest values tied to
  the actual ray API calculations.
- Release hardening has started: golden fixtures, deterministic invariant
  replay tests, experimental-module build output (`dist-experimental/`,
  ignored), package export plus `dist/*.d.ts` symbol snapshot, packaged
  bundler-resolution smoke checks, Vite browser bundle smoke checks, and a
  longer deterministic edge-case corpus.

## P0: API Freeze Prep

- Maintain `docs/api-stability.md` as the source of truth for stable 0.3,
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
- GJK/MPR/EPA now accept only `SupportFunctionInto`, so support points write
  into `CollisionContext` scratch instead of allocating a fresh `Vec3` per
  support query. Allocating support-map adapters belong outside Mensura's
  collision core.
- GJK hot path no longer allocates per call: `CollisionContext` now owns the
  simplex pool, the initial direction, working direction, and support-map
  scratch. `GjkResult` exposes `simplex` and `simplexSize` as a view into the
  context (valid until the next GJK call). `epa(simplex, simplexSize, ...)`
  takes the explicit size so it never slices.
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
  `capsuleSegmentDistanceSqToPoint`, `capsuleGetAabb(Into)`,
  `capsuleCapsuleClosestPoints(Into)`, `capsuleCapsuleDistance`,
  `capsuleCapsuleSignedDistance`, `capsuleCapsuleContact(Into)`.
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

## P6: Professional Math Library Track

This is the long-term bar for turning Mensura from a compact spatial kernel
into a professional-grade math library. These items are not all required for a
0.3.x release, but they define what "world-class" would mean in this repo.

### API Breadth

- Keep the stable public core complete and boring:
  `vec2/3/4`, `mat3/4`, `quat`, euler, dual-quat, transform compose,
  transform decompose, inversion, look-at, projection, unprojection, and
  affine transform helpers.
- Keep shape primitives cohesive:
  ray, plane, AABB, OBB, sphere, capsule, triangle, triangle mesh, frustum,
  and support-mapped convex shape contracts.
- Expand value-returning geometry queries before expanding orchestration:
  closest point, distance, signed distance where meaningful, barycentric data,
  hit data, contact normal, penetration depth, and time of impact.
- Treat acceleration structures as their own layer:
  median BVH, SAH BVH, refit, traversal, broadphase pair generation, and
  stable query result ordering.
- Add new primitives only when the layer contract is clear:
  constructors in `geometry`, yes/no predicates in `query`, measurements in
  `measure`, boundary checks in `validation`, and orchestration in `world`.

### Numerical Stability

- Document epsilon policy for every algorithm family that needs tolerances.
  SAT and GJK now expose their hot-loop squared-length thresholds through
  `CollisionPolicy`; remaining families to tighten include ray/shape hits,
  EPA/MPR, CCD, and BVH bounds.
- Keep degenerate cases explicit:
  zero vectors, singular matrices, empty AABBs, degenerate triangles,
  invalid capsules, zero-radius spheres, parallel rays, and coplanar or
  touching collision cases.
- Prefer `Result` for boundary-facing operations that can fail; reserve raw
  sentinel behavior for documented hot-path primitives.
- Maintain deterministic seed APIs and named RNG streams for fuzz,
  stress-test, benchmark, and golden-data generation.
- Keep random distributions selectable because uniform, gaussian,
  triangular, boundary-heavy, and degenerate-biased inputs expose different
  numerical failure modes.
- Record the source or derivation for non-obvious numerical constants near the
  policy export or in `docs/math-theory.md`.

### Verification

- Keep `test/golden/api-surface.json` and generated `.d.ts` symbol snapshots
  as intentional public-surface gates.
- Add and preserve golden fixtures for representative numeric outputs:
  matrix projection, look-at, compose/decompose, quaternion interpolation,
  ray/shape hits, frustum extraction, BVH traversal, CCD, and collision
  contact data.
- Grow the deterministic edge-case corpus over time instead of replacing it.
  Failures should become named fixtures before the seed disappears.
- Keep fuzzer engines completely outside Mensura. Mensura may expose
  deterministic seeds, domain invariants, corpus files, and replay tests, but
  it must not import or depend on a project-specific fuzzer implementation
  from `F:\tex_bug` or any other workspace.
- Treat fuzz integration as an adapter boundary:
  - external fuzzer owns generation, shrinking, scheduling, and reporting;
  - Mensura owns only pure invariant functions and replayable fixtures;
  - no fuzzer runtime dependency belongs in package exports, release builds,
    or published tarballs.
- Add differential tests against reference implementations where the contract
  matches: gl-matrix for low-level vector/matrix kernels, wgpu-matrix for
  WebGPU projection policy, and three.js math for selected geometry queries.
- Add browser smoke coverage for real bundlers and runtimes:
  Vite, esbuild-style resolution, ESM package exports, and WebGPU-adjacent
  Float32Array/DataView upload paths.
- Keep stress tests separate from fast unit tests, but make them easy to run
  before release.

### Performance

- Maintain the three-tier performance model:
  inspectable object API for ergonomics, `Into` APIs for allocation-free hot
  paths, and `batch` / `unsafe` APIs for high-throughput loops.
- Keep benchmark gates tied to measured reference baselines, not intuition.
  When a threshold changes, record the reason in `docs/performance.md`.
- Track long-running benchmark history so regressions can be separated from
  host noise and V8 version changes.
- Add benchmark cases for geometry and collision hot paths:
  ray/AABB, ray/triangle, frustum/AABB, BVH traversal, broadphase pair
  generation, GJK/MPR, EPA, and CCD.
- Keep Geukbit dogfood regressions in perspective: a ~4-5% movement in a
  `distanceSq3`-mediated visibility candidate loop is not automatically a
  Mensura release blocker. Treat it as host/V8 noise unless a repeated Geukbit
  witness shows sustained regression above the benchmark budget.
- Preserve the safe/hot split:
  - public boundary APIs may validate finite values, empty domains, and
    `Result` contracts;
  - frame hot loops should use raw `core`/`query`/`measure` functions,
    `Into`, caller-owned buffers, and existing `raycastManyAabbInto` /
    `overlapManyAabbInto`;
  - only add new batch or typed-array APIs when a Geukbit benchmark identifies
    the hot loop and the new API has its own Mensura witness.
- Candidate future hot APIs, gated by Geukbit evidence rather than intuition:
  - `distanceSq3IntoMany` or packed `unsafeVec3DistanceSqF32Many` for large
    visibility/selection candidate sets;
  - `selectNearestAabbHitInto` only if `nearestRayAabbHitInto` is not enough
    for Geukbit's semantic mapping;
  - projection-specific packed visibility filters if scene snapshot rebuild is
    no longer the dominant cost.
- Do not add WASM SIMD kernels until a real workload proves that JS unsafe
  kernels are the bottleneck. If WASM ships, require documented memory
  ownership, fallback behavior, generation steps, checksum/provenance, and
  benchmark evidence.

### Robust Geometry And Collision

- Promote collision from experimental only after contact data and failure
  contracts are covered by tests, fuzz, and docs.
- Keep support-mapped collision ownership explicit. New support-map APIs should
  use `SupportFunctionInto`. Returning `Vec3` from a support function may exist
  inside a host-local adapter, but it must not become a second public Mensura
  collision contract.
- Add stronger CCD coverage:
  swept sphere/sphere, swept sphere/AABB, swept capsule, conservative
  advancement where appropriate, initial-overlap policy, and grazing-contact
  witnesses.
- Add MPR contact recovery if `mprIntersect` becomes more than a binary query:
  contact normal, penetration estimate, witness points, and iteration failure
  semantics.
- Add broadphase quality checks:
  duplicate pair suppression, stable ordering, no self-pairs, disabled body
  filtering, and deterministic output under repeated updates.
- Add BVH quality checks:
  SAH split correctness, median fallback behavior, empty input,
  degenerate bounds, traversal ordering, and refit-vs-rebuild semantics.

### Release And Trust

- Keep `npm run check:release` as the single release gate.
- Keep public source free of stubs, placeholders, and misleading TODO exports.
- Keep package contents audited with `npm pack --dry-run`.
- Keep DCO mandatory for all commits that enter the release branch.
- Keep README claims tied to current code, current docs, and current benchmark
  output.
- Treat semver as part of the API contract:
  no breaking stable-surface changes in patch releases, and no silent behavior
  changes without docs and migration notes.
- Prefer small, explicit layers over broad helper bags. New advanced features
  should land behind a named layer or subpath when they change the package's
  conceptual surface.

## Package Boundary

Mensura must not depend on Geukbit, Three.js, React, Zeno, Insere, Ordo, or any
host engine. Those packages may consume Mensura, but Mensura remains the
lower-level spatial math and geometry kernel.
