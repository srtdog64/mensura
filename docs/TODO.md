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
- `batch`: object-array `*IntoMany` kernels.
- `gpu`: WebGPU projection and Float32Array bridge.
- `unsafe`: explicit packed Float32Array and DataView helpers.
- Verification gates: `npm run check`, `npm run benchmark`,
  `npm pack --dry-run`.

## P0: API Freeze Prep

- Review root facade exports and decide which subpaths are stable for v0.1:
  `core`, `geometry`, `query`, `gpu`, `layout`, `data`, `batch`, `unsafe`.
- Keep `physics` as a compatibility facade only. Do not add new primary APIs
  there.
- Decide whether `collision`, `accel`, and `world` are experimental or v0.1
  public. If experimental, document that clearly in README.
- Add a short `docs/api-stability.md` with stable, experimental, and unsafe
  surfaces.
- Make naming consistent:
  - `Into` means caller-owned single output.
  - `IntoMany` means object-array batch.
  - `unsafe*F32Many` means packed Float32Array batch.

## P1: Collision Witnesses

Collision is the least mature public area. Before calling it public-ready:

- SAT:
  - rotated OBB vs OBB overlap.
  - separated rotated OBBs.
  - touching boundary case.
  - near-parallel axes case.
- GJK:
  - sphere-like support hit and miss are covered; add box support hit/miss.
  - containment case.
  - touching case.
  - max-iteration failure witness with a deliberately bad support function.
- EPA:
  - degenerate simplex is covered.
  - add a simple successful penetration-depth witness.
  - add a non-converging/max-iteration witness if deterministic.

## P2: Geometry Breadth

- Add `aabbEmpty()` and `aabbIsEmpty()`.
- Add `aabbGetBoundingSphere` / `aabbGetBoundingSphereInto`.
- Add triangle primitive helpers:
  - normal.
  - area.
  - closest point.
  - barycentric coordinate helper.
- Add capsule query coverage:
  - capsule contains point.
  - capsule intersects sphere.
  - capsule AABB bounds.
- Add frustum extraction variants only when needed:
  - explicit WebGPU forward-Z is current default.
  - reverse-Z and OpenGL variants should be named, not inferred.

## P3: Batch And Unsafe Coverage

- Keep object batch and unsafe packed kernels semantically paired where useful.
- Do not add unsafe kernels without tests that cover:
  - count-limited writes.
  - aliasing contract.
  - packed layout stride.
  - at least one realistic numeric case.
- Current useful additions to consider:
  - `unsafeVec3MinF32Many` / `unsafeVec3MaxF32Many`.
  - `unsafeAabbExpandByPointF32Many`.
  - `unsafeMat4ComposeTrsF32Many` only if measured useful.
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
- Add an example that uses `SharedArrayBuffer` plus caller-owned `Atomics`
  publication.
- Document that Mensura never owns worker pools or scheduling.

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
