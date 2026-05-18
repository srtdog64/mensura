# Mensura TODO

## P0: Floating-Point Foundation

Mensura starts with floating-point correctness because every later geometry
primitive depends on stable tolerance rules.

- Define the default float policy:
  - `f32` vs JavaScript `number` behavior
  - absolute tolerance
  - relative tolerance
  - max ULP tolerance
- Track conversion loss as first-class data:
  - rounded value
  - exact/lossy flag
  - absolute error
  - relative error
  - local epsilon
  - error measured in local epsilon/ULPs
- Implement and test ULP helpers:
  - `float32ToOrderedUint32`
  - `ulpDiffF32`
  - `nearlyEqualUlpsF32`
  - `nextUpF32`
  - `nextDownF32`
  - `epsilonF32At`
  - `conversionLossF32`
- Document when to use:
  - exact equality
  - absolute/relative tolerance
  - ULP tolerance
  - conversion loss function
- Add edge-case tests:
  - `+0` and `-0`
  - `NaN`
  - `Infinity`
  - subnormal values
  - adjacent representable `f32` values

## P1: Vector And Transform Core

- `Vec2`
- `Vec3`
- `Quat`
- `Mat4`
- document coordinate convention:
  - right-handed
  - Y-up
  - `-Z` forward
  - column-vector math
  - column-major storage/export
  - WebGPU/DirectX-style clip depth `0..1`
  - floor-based `worldToGrid`
  - inclusive AABB boundary
- transform compose/decompose
- dot/cross/normalize/length/distance
- allocation-free variants for hot paths

### P1 borrowings (see `reference-library-notes.md` §1, §2)

- `mat4Invert` / `mat4InvertInto`: detect `det == 0` and return
  `Result<MutableMat4, AppError>`; reuse the cofactor expansion from
  `Matrix4.js:712` and gl-matrix `mat4.js:293`.
- `mat4LookAtRh` / `mat4LookAtRhInto`: detect `eye ≈ center` and `up ∥ z` from
  gl-matrix `mat4.js:1740` / `Matrix4.js:483`; report the degenerate basis as
  `Result.error`, not by perturbing the basis.
- `mat4PerspectiveReverseZWebGpuRh` / `…Into` as a sibling to the existing
  WebGPU perspective (do **not** branch inside `mat4PerspectiveWebGpuRh`); copy
  the signature shape from `mat4-impl.ts:840` but keep Mensura's argument
  validator (`assertPerspectiveArgs`).
- `quatSlerp` / `…Into`: lerp fallback when `cosHalfTheta > 0.9995`, threshold
  exported as `QUAT_SLERP_LINEAR_THRESHOLD` (`Quaternion.js:719`).
- `quatFromRotationMatrix`: port the four trace branches from
  `Quaternion.js:405` verbatim — numerical stability matters here.
- `quatFromUnitVectors`: parallel / anti-parallel split with `ε = 1e-8`
  (`Quaternion.js:471`); anti-parallel case with no stable orthogonal axis
  returns `Result.error`.
- `mat4Compose` / `mat4Decompose` (`Matrix4.js:1004`, `:1053`): port including
  the `det < 0 → flip scale.x` trick used in decompose.
- Follow-up policy: migrate `assertPerspectiveArgs` (currently `throw`) to
  `Result` (CLAUDE.md Result-First policy). Not in this batch.

## P2: Geometry Primitives

- `Ray`
- `Plane`
- `AABB`
- `Sphere`
- `Frustum`
- `Bounds`

### P2 borrowings (see `reference-library-notes.md` §1, §2.3)

- `aabbEmpty()`: seed `min = +Infinity`, `max = -Infinity` so `expandByPoint`
  always converges (`Box3.js:189`).
- `aabbExpandByPoint` / `aabbExpandByPointInto`: per-component min/max
  (`Box3.js:243`).
- `aabbGetBoundingSphere` / `…Into`: empty AABB → empty sphere contract
  (`Box3.js:606`).
- `planeNormalizeInto`: already in `src/plane.ts` and matches `Plane.js:143`
  (constant scaled with the normal). Verification only; no change.
- `frustumFromProjectionMatrixWebGpuRh` / `…WebGpuRhReverseZ` /
  `…OpenGlRh` — six-plane extraction (`Frustum.js:95`). The
  Mensura default (no NDC suffix) targets WebGPU `0..1`; the OpenGL form is
  exposed by an explicitly named helper.

## P3: Intersection And Culling

- ray-plane intersection
- ray-AABB intersection
- ray-sphere intersection
- AABB/AABB overlap
- sphere/AABB overlap
- frustum-AABB test
- frustum-sphere test

### P3 borrowings (see `reference-library-notes.md` §1, §2.3)

- `rayIntersectPlane` / `…Into`: denominator sign check + `t >= 0` filter
  (`Ray.js:397`). The `t >= 0` policy is already documented in
  `coordinate-matrix-conventions.md`.
- `rayIntersectAabb` / `…Into`: slab method with cached `invdir` and an
  `isNaN` guard for axis-aligned rays (`Ray.js:451`).
- `rayIntersectSphere` / `…Into`: geometric `tca / d² / thc` form, sqrt only on
  the accept path (`Ray.js:311`).
- `rayIntersectTriangle` / `…Into`: Möller-Trumbore as in `Ray.js:540`.
  The `backfaceCulling` flag is deferred — Mensura returns hit data; the
  consumer decides whether to ignore backfaces.
- `frustumIntersectsSphere` / `frustumIntersectsAabb` (`Frustum.js:193`,
  `:221`): "negative distance on any plane → outside" loops.

### P3 regression tests

- WebGPU perspective contract: assert
  `mat4TransformPoint3(mat4PerspectiveWebGpuRh(...), (0, 0, -near)) ≈ (0, 0, 0)`
  and `(0, 0, -far) → (0, 0, 1)` (mirrors `wgpu-matrix/test/tests/mat4-test.js:465`).
- Same contract for `mat4PerspectiveReverseZWebGpuRh`, with the depth ends
  swapped.
- `(0, 0, -far) → (0, 0, 1)` test must also pass when `far = Infinity`, since
  Mensura's perspective already has the infinite-far branch.

## P4: Grid And World Coordinates

- grid-to-world conversion
- world-to-grid conversion
- cell bounds
- plane chunk coordinates
- integer-safe cell key helpers

## P5: Geukbit Dogfood Targets

- viewport picking
- camera frustum guide
- light range guide
- transform gizmo placement
- grid placement
- terrain tile/world conversion
- prefab bounds
- selection bounds
- visibility culling

## Package Boundary

Mensura must not depend on Geukbit, Three.js, React, Zeno, Insere, or Ordo.
Those packages may consume Mensura, but Mensura remains the lower-level spatial
kernel.
