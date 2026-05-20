# API Stability

Mensura is in the `0.3.x` pre-1.0 line. This document defines which entry
points are intended to stay stable during the current package line and which
ones are still allowed to change.

## Release Label

Current package line: `0.3.x`.

The package is useful for integration and dogfooding, but it is still pre-`1.0`.
Breaking changes are allowed before `1.0`, but they should be deliberate,
documented, and backed by tests.

## Stable 0.3 Surface

These layers are the primary public surface for `0.3.x`:

| Subpath | Status | Notes |
|---|---|---|
| `@exornea/mensura/core` | Stable 0.3 | Float policy, `Result`, vec3/vec4, mat3/mat4, quat, euler, dual-quat. |
| `@exornea/mensura/geometry` | Stable 0.3 | Shape construction and primitive geometry values. |
| `@exornea/mensura/query` | Stable 0.3 | Ray hits, overlap tests, and frustum culling helpers. |
| `@exornea/mensura/measure` | Stable 0.3 | Derived primitive measurements and projections such as AABB closest point, capsule bounds, triangle area, normal, barycentric coordinates, closest point, and `Result`-first `*Checked` measurement wrappers. |
| `@exornea/mensura/validation` | Stable 0.3 | `Result`-first finite, range, float32-stability, non-empty, non-degenerate, reproducibility seed/RNG/distribution checks, bias diagnostics, and observation suitability gates before measurement/comparison. |
| `@exornea/mensura/gpu` | Stable 0.3 | WebGPU projection helpers and checked Float32Array bridges. |
| `@exornea/mensura/layout` | Stable 0.3 | WGSL-compatible layout constants and byte offsets. |
| `@exornea/mensura/data` | Stable 0.3 | Checked `Result`-first DataView projection layer. |
| `@exornea/mensura/batch` | Stable 0.3 | Object-array `*IntoMany` kernels that preserve inspectable value shapes. |

The root facade re-exports the main stable 0.3 layers for convenience. New
code that wants narrow ownership should import from the layer-specific subpath.

## Experimental Surface

These layers are public enough to dogfood, but not yet stable enough to freeze:

| Subpath | Status | Reason |
|---|---|---|
| `@exornea/mensura/collision` | Experimental | SAT/GJK/EPA/MPR/CCD witnesses are in place for common overlap, separation, touching-boundary, iteration-budget, and penetration-recovery cases. `CollisionContext` owns scratch plus numeric policy, support-mapped hot paths use `SupportFunctionInto`, `testObbObbSatTrace` is the explicit diagnostic path, and `GjkResult` exposes `simplex` and `simplexSize` as a context-owned view. Remaining: broader randomized convex support-map coverage and MPR penetration/contact recovery. |
| `@exornea/mensura/accel` | Experimental | BVH behavior is tested, but builder policy and traversal result contracts may still change. |
| `@exornea/mensura/world` | Experimental | Useful orchestration layer, but body lifecycle and broadphase ownership are not finalized. |
| `@exornea/mensura/physics` | Legacy compatibility | Re-export facade for older imports. Do not add new primary APIs here; new code should import `query`, `collision`, `accel`, or `world` by responsibility. |
| `@exornea/mensura/wasm` | Experimental | Feature-probe layer for WebAssembly SIMD. No binary kernel is shipped until memory ownership, fallback behavior, generation steps, and provenance are documented. |

Experimental APIs should remain tested, but callers should expect naming,
result-shape, and policy changes before a stable release.

Layer entry points are canonical without `/index`. For example, use
`@exornea/mensura/collision`, not `@exornea/mensura/collision/index`; the
package export map blocks those duplicate names so one layer has one public
import spelling.

## Contract Gates

API drift is checked from the built package, not from source intent:

- `test/golden/api-surface.json` pins package exports and generated
  `dist/*.d.ts` symbols.
- `npm run api:snapshot` fails when a public subpath or declaration symbol
  changes without an intentional snapshot update.
- `packages/bundler-smoke` checks package-style imports under TypeScript's
  `moduleResolution: "Bundler"`.
- `packages/browser-smoke` runs a Vite production browser bundle against the
  built `dist` files and writes only to ignored `.mensura-smoke/` output.
- `npm run release:stub-check` scans public `src/` TypeScript for
  release-blocking stub markers. Public code must implement the advertised
  behavior, return a documented `Result` failure, or move under
  `src/experimental`.

When a public API change is intentional, update docs and then run
`npm run api:snapshot:write` in the same patch.

## Unsafe Surface

`@exornea/mensura/unsafe` is explicitly unsafe and is intentionally not part of
the root facade.

Unsafe APIs may skip validation, bounds checks, allocation safety, and aliasing
guards. A caller using this layer owns:

- buffer length and offset correctness.
- packed `Float32Array` stride and layout.
- `DataView` byte alignment.
- aliasing behavior unless a function documents alias safety.
- `SharedArrayBuffer` publication and `Atomics` protocol.

Unsafe function names must start with `unsafe`. Packed batch kernels use the
`unsafe*F32Many` naming pattern.

## Stability Rules

- `Into` means a single caller-owned output value.
- `IntoMany` means an object-array batch kernel.
- `unsafe*F32Many` means a packed `Float32Array` batch kernel.
- Fallible boundary APIs should return `Result<T>` instead of throwing.
- Root exports should stay conservative. Prefer adding new experimental work
  under a named layer before promoting it to the root facade.
- WebAssembly is deferred. If revived, it must land under an explicit `wasm` or
  `unsafe/wasm` layer with documented `WebAssembly.Memory` ownership,
  fallback behavior, generation steps, and binary provenance.

## Promotion Criteria

An experimental API can move to the stable surface when it has:

- deterministic unit tests for common cases and edge cases.
- at least one stress or witness test matching a realistic workload.
- documented failure semantics.
- no hidden module-level scratch state in hot paths.
- benchmark coverage if the API exists primarily for performance.
- no public implementation text marking the API as a stub, placeholder, or
  intentionally unimplemented path.
