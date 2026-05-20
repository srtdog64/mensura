# Mensura

Mensura is a small spatial math and geometry kernel for TypeScript game and
editor runtimes.

It is intentionally lower-level than Geukbit. Mensura should not know about
scenes, entities, components, assets, inspectors, materials, or renderers.

## Scope

Mensura owns reusable math primitives:

- floating-point comparison and ULP helpers
- conversion loss functions for `number -> f32`
- vectors, quaternions, and matrices
- rays, planes, AABBs, spheres, and frustums
- intersection and overlap tests
- closest-point, bounds, and signed-distance measurements
- collision narrowphase (SAT, GJK, EPA, MPR, CCD) and acceleration structures
- WGSL layout metadata and checked DataView projection
- grid/world coordinate conversion
- transform compose/decompose helpers
- WebGPU viewport project/unproject helpers

## Coordinate And Memory Policy

Mensura uses a right-handed world coordinate system:

- `+X` is right
- `+Y` is up
- `-Z` is forward

Matrices use column-major storage and column-vector multiplication:

- points are transformed as `p' = M * p`
- transform composition is `M = T * R * S`
- model-view-projection is `MVP = P * V * M`

Projection helpers target WebGPU-style clip depth by default:

- NDC X: `-1..1`
- NDC Y: `-1..1`
- NDC Z: `0..1`

The public API uses immutable `number` objects by default. Hot-path APIs use
`Into` suffixes and write into caller-owned outputs. Packed GPU bridges use
`Float32Array`. Binary projection bridges use `DataView`.

Ray intersections only return hits with `distance >= 0`. AABB point containment
is inclusive. Grid cell ownership uses `Math.floor`.

See [Coordinate And Matrix Policy](docs/coordinate-matrix-conventions.md).

## Module Layout

```txt
@exornea/mensura           facade for the whole kernel
@exornea/mensura/core      float, vector, and matrix math
@exornea/mensura/geometry  shape primitives: rays, planes, bounds, spheres
@exornea/mensura/query     ray hits, overlap tests, frustum culling
@exornea/mensura/collision SAT, GJK, EPA, MPR, and CCD narrowphase
@exornea/mensura/accel     BVH and broadphase acceleration structures
@exornea/mensura/world     collision world orchestration
@exornea/mensura/layout    WGSL-compatible byte layout metadata
@exornea/mensura/data      checked DataView projection records
@exornea/mensura/measure   closest points, bounds, areas, barycentric data
@exornea/mensura/validation Result-first checks and reproducible seed helpers
@exornea/mensura/batch     object-array batch kernels for hot loops
@exornea/mensura/physics   compatibility facade for accel/collision/world
@exornea/mensura/gpu       WebGPU projection and packed Float32Array bridges
@exornea/mensura/unsafe    unchecked binary and typed-array projection helpers
@exornea/mensura/wasm      WebAssembly feature probes for optional kernels
```

For `0.1.x`, `core`, `geometry`, `query`, `measure`, `validation`, `gpu`,
`layout`, `data`, and `batch` are the stable release surface. `collision`,
`accel`, and `world` are experimental dogfood layers. `physics` is a
compatibility facade. `wasm` is an experimental feature-probe layer. `unsafe`
is explicitly unsafe and opt-in.

See [API Stability](docs/api-stability.md) for the release contract.
See [API Guide](docs/api-guide.md) for layer-by-layer usage notes.
See [Collision Layer](docs/collision.md) for SAT/GJK/EPA/MPR/CCD boundary
semantics.
See [Math Theory](docs/math-theory.md) for the formulas behind float32 loss,
empty-domain sentinels, RNG algorithms, sampling distributions, geometric
samplers, and bias diagnostics.

The root facade exports the primary layers. `physics` remains as a compatibility
facade for older imports, but new code should import `query`, `collision`,
`accel`, and `world` by responsibility. `measure` owns derived primitive
measurements and projections such as AABB closest points, capsule bounds,
triangle normals, areas, barycentric coordinates, and triangle closest points.
It also exposes `*Checked` variants for boundary callers that want invalid
measure domains surfaced as `Result` errors.
`validation` owns `Result`-first precondition checks for finite values,
non-empty bounds, non-degenerate triangles, stable float32 conversion loss, and
deterministic seed/RNG/distribution helpers for reproducible stress or benchmark
inputs.
`layout` describes byte-level records; `data` is the checked `Result`-first
bridge from semantic values into those records. `batch` keeps the inspectable
object policy while amortizing call overhead across many values.

> Rule of thumb: if the answer is yes/no, import from `query`. If the answer is
> a value (point, vector, distance, area), import from `measure`. Shape values
> themselves (constructors, mutable variants, copies) stay in `geometry`. If
> the question is whether a value is safe enough to measure or serialize, use
> `validation`.

`unsafe` is intentionally not re-exported by the root facade. Import it by name
when a caller owns the buffer layout, bounds checks, and aliasing contract.

## Collision Contract

`@exornea/mensura/collision` is still an experimental dogfood layer, but it is
not a collection of placeholders. Public collision entry points must either
implement their algorithm, return a documented `Result` failure, or stay out of
the public package.

- `testObbObbSat` is inclusive for touching OBB boundaries.
- `gjk` is a strict support-mapped intersection query. Exact touching reports
  `intersect: false` because the support advance is not strictly positive.
- `mprIntersect` runs Minkowski Portal Refinement directly for binary convex
  intersection. It requires `{ center, support }` per shape, returns
  `{ intersect, portalDirection, iterations }`, and uses the same strict
  boundary policy as `gjk`.
- `epa` is the penetration-depth recovery path after a real GJK 4-simplex.
- CCD helpers report first future contact events, with documented initial
  overlap behavior per shape family.

## Failure Model

Operations that can fail at the boundary return `Result<T>` data rather than
throwing. The shape is:

```ts
type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MensuraError };
```

Common error codes: `VALIDATION_INVALID_FORMAT` (bad perspective arguments),
`TRANSFORM_SINGULAR` (`det = 0` inversion), `TRANSFORM_DEGENERATE_BASIS`
(`lookAt` with `eye = center`, `quatFromUnitVectors` anti-parallel without a
stable axis), `GJK_MAX_ITERATIONS`, `EPA_MAX_ITERATIONS`, and
`MPR_MAX_ITERATIONS` for collision iteration budgets.

Use `unwrap(result)` for call sites that should fail fast, or `result.ok`
discrimination for callers that need to handle the error.

## Policy

Numerical thresholds and validation bounds are collected in `DEFAULT_POLICY`
so that decisions are visible as data, not magic constants. Individual
constants (`QUAT_SLERP_LINEAR_THRESHOLD`, `QUAT_PARALLEL_EPSILON`,
`PERSPECTIVE_MIN_FOV_Y_RADIANS`, `PERSPECTIVE_MAX_FOV_Y_RADIANS`,
`DEFAULT_FLOAT_TOLERANCE`) are also exported for direct reference.

## First API

```ts
import {
  distanceSq3,
  lossF32,
  nearlyEqualUlpsF32,
  ulpDiffF32,
  unwrap,
  vec3
} from "@exornea/mensura/core";
import {
  aabb,
  frustumFromMatrixWebGpu,
  ray,
} from "@exornea/mensura/geometry";
import { frustumIntersectsAabb, rayAabbHitDistance } from "@exornea/mensura/query";
import { mat4PerspectiveWebGpuRh } from "@exornea/mensura/gpu";

const a = vec3(0, 0, 0);
const b = vec3(1, 2, 3);
const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 16 / 9, 0.1, 100));
const frustum = frustumFromMatrixWebGpu(projection);
const bounds = aabb(vec3(-1, -1, -5), vec3(1, 1, -3));
const pickRay = ray(vec3(0, 0, 0), vec3(0, 0, -1));

console.log(distanceSq3(a, b));
console.log(ulpDiffF32(1, Math.fround(1 + Number.EPSILON)));
console.log(nearlyEqualUlpsF32(1, Math.fround(1), 0));
console.log(lossF32(1 + Number.EPSILON));
console.log(frustumIntersectsAabb(frustum, bounds));
console.log(rayAabbHitDistance(pickRay, bounds));
```

Worked examples (camera+frustum, TRS compose/decompose, quaternion operations,
Result-based error handling, and visual ray fixtures) live under
[examples/](examples/).

## Visual Ray Fixtures

Ray hit tests can be inspected without adding browser or graphics dependencies:

```sh
npm run visual:ray
```

This builds the package and runs
[examples/visual-ray-fixtures.mjs](examples/visual-ray-fixtures.mjs), writing
dependency-free SVG, 2D HTML, 3D Canvas HTML, and JSON manifest artifacts to
`.mensura-visual/`. The artifacts are for human review; Vitest keeps a
regression test that the rendered manifest values match the actual ray API
calculations.

The checked-in preview at
[examples/visual-ray-fixtures-3d-preview.png](examples/visual-ray-fixtures-3d-preview.png)
shows the intended 3D layout without running the generator.

## Performance Snapshot

Latest local benchmark snapshot:

```txt
Node: v22.17.0
Samples: 7 median after 2 warmups
Date: 2026-05-20
```

Selected release-gated results:

| Case | Mensura | Reference / baseline | Ratio |
|---|---:|---:|---:|
| `add3Into` | 108.7M ops/s | gl-matrix `vec3.add` 96.9M ops/s | 1.12x |
| `normalize3Into` | 93.5M ops/s | gl-matrix `vec3.normalize` 83.2M ops/s | 1.12x |
| `mat4MultiplyInto` | 44.1M ops/s | gl-matrix `mat4.multiply` 37.4M ops/s | 1.18x |
| `affinePoint3Into` | 98.1M ops/s | gl-matrix `vec3.transformMat4` 63.2M ops/s | 1.55x |
| `add3IntoMany` | 280.8M ops/s | gl-matrix loop 174.6M ops/s | 1.61x |
| `unsafeVec3AddF32Many` | 729.7M ops/s | scalar object loop 190.0M ops/s | 3.84x |
| `unsafeVec3DotF32Many` | 806.5M ops/s | `dot3IntoMany` 369.6M ops/s | 2.18x |
| `unsafeVec3CrossF32Many` | 524.4M ops/s | `cross3IntoMany` 272.2M ops/s | 1.93x |

`npm run benchmark` is the authoritative comparison harness used by
`benchmark:check`. A smaller focused local probe is also committed:

```sh
npm run build
node --experimental-strip-types perf-benchmark.ts
```

See [Performance](docs/performance.md) for the full table, interpretation, and
API selection guide.

## Release Gate

```sh
npm run check:release
```

This runs public-source stub checks, build, tests, `npm pack --dry-run`, and
the benchmark threshold gate. If a release-blocking hot path falls below its
relative performance floor, or if public `src/` code still describes itself as
unimplemented placeholder work, the command fails.

The release gate also runs DCO validation, the experimental-module build,
the API surface snapshot, the `dist/*.d.ts` symbol snapshot, the packaged
bundler-resolution smoke test, and a Vite browser bundle smoke test. Generated
experimental and smoke outputs live in ignored folders.

## Contributions

All contribution commits require a DCO sign-off:

```sh
git commit -s
```

Before opening a pull request, run:

```sh
npm run dco:check -- --range origin/master..HEAD
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [DCO.md](DCO.md).

## Non-Goals

- no renderer handles
- no scene graph
- no entity/component model
- no asset or material catalog
- no full physics engine, solver, integrator, or rigid-body runtime
- no editor UI state

Mensura should remain a geometry kernel that Geukbit, Zeno benchmarks, and other
game/editor packages can share.
