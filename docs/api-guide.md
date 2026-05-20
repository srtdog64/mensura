# API Guide

A folder-by-folder, file-by-file feel for each function. Source files carry
the authoritative type signatures; this document is the **intent index** —
"what is this function for, and when do I reach for it?"

> 폴더별 / 파일별 / 함수별 감각 인덱스. 정식 타입은 소스를 보면 되고, 이 문서는
> "어떤 의도로 부르는 함수인지" 잡아주는 용도.

## Big Picture

```
core ─── geometry ─┬── query                       (yes/no)
                   ├── measure                     (value, hot path)
                   ├── measure/checked ── validation (value, Result-first)
                   └── (the value itself: ctor / mutable / copy)

core ─── batch    (N object arrays)
core ─── unsafe   (N Float32Array, no validation)

collision / accel / world → caller-owned context, zero hot-path alloc
gpu / layout / data        → GPU / binary boundary
```

The import path encodes the caller's intent. Yes/no goes to `query`; a value
goes to `measure`; a value with observable failure goes to `measure/checked`
(which builds on the `validation` layer); the shape value itself (ctor,
mutable, copy) stays in `geometry`.

> Import 경로가 의도를 드러낸다. boolean이면 `query`, 값이면 `measure`,
> 실패를 데이터로 받아야 하면 `measure/checked` (안에서 `validation` 사용),
> 도형 그 자체면 `geometry`.

---

## `@exornea/mensura/core` — numbers, vectors, matrices

The math primitives. Every function is **single-call**. For N-element hot
loops use `@exornea/mensura/batch` (object arrays) or
`@exornea/mensura/unsafe` (packed `Float32Array`).

> 수학 원시값. 한 번 호출 단위. N개 핫루프는 `batch` (객체) 또는 `unsafe`
> (packed Float32).

### `float.ts` — floating-point comparison and loss

- `nearlyEqualAbsRel(a, b, tol?)` — absolute + relative tolerance. Default
  comparison.
- `ulpDiffF32(a, b)` / `nearlyEqualUlpsF32(a, b, maxUlps)` — distance in
  float32 bits. Use when "1 ULP apart" is the relevant question.
- `float32ToBits` / `bitsToFloat32` / `float32ToOrderedUint32` — float32 bit
  pattern round-trip. Debugging and ordered comparison.
- `epsilonF32At(value)` / `nextUpF32(value)` / `nextDownF32(value)` — next
  representable float32 around `value`. Pick comparison thresholds against
  these, not raw constants.
- `conversionLossF32(value)` (alias `lossF32`) — data form of the loss when
  coercing `number → f32`: `{ absolute, relative, epsilonAt, ulps }`. No
  equivalent in gl-matrix / wgpu-matrix / three.js.
- `DEFAULT_FLOAT_TOLERANCE` — frozen default tolerance object.

> 손실을 **데이터로 표현**하는 게 핵심. `lossF32`는 외부 3사에 동등 기능 없음.

### `policy.ts` — numerical thresholds as data

- `QUAT_SLERP_LINEAR_THRESHOLD = 0.9995` — slerp falls back to lerp+normalize
  above this `|dot|`.
- `QUAT_PARALLEL_EPSILON = 1e-8` — parallel / anti-parallel cutoff in
  `quatFromUnitVectors`.
- `PERSPECTIVE_MIN/MAX_FOV_Y_RADIANS` — fov validation range.
- `DEFAULT_POLICY` — every constant above as one frozen object.

> 정책은 한 객체로 모이고 분기에 박지 않는다.

### `result.ts` — failure as data, not exceptions

- `Result<T>` / `MensuraError` — boundary failures live as data. Throws are
  reserved for unrecoverable boot/init.
- `ok(value)` / `err(error)` / `mensuraError({code, stage, message, ...})` —
  constructors.
- `andThen(r, f)` / `mapErr(r, f)` — chain combinators.
- `unwrap(r, hint?)` — assertion-style; throws on failure. Reserve for
  test / CI fail-fast.

Typed error policy:

- `MensuraError.code` and `MensuraError.stage` are literal unions
  (`MensuraErrorCode`, `MensuraErrorStage`), not unconstrained raw strings.
- Prefer `isOk`, `isErr`, `matchResult`, and `unwrapOr` when failures should
  stay as data. `unwrap` intentionally throws and belongs at tests, examples,
  CLI, or CI fail-fast boundaries, not inside library hot paths.

> 모든 boundary 실패는 `Result.error`. throw는 boot/init 외 회피.

### `vec3.ts` — 3D vectors

Plain `{x, y, z}` so values are inspectable. Hot paths take an `Into`
output. Aliasing is safe (`fooInto(a, b, a)` works).

`readonly Vec3` and `MutableVec3` are TypeScript contracts, not runtime
immutability. They help call sites express intent, but both are plain JavaScript
objects at runtime. Do not treat `readonly` as a security boundary. Use
validation, cloning, or debug-only freezing at API boundaries when mutation
must be detected; keep the hot math path unfrozen.

- ctor / constants: `vec3`, `mutableVec3`, `set3`, `copy3`/`copy3Into`,
  `VEC3_ZERO/ONE/UP/FORWARD/RIGHT`.
- arithmetic: `add3`/`Into`, `sub3`/`Into`, `scale3`/`Into`,
  `scaleAndAdd3`/`Into` (axpy — ideal for `pos + vel*dt`).
- dot / cross: `dot3`, `cross3`/`Into`.
- length / distance: `length3`, `lengthSq3`, `distance3`, `distanceSq3`. The
  `*Sq` variants skip the sqrt — use them for ordering, not display.
- normalize: `normalize3`/`Into` (zero stays zero).
- componentwise: `min3`, `max3`, `clamp3` and their `Into` variants.

> 객체 형태로 inspect 가능, `Into`로 hot-path alloc 0, aliasing 안전.

### `vec4.ts` — 4D vectors / homogeneous coordinates

Mirror of `vec3` for 4 components. Backing storage for quaternions and clip-
space points.

### `mat3.ts` — 3x3 rotations / scales

Column-major, `mat3[col * 3 + row]`. Used by `Obb.rotation` and for the
upper-left of a `mat4`.

- ctor: `mat3`, `mat3Identity`/`Into`, `mat3Copy`/`Into`, `MAT3_IDENTITY`.
- compose: `mat3Multiply`/`Into`.
- apply: `mat3TransformPoint3`/`Into` (rotation + uniform scale only — no
  translation).

### `mat4.ts` — 4x4 transforms / projection

Column-major, column-vector multiplication: `p' = M * p`. Index helper:
`mat4Index(row, col) = col * 4 + row`.

- ctor / constants: `mat4`, `mat4Identity`/`Into`, `mat4Copy`/`Into`,
  `MAT4_IDENTITY`.
- TRS builders: `mat4Translation`/`Into`, `mat4Scaling`/`Into`. Rotation
  comes from `quat` or via `mat4Compose`.
- compose: `mat4Multiply`/`Into`. Force `Into` in hot loops.
- apply:
  - `mat4TransformPoint3`/`Into` — non-trivial bottom row (projection,
    MVP). Performs the w-divide.
  - `mat4TransformAffinePoint3`/`Into` — trusts the bottom row is
    `[0, 0, 0, 1]`. Faster; model and view path.
  - `mat4TransformDirection3`/`Into` — upper-left 3x3 only.
- inversion: `mat4Determinant`, `mat4Invert`/`Into` returning
  `Result<MutableMat4>`. `det = 0` returns `TRANSFORM_SINGULAR`.
- camera: `mat4LookAtRh`/`Into` returning `Result<MutableMat4>`. `eye ≈
  center` or `up ∥ z` returns `TRANSFORM_DEGENERATE_BASIS`.
- TRS round-trip: `mat4Compose(t, r, s, /Into)`,
  `mat4Decompose(/Into) → Mat4DecomposedTrs`. `det < 0` matrices encode the
  reflection by flipping `scale.x`.

- viewport mapping:
  - `mat4ProjectPoint3WebGpu`/`Into` maps world/view points through a
    world-view-projection matrix into top-down viewport pixel coordinates.
    Output `z` is WebGPU clip depth `0..1`.
  - `mat4UnprojectPoint3WebGpu`/`Into` maps viewport pixel coordinates plus
    WebGPU clip depth back through a caller-provided inverse
    world-view-projection matrix. Invalid viewport rectangles return
    `VALIDATION_INVALID_FORMAT`.

Projection matrices live in `@exornea/mensura/gpu`
(`mat4PerspectiveWebGpuRh`).

> 실패 가능 호출만 `Result`. 산술은 그대로 반환.

### `quat.ts` — unit quaternions

Stored as `vec4`. Hamilton product convention.

- ctor / constants: `quat`, `mutableQuat`, `quatIdentity`/`Into`,
  `quatCopy`/`Into`, `QUAT_IDENTITY`.
- compose / invert: `quatMultiply`/`Into`, `quatInvert`/`Into`,
  `quatConjugate`/`Into` (same as invert when unit).
- normalize: `quatNormalize`/`Into`.
- interpolate: `quatSlerp`/`Into` — lerp + normalize fallback above
  `QUAT_SLERP_LINEAR_THRESHOLD`.
- bridges:
  - `quatFromRotationMatrix3`/`Into` — trace 4-way split for numerical
    stability.
  - `quatFromUnitVectors(from, to, /Into) → Result<MutableQuat>` — parallel /
    anti-parallel branches; returns `TRANSFORM_DEGENERATE_BASIS` when no
    stable axis exists.

### `euler.ts` — Euler angles (compat / debug)

`euler`, `mutableEuler`, `eulerFromQuat`/`Into`. Six orders. Use `quat` for
real composition; Euler is for external data interop and visual inspection.

### `dual-quat.ts` — dual quaternions

`dualQuat`, `mutableDualQuat`, `dualQuatMultiply`/`Into`,
`dualQuatFromTranslationRotation`/`Into`. Skinning and rotation+translation
interpolation. Use `mat4Compose` for ordinary transform stacks.

---

## `@exornea/mensura/geometry` — shape values

The **shape values themselves**: constructors, mutable variants, copies, and
operations that mutate or inspect the shape directly. Predicates and
measurements are exposed by neighbour layers.

Each shape follows the same pattern: `Foo` / `MutableFoo` interfaces,
`foo(...)` immutable ctor, `mutableFoo(...)` with optional args,
`copyFoo` / `copyFooInto`.

> 도형 값 자체 (생성/변경/복사). 술어와 측정은 옆 레이어로.

### `aabb.ts`

- ctor: `aabb(min, max)`, `mutableAabb(min?, max?)` (defaults to empty).
- empty form: `aabbEmpty()`, `aabbEmptyInto(out)` — `min = +Infinity`,
  `max = -Infinity`. Pair with `aabbExpandByPointInto`.
- empty check: `aabbIsEmpty(box)` — true if any component has `min > max`.
- predicates: `aabbContainsPoint`, `aabbIntersectsAabb` — boundary
  inclusive. Re-exported from `query`.
- mutation / measurement: `aabbExpandByPoint`/`Into` (stays here because it
  mutates the shape), `aabbClosestPoint`/`Into`, `aabbDistanceSqToPoint`,
  `aabbSignedDistanceToPoint`
  (re-exported by `measure`). **`aabbDistanceSqToPoint` returns `+Infinity`
  for an empty AABB** (`dist(p, ∅) = +∞` by convention); `aabbClosestPoint`
  has no defined value for an empty input — reach for `measure/checked` to
  surface the failure as a `Result`.
- derived sphere: `aabbGetBoundingSphere`/`Into` — empty box returns
  `radius = -1` (empty-sphere sentinel).

> empty 시맨틱: AABB는 `±Infinity`, sphere는 `radius < 0`. 두 도메인이 같은
> 신호로 통일.

### `sphere.ts`

- ctor: `sphere(c, r)`, `mutableSphere(c?, r?)`.
- predicates: `sphereContainsPoint`, `sphereIntersectsSphere`,
  `sphereIntersectsAabb`. All guard `radius < 0` → `false` (empty sphere
  overlaps nothing).
- measurements: `sphereGetAabb(/Into)` (empty sphere → empty AABB),
  `sphereSignedDistanceToPoint`, `sphereSurfaceArea`, `sphereVolume`.
  Re-exported by `measure`.

### `plane.ts`

- ctor: `plane(normal, constant)`, `mutablePlane(...)`,
  `planeFromComponents(x, y, z, c, /Into)` (auto-normalizes).
- measurement: `planeNormalize`/`Into` (scales normal and constant
  together), `planeDistanceToPoint(plane, p)`.
- intersect: `planeIntersectsSphere`, `planeIntersectsAabb`
  (projected-extent vs signed distance test). Re-exported by `query`.

### `ray.ts`

- ctor: `ray(origin, direction)`.
- evaluate: `rayAt`/`Into`.
- per-shape hits (only `t >= 0` is reported):
  - `rayPlaneHit` / `rayPlaneHitDistance` / `rayIntersectsPlane`
  - `rayAabbHit` / `rayAabbHitDistance` / `rayIntersectsAabb` — slab +
    invdir.
  - `raySphereHit` / `raySphereHitDistance` / `rayIntersectsSphere` —
    negative radius misses.
  - `rayTriangleHit` / `rayTriangleHitDistance` — Möller–Trumbore with a
    `frontFace` flag.
  - `rayObbHit` / `rayObbHitDistance` / `rayIntersectsObb` — transform ray
    into OBB local frame, run slab test against `[-extents, +extents]`.
  - `rayCapsuleHit` / `rayCapsuleHitDistance` / `rayIntersectsCapsule` —
    infinite-cylinder intersection clipped to segment extent, plus
    hemispherical end caps; collapses to a sphere when the segment is
    degenerate.

`*Hit` variants return data or `null`; `*Intersects*` returns boolean only.


### `obb.ts`

- ctor / copy: `obb(center, extents, rotation)`, `mutableObb(...)`,
  `copyObb`/`Into`.
- predicate: `obbContainsPoint` — transform point into local frame and
  compare `|local|` to `extents`. Re-exported by `query`.
- measurements: `obbClosestPoint`/`Into` (clamp in local frame, transform
  back), `obbGetAabb`/`Into` (world AABB via projected half-extents),
  `obbGetCorners`/`Into` (8 corners, sign order
  `(-x,-y,-z), (+x,-y,-z), …`). Re-exported by `measure`.
- OBB-OBB overlap is in `@exornea/mensura/collision` (`testObbObbSat`).

### `capsule.ts`

- ctor / copy: `capsule(p0, p1, r)`, `mutableCapsule(...)`,
  `copyCapsule`/`Into`.
- measurement: `capsuleSegmentDistanceSqToPoint(c, p)` — re-exported by
  `measure`.
- predicates: `capsuleContainsPoint`, `capsuleIntersectsSphere` — guarded
  on `radius < 0`. Re-exported by `query`.
- bounds: `capsuleGetAabb`/`Into` — re-exported by `measure`.
- capsule pair measurements:
  `capsuleCapsuleClosestPoints(/Into)`, `capsuleCapsuleDistance`,
  `capsuleCapsuleSignedDistance`, `capsuleCapsuleContact(/Into)`.
  Contact data reports `surfacePoint0` / `surfacePoint1`, normal from capsule
  A toward capsule B, clamped distance, signed distance, and `intersects`.
  Segment-axis closest points are available from
  `capsuleCapsuleClosestPoints`; contact witness data uses only the
  `surfacePoint0` / `surfacePoint1` names.

### `frustum.ts`

- ctor: `mutableFrustum()`, `frustumFromMatrixWebGpu`/`Into` — six-plane
  extraction for the WebGPU `0..1` NDC convention.
- predicates: `frustumContainsPoint`, `frustumIntersectsSphere`,
  `frustumIntersectsAabb`, `frustumIntersectsObb` (projected half-extent
  per local axis), `frustumIntersectsCapsule` (segment endpoint closer
  distance vs radius). Same plane-AND conservative-culling caveat as the
  AABB variant — false positives near frustum corners are possible.

### `triangle-mesh.ts`

- ctor: `triangleMesh(vertices, indices?, vertexStride = 3)`.
- counts: `triangleMeshGetVertexCount`, `triangleMeshGetTriangleCount`.
- Mesh-level ray queries are built by the caller (index iteration +
  `rayTriangleHit`). For acceleration use `@exornea/mensura/accel`.

### `grid.ts`

Pure spatial-grid coordinate helpers. These do not know about editor snapping,
selection, placement, triggers, layers, or entity ids.

- `GridSpec`, `GridCell`, `GridCellRange`.
- `gridSpec(origin, cellSize)`, `gridCell`, `gridCellRange`.
- `worldToGrid(/Into)` uses `floor`.
- `gridToWorld(/Into)` returns the cell's minimum world corner.
- `aabbToGridRange(/Into)` returns the inclusive cell range touched by an
  AABB; a max corner exactly on a cell boundary stays in the previous cell.
- `visitGridCellsForAabb` iterates touched cells; `hashGridCell` gives a
  stable string key.

---

## `@exornea/mensura/query` — boolean predicates

Thin facade re-exporting the **yes/no predicates** from `geometry`. Reach
for it when the caller only needs to branch on "is it there?".

- AABB: `aabbContainsPoint`, `aabbIntersectsAabb`, `aabbIsEmpty`.
- Capsule: `capsuleContainsPoint`, `capsuleIntersectsSphere`.
- Frustum: `mutableFrustum`, `frustumFromMatrixWebGpu`/`Into`,
  `frustumContainsPoint`, `frustumIntersectsAabb`,
  `frustumIntersectsSphere`.
- Ray hits + intersects: every ray function. `*Hit*` returns data,
  `*Intersects*` returns boolean.
- Indexed AABB queries:
  `raycastManyAabb(/Into)`, `nearestRayAabbHit(/Into)`,
  `overlapManyAabb(/Into)`. They return input indices only; semantic mapping
  to entities, layers, selection, placement, or trigger policy belongs to the
  host engine/editor.
- Sphere: `sphereContainsPoint`, `sphereIntersectsSphere`,
  `sphereIntersectsAabb`.

> 호출자가 boolean 하나면 충분할 때 `query`.

---

## `@exornea/mensura/measure` — derived values (hot path)

Functions that turn a shape (or shape pair) into a **value**: a point, a
distance, an area, barycentric coordinates, a bounding sphere. Most entries
re-export from `geometry`; triangle measurements live here directly because
there is no `Triangle` value type.

These are hot-path primitives. They use defined sentinels for empty or
degenerate inputs and **do not allocate a `Result`**. For Result-first
behaviour see `measure/checked` below.

- AABB: `aabbClosestPoint`/`Into`, `aabbDistanceSqToPoint`,
  `aabbGetBoundingSphere`/`Into`.
- Capsule: `capsuleGetAabb`/`Into`, `capsuleSegmentDistanceSqToPoint`,
  `capsuleCapsuleClosestPoints(/Into)`, `capsuleCapsuleDistance`,
  `capsuleCapsuleSignedDistance`, `capsuleCapsuleContact(/Into)`. Contact
  witness points are named `surfacePoint0` / `surfacePoint1` to avoid
  overloading capsule endpoint names.
- Triangle (`measure/triangle.ts`, own implementation):
  - `triangleNormal`/`Into` — `cross(b - a, c - a)` then normalize.
    Degenerate triangles produce a zero normal.
  - `triangleArea`, `triangleDoubleArea` — `*Double*` skips the final
    `× 0.5`; use it sqrt-free for ordering.
  - `triangleBarycentric`/`Into` — Ericson formulation. Degenerate
    triangles silently return `(1, 0, 0)`; pre-guard with
    `triangleDoubleArea > 0` if observable failure is required.
  - `triangleClosestPoint`/`Into` — Voronoi-region (Ericson 5.1.5).

> "어디인가, 얼마나 떨어졌나, 면적은"의 정답을 빠르게.

### Empty / degenerate sentinels — the mathematics

| Function | Empty / degenerate input | Returns |
|---|---|---|
| `aabbDistanceSqToPoint` | empty AABB | `+Infinity` |
| `aabbSignedDistanceToPoint` | empty AABB | `+Infinity` |
| `aabbClosestPoint` | empty AABB | undefined (no point exists) — use `measure/checked` |
| `aabbGetBoundingSphere` | empty AABB | sphere with `radius = -1` |
| `sphereSignedDistanceToPoint` | `radius < 0` | `+Infinity` |
| `sphereContainsPoint` (geometry) | `radius < 0` | `false` |
| `triangleNormal` | zero area | zero vector |
| `triangleBarycentric` | zero area | `(1, 0, 0)` |
| `triangleClosestPoint` | zero area | first-corner fallback (no real surface) |

Mathematical justification: `dist(p, ∅) = inf(∅) = +∞` by convention — the
infimum over an empty collection of values is `+∞`. Squared distance
preserves this because `(+∞)² = +∞`. Predicates of the form `dist² ≤ r²`
therefore evaluate to `false` for any finite `r`, which matches the
`sphereContainsPoint(emptySphere, _) = false` convention — empty domains
never overlap anything.

The **closest point on the empty set is not a value** — no element exists to
choose. The raw `aabbClosestPoint` still returns a `MutableVec3` (whatever
`clamp3` produces on an inverted box), so callers that may encounter empty
inputs should either pre-guard with `aabbIsEmpty` or use the checked entry
in `measure/checked`. See [math-theory.md](math-theory.md) §2 for the
empty-domain conventions.

> 공집합과의 거리는 `+∞` (정의에 따라 inf(∅) = +∞). 공집합 위의 가장 가까운
> 점은 값 자체가 존재하지 않음 — 이 경우는 `measure/checked`로.

---

## `@exornea/mensura/measure/checked` — derived values (Result-first)

Result-first counterparts of `measure`. Each function pre-tests its input
with the `validation` layer (finite components, non-empty domain,
non-degenerate triangle), then delegates the actual measurement to the raw
`measure` functions. The output is a `Result<T>` so the empty / degenerate
case becomes observable instead of a silent sentinel.

Error stage is `"Measure"`. Codes:

- `MEASURE_EMPTY_DOMAIN` — input shape is empty; the value is undefined over
  the empty set.
- `MEASURE_DEGENERATE` — input shape has zero measure (collinear triangle,
  duplicate vertices); no unique value exists.
- Validation codes pass through with the same `"Measure"` stage when the
  caller hands in non-finite components (e.g.
  `VALIDATION_VEC3_NON_FINITE`).

Functions:

- `aabbClosestPointChecked(/Into)` — `Result<MutableVec3>`. Empty AABB →
  `MEASURE_EMPTY_DOMAIN`.
- `aabbDistanceSqToPointChecked` — `Result<number>`. Empty AABB →
  `MEASURE_EMPTY_DOMAIN`. (Raw form returns `+Infinity` for the same case.)
- `aabbGetBoundingSphereChecked(/Into)` — `Result<MutableSphere>`. Empty
  AABB → `MEASURE_EMPTY_DOMAIN`. (Raw form returns `radius = -1`.)
- `triangleNormalChecked(/Into)` — `Result<MutableVec3>`. Degenerate
  triangle → `MEASURE_DEGENERATE`.
- `triangleBarycentricChecked(/Into)` — `Result<MutableVec3>`. Degenerate
  → `MEASURE_DEGENERATE`.
- `triangleClosestPointChecked(/Into)` — `Result<MutableVec3>`. Degenerate
  → `MEASURE_DEGENERATE`.

Use checked variants at input boundaries (file load, network payload,
user-provided geometry); use the raw `measure` functions inside hot loops
where the caller already knows the shape is well-defined.

> boundary에서 empty / degenerate를 데이터로 받아야 할 때. 핫루프에는 raw
> `measure`.

---

## `@exornea/mensura/validation` — input preconditions as Result

A small layer of **input precondition checks** that return `Result`. Used
internally by `measure/checked`, and exposed as a public surface so callers
can validate untrusted geometry once at the boundary and then pass it
through the raw fast paths.

Each function takes an optional `ValidationOptions = { label?, stage? }`.
`label` improves error messages; `stage` lets the caller stamp the
validation under a domain stage (e.g. `"Measure"`, `"Persist"`) rather than
the default `"Validation"`.

Error codes (stage defaults to `"Validation"`):

| Code | Triggered by |
|---|---|
| `VALIDATION_NON_FINITE` | A scalar that is `NaN`/`±Infinity`. |
| `VALIDATION_F32_UNSTABLE` | `number → f32` round-trip exceeds relative-loss / ULP budgets. |
| `VALIDATION_MEASURE_BELOW_MIN` / `VALIDATION_MEASURE_ABOVE_MAX` | Scalar outside an allowed range. |
| `VALIDATION_VEC3_NON_FINITE` | A vec3 with any non-finite component. |
| `VALIDATION_EMPTY_AABB` | AABB where some `min > max`. |
| `VALIDATION_INVALID_RADIUS` | Sphere or capsule with non-finite or negative `radius`. |
| `VALIDATION_DEGENERATE_PLANE` | Plane normal length squared below the threshold (default `1e-12`). |
| `VALIDATION_DEGENERATE_TRIANGLE` | Triangle double-area below the threshold (default `0`). |
| `VALIDATION_INVALID_SEED` | Reproducibility seed is not a finite uint32 integer. |
| `VALIDATION_INVALID_RNG_ALGORITHM` | Reproducibility RNG algorithm is not supported. |
| `VALIDATION_INVALID_RANDOM_DISTRIBUTION` | Reproducibility sample distribution is not supported. |
| `VALIDATION_INVALID_RANDOM_EXPONENT` | Bias exponent is not finite or positive. |
| `VALIDATION_INVALID_RANGE` | Integer / bias-bin range is non-integer or inverted. |
| `VALIDATION_BIAS_OUT_OF_BUDGET` | Sample histogram deviates from uniform beyond the configured tolerance. |
| `VALIDATION_BIAS_SAMPLE_OUT_OF_RANGE` | A sample fell outside the declared bias-diagnostic range. |
| `VALIDATION_OBSERVATION_EMPTY` | Observation set has no values. |
| `VALIDATION_OBSERVATION_INSUFFICIENT` | Observation set has fewer than the required samples. |
| `VALIDATION_OBSERVATION_MISSING_SEED` | Gate requires reproducibility metadata but no seed was provided. |
| `VALIDATION_OBSERVATION_MISSING_ANCHOR` | Gate requires comparison metadata but no anchor was provided. |
| `VALIDATION_OBSERVATION_UNSTABLE` | Observation variance or relative standard deviation is outside the gate budget. |

Functions:

- Numbers: `validateFiniteNumber(value, options?)`,
  `validateStableF32(value, options?)` — uses `conversionLossF32` and the
  caller-provided `maxRelativeLoss` / `maxUlps` budgets.
- Scalar with range + optional f32 stability:
  `validateStableMeasurement(value, options?)` — `{ min?, max?,
  requireF32Stable? }`.
- Vectors: `validateFiniteVec3(value, options?)`.
- AABB: `validateFiniteAabb`, `validateNonEmptyAabb` (finite + non-empty).
- Sphere / capsule: `validateSphere`, `validateCapsule` — finite center /
  endpoints + non-negative finite radius.
- Plane: `validatePlane(value, { minNormalLengthSq? })` — rejects a
  near-zero normal.
- Triangle: `validateTriangle(a, b, c, { minDoubleArea? }) →
  Result<TriangleValidation>` where `TriangleValidation = { doubleArea,
  area }` so the caller can reuse the area downstream without recomputing.
- Ray: `validateRay(value, { minDirectionLengthSq? })` — finite
  origin/direction plus non-zero direction (`VALIDATION_DEGENERATE_RAY`).
- Mat4: `validateMat4(value, { requireFiniteDeterminant?,
  minAbsDeterminant? })` — `VALIDATION_MAT4_NON_FINITE` for any non-finite
  entry, optional `VALIDATION_MAT4_SINGULAR` against a tolerance.
- OBB: `validateObb(value, { requireOrthonormalRotation?,
  orthonormalEpsilon? })` — finite components, non-negative extents,
  optional `VALIDATION_OBB_NON_ORTHONORMAL` check.
- Frustum: `validateFrustum(value)` — runs `validatePlane` on each of the
  six planes.
- Reproducibility:
  - `validateSeed(seed, options?) → Result<number>` — accepts finite uint32
    integer seeds.
  - `validateRngAlgorithm(value, options?) → Result<DeterministicRngAlgorithm>`.
  - `validateRandomDistribution(value, options?) → Result<RandomDistribution>`.
  - `seedFromString(label) → number` — stable FNV-1a seed from a scenario label.
  - `createDeterministicRng(seed, algorithmOrOptions?)` — small deterministic
    PRNG with `nextUint32`, `nextFloat`, `sample(options?)`, and
    `range(min, max, options?)`. Supported algorithms are `lcg32`, `xorshift32`,
    and `mulberry32`; `lcg32` stays the default so old stress seeds replay.
  - `createValidatedDeterministicRng(seed, options?) → Result<DeterministicRng>`.
  - `sampleDeterministicUnit(rng, options?) → Result<number>` and
    `sampleDeterministicRange(rng, min, max, options?) → Result<number>`.
    Supported distributions:
    - `uniform` — flat over `[0, 1)`.
    - `center-biased` — average of two uniforms; same shape as `triangular`
      but kept separately for naming clarity at call sites.
    - `triangular` — explicit symmetric triangle on `[0, 1]`, peak 0.5.
    - `edge-biased` — both ends weighted; `exponent` controls how tightly
      samples hug 0 and 1. Default `2`.
    - `low-biased` / `high-biased` — `u^exponent` and `1 - u^exponent`.
    - `gaussian` — Box-Muller `N(0, 1)` shifted to mean 0.5 and clamped into
      `[0, 1]` (3σ ≈ unit edge). Long-tail samples saturate the endpoints
      rather than leak outside the unit interval contract.
  - `sampleDeterministicInt(rng, min, max) → Result<number>` — uniform integer
    on `[min, max]` with rejection sampling so the distribution stays exact
    regardless of range size.
  - `shuffleInPlace(rng, values) → values` — deterministic Fisher-Yates;
    returns the same array reference.
  - Geometric samplers (caller-owned `out`, aliasing-safe):
    - `sampleUnitDirection3Into(rng, out)` — uniform direction on `S²`
      (Marsaglia parameterisation; uniform per solid angle, no pole bias).
    - `sampleInUnitBall3Into(rng, out)` — uniform point in `B³` (radius
      drawn as `u^(1/3)` to keep volume uniform).
    - `sampleInAabbInto(rng, box, out, options?) → Result<Vec3Like>` — uniform
      (or biased) point inside an AABB. Empty AABB returns
      `VALIDATION_EMPTY_AABB`.
  - `forkRng(rng, label, options?) → DeterministicRng` — derive a named
    sub-stream from the current parent state. Two children with the same
    label replay identically; different labels diverge immediately. Each
    fork advances the parent once so subsequent parent draws stay disjoint
    from the children.
  - **Bias diagnostics** — verify a sample sequence actually looks the way
    the caller expected:
    - `summarizeSamples(samples) → { count, min, max, mean, variance,
      stddev }` — one-pass Welford summary. Returns zeros on empty input.
    - `validateUniformBias(samples, options?) → Result<UniformBiasReport>` —
      bucket samples into `bins` (default 16) on `[min, max)` (default
      `[0, 1)`) and flag bins whose count deviates from the expected count
      by more than `maxRelativeDeviation` (default 25%). Coarse on purpose:
      it is a "obviously biased" check for stress harnesses, not a formal
      statistical test.

  - **Observation suitability / measurement pipeline**:
    - `ObservationSet = { values, label?, seed?, unit?, meta? }`.
    - `checkObservationSetSuitability(set, options?) ??
      Result<ObservationSuitability>` ??gate before measurement. Options include
      `minCount`, `requireSeed`, `requireAnchor`, `anchor`, `minVariance`, and
      `maxRelativeStddev`.
    - `measureObservationSet(set, options?) ??Result<Measurement>` ??runs the
      suitability gate, then reports `min`, `max`, `mean`, `median`, `p75`,
      `p95`, variance, standard deviation, and relative standard deviation.
    - `analyzeMeasurement(measurement, { maxRelativeStddev? })` ??simple stable
      / unstable analyzer over measured variance.
    - `anchorMeasurement(measurement, label?, version?)` ??captures a baseline
      for later comparisons.
    - `compareMeasurementToAnchor(subject, anchor, options?) ??
      Result<MeasurementComparison>` ??ratio/delta comparison with optional
      `maxRegressionRatio`.

  The observation gate is not a math hot path and is intentionally not wired
  into `core`, `query`, `measure`, or `collision`. Use it in tests, benchmark
  harnesses, fuzz harnesses, imported asset validation, and Geukbit dogfood
  checks before an analyzer treats noisy or incomplete data as meaningful.

  Reproducibility is for stress tests, fixtures, generated benchmark
  inputs, and asset validation replay. It is not a security or
  gameplay-randomness primitive. See
  [math-theory.md](math-theory.md) for the formulas — RNG algorithms,
  inverse-CDF derivations, Marsaglia / `u^(1/3)` geometric samplers,
  Welford variance, and the histogram bias test.

Use this layer when geometry crosses a trust boundary (asset load, user
input, RPC body). Inside the hot path, prefer the raw `measure` / `query`
calls — they assume the inputs were validated upstream.

> 외부 데이터가 들어오는 경계에서 한 번 검증하고, 핫루프에는 raw 함수.

---

## `@exornea/mensura/collision` - narrowphase

SAT, GJK, EPA, MPR, and CCD share one caller-owned context policy. The
context is the load-bearing piece of the **no module-scope scratch** policy:
one context per concurrent caller (worker, async pipeline).

### `context.ts`

- `CollisionContext` holds every SAT, GJK, EPA, and MPR scratch slot. Treat it
  as single-owner mutable state: one context per concurrent caller.
- Constructor policy: `new CollisionContext(policy?)` accepts a
  `CollisionPolicy` with `satParallelAxisEpsilonSq` and
  `gjkDegenerateDirectionEpsilonSq`. Defaults preserve the historical
  near-parallel / degenerate-direction thresholds.

### `sat.ts`

- `testObbObbSat(a, b, ctx) -> boolean` - Separating Axis Theorem with 15
  axes (3 + 3 + 9 cross products). Boundary policy is inclusive: touching OBB
  boundaries count as overlap.
- `testObbObbSatTrace(a, b, ctx, sink) -> boolean` - same canonical SAT
  implementation with explicit diagnostic events. The default SAT path does
  not log or allocate trace objects.

### `gjk.ts`

- `SupportFunctionInto = (dir: Vec3, out: MutableVec3) => MutableVec3` -
  canonical support map. The caller writes into the provided output.
- `gjk(supportA, supportB, ctx, maxIterations = 64) -> Result<GjkResult>`.
  Success carries `{ intersect, simplex, simplexSize }`. `simplex` is a
  view into `ctx.gjkSimplex` and **stays valid only until the next `gjk()`
  call on the same context**. Copy explicitly if you need to keep the points.
  Exceeding `maxIterations` returns `GJK_MAX_ITERATIONS` with
  `{ maxIterations, simplexSize }` in `error.meta`.

### `mpr.ts`

- `MprShape = { center, supportInto }` - convex shape using
  `SupportFunctionInto`.
- `mprIntersect(a, b, ctx, maxIterations = 64, tolerance = 1e-9) ->
  Result<MprResult>` - runs Minkowski Portal Refinement portal
  discovery and portal refinement directly. Success carries
  `{ intersect, portalDirection, portalRefined, iterations }`. Exact touching
  follows the GJK boundary policy and reports `intersect: false`; exhausted
  iteration budget returns `MPR_MAX_ITERATIONS`.

`center` must be inside, or at least very near the interior of, the convex
shape. The support function must write the farthest point on the shape in the
given direction into `out` and return `out`. `portalDirection` is useful
diagnostic data from the final portal face or early exit ray; `portalRefined`
tells whether that direction
came from a non-degenerate refined portal face. It is still not a penetration
normal/depth pair. Use GJK + EPA when contact recovery is required.

```ts
import { CollisionContext, mprIntersect } from "@exornea/mensura/collision";
import type { MutableVec3, Vec3 } from "@exornea/mensura/core";
import { normalize3Into, vec3 } from "@exornea/mensura/core";

const sphere = (center: Vec3, radius: number) => ({
  center,
  supportInto: (direction: Vec3, out: MutableVec3) => {
    normalize3Into(direction, out);
    out.x = center.x + out.x * radius;
    out.y = center.y + out.y * radius;
    out.z = center.z + out.z * radius;
    return out;
  }
});

const ctx = new CollisionContext();
const result = mprIntersect(
  sphere(vec3(0, 0, 0), 1),
  sphere(vec3(1, 0, 0), 1),
  ctx
);

if (result.ok && result.value.intersect) {
  console.log(result.value.iterations);
}
```

### `epa.ts`

- `epa(simplex, simplexSize, supportA, supportB, ctx, maxIterations = 64) ->
  Result<EpaResult>` - `{ normal, depth }` for penetration recovery.
  Simplex size < 4 or all faces degenerate returns
  `EPA_DEGENERATE_SIMPLEX`. Iteration limit exhausted returns
  `EPA_MAX_ITERATIONS`.

For boolean convex overlap, use `testObbObbSat`,
`gjk(...).value.intersect`, or
`mprIntersect(...).value.intersect` depending on shape
representation. For penetration normal/depth, use a real GJK 4-simplex and
pass it to `epa`.

---

## `@exornea/mensura/accel` — acceleration structures

### `context.ts`

- `AccelContext` — traversal scratch (`bvhStack`).

### `bvh.ts`

- `Bvh`, `BvhNode` types.
- `buildBvh(primitives: Aabb[], maxPrimitivesPerLeaf = 4) → Result<Bvh>` —
  empty input returns `BVH_EMPTY_PRIMITIVES`.
- `bvhRaycast(bvh, ray, ctx) → number[]` — indices of leaves the ray
  touches. Median-split builder; no SAH yet.

---

## `@exornea/mensura/world` — orchestration

### `collision-world.ts`

- `CollisionBody` interface.
- `CollisionWorld` class — body lifecycle, BVH rebuild, raycast.
  - `addBody(aabb) → id`, `removeBody(id) → boolean`,
    `updateBody(id, aabb) → boolean` (replaces the AABB and invalidates the
    cached BVH; next `updateBvh()` rebuilds), `hasBody(id) → boolean`,
    `bodyCount() → number`.
  - Owns its own `AccelContext` internally; a single-threaded caller does
    not need to manage one. Worker isolation is still the caller's
    responsibility (one world per worker).

> 단일 스레드면 ctx 자동 관리. 워커 분리는 호출자 책임.

---

## `@exornea/mensura/batch` — N-object hot loops

Amortizes per-call overhead and hoists matrix / quat reads across N
inspectable objects. Outputs are caller-owned `Mutable*[]`.

### `vec3.ts`

- arithmetic: `add3IntoMany`, `sub3IntoMany`, `scale3IntoMany`,
  `scaleAndAdd3IntoMany` (axpy).
- normalize / cross: `normalize3IntoMany`, `cross3IntoMany`.
- scalar outputs (typed array): `dot3IntoMany<TOut>`,
  `length3IntoMany<TOut>`, `distance3IntoMany<TOut>` where `TOut` is
  `Float32Array`, `Float64Array`, or `number[]`.

### `mat4.ts`

- `mat4TransformAffinePoint3IntoMany` — bottom row trusted; common case.
- `mat4TransformPoint3IntoMany` — full projection including w-divide.
- `mat4TransformDirection3IntoMany` — upper-left 3x3 only.

### `quat.ts`

- `quatMultiplyIntoMany` — N quat pairs.

### `projection.ts` — object array ↔ packed Float32Array bridge

- vec3: `vec3ArrayWriteFloat32`, `vec3ArrayReadFloat32` (stride 3).
- quat: `quatArrayWriteFloat32`, `quatArrayReadFloat32` (stride 4).
- mat4: `mat4ArrayWriteFloat32`, `mat4ArrayReadFloat32` (stride 16).

`unsafe/*F32Many` kernels need packed input — these bridges are the seeding
step (typically into a `SharedArrayBuffer`).

> N < ~64면 per-call `Into`. N >= 64면 `*IntoMany`. 더 작고 단순한 body면
> `unsafe/*F32Many`.

---

## `@exornea/mensura/unsafe` — packed-memory hot loops

**No validation**. Length, alignment, and aliasing are entirely the
caller's contract. Every function carries an `unsafe` prefix. Not
re-exported from the root facade — opt in by import path.

### `f32.ts` — single-element packing and layout constants

- constants: `F32_BYTES = 4`, `MAT4_F32_LENGTH = 16`,
  `WGSL_VEC3F_SIZE_BYTES = 12`, `WGSL_VEC3F_ALIGN_BYTES = 16`,
  `WGSL_MAT4X4F_SIZE_BYTES = 64`.
- vec3 read / write: `unsafeVec3ReadFloat32`/`Into`,
  `unsafeVec3WriteFloat32`, `unsafeVec3WriteFloat32x4` (stride 4 with w=0).
- vec3 DataView variants: `unsafeVec3ReadDataViewF32`/`Into`,
  `unsafeVec3WriteDataViewF32`, `unsafeWgslVec3WriteDataViewF32`
  (stride 16, w=0).
- mat4 read / write: `unsafeMat4ReadFloat32`/`Into`,
  `unsafeMat4WriteFloat32`, plus DataView variants.

### `f32-kernel.ts` — N packed Float32Array kernels

vec3 (stride 3, `count * 3` length):

- arithmetic: `unsafeVec3AddF32`/`Many`, `unsafeVec3SubF32`/`Many`,
  `unsafeVec3ScaleF32`/`Many`, `unsafeVec3ScaleAndAddF32Many` (axpy).
- normalize / cross: `unsafeVec3NormalizeF32Many`,
  `unsafeVec3CrossF32Many`.
- scalar outputs (Float32Array of length N): `unsafeVec3DotF32Many`,
  `unsafeVec3LengthF32Many`, `unsafeVec3DistanceF32Many`.
- componentwise: `unsafeVec3MinF32Many`, `unsafeVec3MaxF32Many` — direct
  AABB merge inputs.
- WGSL alignment: `unsafeVec3AddF32ManyStride16` — `vec3<f32>` with 16-byte
  padding lane.

quat (stride 4):

- `unsafeQuatMultiplyF32Many`.

mat4 (stride 16):

- multiply: `unsafeMat4MultiplyF32Many` — aliasing safe. Currently
  0.89–1.0× of the scalar object `Into` loop on V8; use only when the data
  is already packed.
- transform: `unsafeMat4TransformAffinePoint3F32Many`,
  `unsafeMat4TransformPoint3F32Many`,
  `unsafeMat4TransformDirection3F32Many`.

AABB (stride 6):

- `unsafeAabbExpandByPointF32Many(box, boxOffset, points, count)` — grows
  the box in place. Caller seeds the empty state (`±Infinity`).

> 이미 packed인 경우에만 (SAB, GPU staging, parsed binary). 작은 body에서
> 큰 이득 (vec3 add 3.5x, mat4 affine 2.7x). 큰 body는 이득 없음.

---

## `@exornea/mensura/gpu` — WebGPU / Float32Array bridge

### `webgpuProjection.ts`

- `mat4PerspectiveWebGpuRh`/`Into` — RH, `0..1` NDC, forward Z. Validates
  args, returns `Result`. Supports `far = Infinity`.
- `mat4PerspectiveReverseZWebGpuRh`/`Into` — near → 1, far → 0 mapping for
  improved depth precision. Defaults to `far = Infinity`.

### `float32.ts`

- vec3: `vec3WriteFloat32`, `vec3WriteFloat32x4` (stride 4),
  `vec3ReadFloat32`.
- mat4: `mat4WriteFloat32`, `mat4ReadFloat32`.

Lightly-checked counterparts of `unsafe/f32.ts`. For untrusted buffers
(network, file, external GPU staging) prefer `data` for `Result`-first
validation.

---

## `@exornea/mensura/layout` — WGSL byte layout

Byte offset / alignment metadata for code generators and DataView writers.

- types: `BinaryLayout`, `WgslAabb3fLayout`.
- constants: `F32_SIZE_BYTES`, `WGSL_VEC3F_LAYOUT`, `WGSL_MAT4X4F_LAYOUT`,
  `WGSL_AABB3F_LAYOUT`.
- helpers: `isByteOffsetAligned`, `alignByteOffset`, `byteLengthForLayout`,
  `endByteOffsetForLayout`.

Single source of truth for WGSL ↔ JS struct mappings. Do not inline magic
offsets.

---

## `@exornea/mensura/data` — validated DataView projection

`Result`-first DataView I/O. Unlike `unsafe`, every call validates length
and alignment and returns `Result<T>`.

- validation: `validateDataViewRange(view, byteOffset, byteLength) →
  Result<true>`, `validateDataViewLayout(view, byteOffset, layout, count?)` —
  alignment + range together.
- vec3: `vec3ReadDataViewF32`/`Into`, `vec3WriteDataViewF32`,
  `wgslVec3ReadDataViewF32`/`Into`, `wgslVec3WriteDataViewF32` (WGSL
  stride 16).
- mat4: `mat4ReadDataViewF32`/`Into`, `mat4WriteDataViewF32`.
- AABB: `aabbReadWgslDataViewF32`, `aabbWriteWgslDataViewF32`.

Use `data` at boundaries where the byte buffer crosses into the runtime
(file / network / external GPU staging). Use `unsafe` inside the hot loop.

> `data`는 **byte boundary**의 Result-first 검증층, `validation`은 **수치
> domain boundary**의 Result-first 검증층. 둘 다 boundary에서 한 번 통과시키고
> 핫루프엔 raw로.

---

## `@exornea/mensura/physics` — compatibility facade

Re-exports `accel + collision + world` under one path for older imports.
New code should import each layer by responsibility.

---

## Naming Conventions

| Pattern | Meaning |
|---|---|
| `foo()` | Immutable return (small allocation). |
| `fooInto(out)` | Caller-owned `out`. Hot-path form. |
| `fooIntoMany(in[], out[], count)` | N-object batch. |
| `fooChecked()` / `fooCheckedInto(out)` | Result-first wrapper (precondition + raw). |
| `validateFoo(value, options?)` | Result-first input precondition. |
| `unsafeFooF32(...)` | Single packed-Float32Array call. |
| `unsafeFooF32Many(...)` | N packed-Float32Array call. |
| `*Sq` (`distanceSq3`, `aabbDistanceSqToPoint`) | sqrt-free; ordering only. |
| `*Hit*` (`rayAabbHit`) | Returns distance / point / normal. |
| `*Intersects*` | Returns boolean only. |
| `Contains*` | Boundary-inclusive containment. |
| `Empty` / `IsEmpty` | Empty sentinel: AABB uses `±Infinity`, sphere uses `radius < 0`. |

## Layer Selection (one-line policy)

The shape of the result decides the import path:

| Result shape | Layer |
|---|---|
| The shape value itself (ctor, mutable, copy) | `geometry` |
| Boolean predicate (yes / no) | `query` |
| Derived value, hot path with sentinels | `measure` |
| Derived value with observable failure | `measure/checked` |
| Input precondition check | `validation` |
| N-object hot loop | `batch` |
| Packed-memory hot loop | `unsafe` (explicit opt-in) |
| Validated byte I/O at a boundary | `data` |
| WGSL byte layout metadata | `layout` |
| WebGPU projection + Float32 bridge | `gpu` |
| Collision narrowphase / accel / world | `collision` / `accel` / `world` |

> 호출자 입장에서 "결과의 형태"가 import 경로를 정한다.
