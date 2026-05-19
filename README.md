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
- collision narrowphase and acceleration structures
- WGSL layout metadata and checked DataView projection
- grid/world coordinate conversion
- transform compose/decompose helpers

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
@exornea/mensura/collision SAT, GJK, and EPA narrowphase
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
```

For `0.1.x`, `core`, `geometry`, `query`, `measure`, `validation`, `gpu`,
`layout`, `data`, and `batch` are the stable release surface. `collision`,
`accel`, and `world` are experimental dogfood layers. `physics` is a
compatibility facade. `unsafe` is explicitly unsafe and opt-in.

See [API Stability](docs/api-stability.md) for the release contract.
See [API Guide](docs/api-guide.md) for layer-by-layer usage notes.

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
stable axis).

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
Result-based error handling) live under [examples/](examples/).

## Release Gate

```sh
npm run check:release
```

This runs build, tests, `npm pack --dry-run`, and the benchmark threshold gate.
If a release-blocking hot path falls below its relative performance floor, the
command fails.

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
