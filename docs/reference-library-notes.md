# Reference Library Notes

This file collects what Mensura adopts (and what it rejects) from external math
and collision libraries. The main math references are `gl-matrix`,
`wgpu-matrix`, and `three.js`; collision notes also cite libccd's MPR
implementation. It is a decision log, not a tutorial.

The Mensura policy documents in this folder describe what Mensura **is**. This
file describes what Mensura **borrows** and **why other choices were rejected**.

## 0. Evaluation Axis

Mensura's six policy axes are the only filter:

- right-handed world, `+Y` up, `-Z` forward
- column-major storage, column-vector math (`p' = M * p`, `M = T * R * S`)
- WebGPU/DirectX-style NDC depth `0..1` as the default
- immutable `Readonly<{ x, y, z }>` public API + `Into` hot-path variants
- `Result<T>` data for failures (no `throw` for control flow; exceptions only
  inside I/O boundaries — see CLAUDE.md)
- packed transport via `Float32Array` / `DataView` adapters, never the default
  value model

An external idea is adopted only when it fits all six. Otherwise it is rejected
with a written reason, so the same conversation does not happen twice.

## 0.1 Key Decisions

Four calls that shape every row in §1 and every borrowing in `docs/TODO.md`.
They are written separately so they can be cited without re-reading the table.

- **Silent fail is rejected.** wgpu-matrix's `inverse` does `1 / d` with no
  determinant check (`src/mat4-impl.ts:441`). Mensura converts the same path
  to `Result.error`. This is the most frequent conflict point when borrowing
  algorithms — every `1/x`, every `sqrt`, every `acos` from the references
  must be reviewed for this.
- **OpenGL `-1..1` NDC is exposed only by an explicitly named helper.**
  three.js defaults `makePerspective` and `setFromProjectionMatrix` to WebGL
  NDC (`Matrix4.js:1122`, `Frustum.js:95`). Mensura inverts the default:
  WebGPU `0..1` is the unnamed helper; OpenGL is the named one
  (`mat4PerspectiveOpenGlRh`, `frustumFromProjectionMatrixOpenGlRh`).
- **wgpu-matrix's `dst?: T` single-function overload is rejected.**
  Combining the immutable and hot-path forms into one signature is convenient
  but hides the caller's allocation intent. Mensura keeps the explicit
  `mat4Identity` vs `mat4IdentityInto` split.
- **Conversion-loss is the one area Mensura is intentionally ahead.**
  None of the three references expose `absolute / relative / epsilon / ulps`
  loss data; the closest is gl-matrix's test-side `EPSILON = 1e-5`.
  `lossF32` stays as designed; every borrowed algorithm above will eventually
  be tested against `conversionLossF32`-aware thresholds, not bare constants.

## 1. Topic-to-Source Map

This table is the entry point. Each row is also the source of a follow-up entry
in `docs/TODO.md`, so implementation work can find both "what" and "why" without
re-reading the external repos.

| Topic | Adopted From | Mensura Application |
| --- | --- | --- |
| out-parameter hot path | gl-matrix, wgpu-matrix | keep the existing `Into` suffix; reject wgpu-matrix's single-function `dst?` overload |
| `perspectiveReverseZ` as a separate function | wgpu-matrix | add `mat4PerspectiveReverseZWebGpuRh`, do not branch inside `mat4PerspectiveWebGpuRh` |
| projection NDC branching | three.js | branch is informational only; Mensura keeps WebGPU `0..1` as the default and exposes other NDCs in named helpers |
| `invert` with `det = 0` | gl-matrix, three.js | return `Result<MutableMat4, AppError>`; reject `null`/zero-matrix fallbacks |
| `lookAt` for `eye ≈ center` / `up ∥ z` | gl-matrix, three.js | return `Result` error instead of epsilon perturbation |
| `quat.slerp` with `dot ≈ 1` | gl-matrix, wgpu-matrix, three.js | lerp + normalize fallback, threshold pulled into a named constant |
| `quat.setFromRotationMatrix` trace 4-way | three.js | port the four trace branches verbatim (numerical stability) |
| `quat.setFromUnitVectors` parallel/anti-parallel | three.js | port the `ε = 1e-8` branch; return `Result` for the degenerate basis case |
| AABB `containsPoint` inclusive | three.js | already matches Mensura policy; pattern reference only |
| AABB `makeEmpty` via `±Infinity` | three.js | add `aabbEmpty()` + `aabbExpandByPointInto` helpers |
| `plane.normalize` scales `constant` | three.js | already in `planeNormalizeInto`; verification reference |
| Frustum 6-plane extraction + reversed depth | three.js | port the extraction, default to WebGPU `0..1`, expose WebGL form by name |
| Ray-AABB slab + NaN guard | three.js | port `invdir` + `isNaN` guard; keep Mensura's `t >= 0` policy |
| Ray-sphere geometric (`tca / d² / thc`) | three.js | port as-is |
| Ray-triangle Möller-Trumbore | three.js | port the math; hold the `backfaceCulling` flag (separate decision later) |
| WebGPU perspective regression test | wgpu-matrix | add `(0, 0, -near) → (0, 0, 0)` and `(0, 0, -far) → (0, 0, 1)` assertions |
| `sideEffects: false` tree-shake | gl-matrix | already declared in `package.json`; verification reference |

Every adopted row above has a corresponding line in `docs/TODO.md`.

Additional collision reference rows:

| Topic | Adopted From | Mensura Application |
| --- | --- | --- |
| MPR portal discovery/refinement | libccd / XenoCollide | implement binary `mprIntersect` directly; do not expose a placeholder or route the decision through GJK |

## 2. Library-By-Library Notes

### 2.1 gl-matrix (`%TEMP%\mensura-refs\gl-matrix\`)

**Adopted**

- **`out`-first hot path**: every operation is `fn(out, a, b, ...)` returning
  `out`. This matches Mensura's `Into` suffix; we keep our naming for readability
  but the discipline (always return the writable buffer, never allocate inside
  the hot path) is the same.
- **`mat4.invert` with `det = 0`** (`src/mat4.js:293`): early-return when the
  determinant is zero. Mensura adopts the detection but encodes it as
  `Result.error(PERSIST_CONSTRAINT_VIOLATION)`-style data, not `null`.
- **`mat4.lookAt` degenerate-basis branches** (`src/mat4.js:1740`): handles
  `eye == center` and `cross(forward, up) == 0` explicitly. Mensura adopts the
  branch detection; the outcome is a `Result` error, not an identity-matrix
  fallback.
- **`quat.slerp` with `cosom ≈ 1`** (`src/quat.js:296`): linear-interpolation
  fallback under a fixed `EPSILON`. Mensura adopts the branch and constants but
  binds the threshold to a named `QUAT_SLERP_LINEAR_THRESHOLD` so it is
  testable.
- **`vec3.normalize` for zero length** (`src/vec3.js:335`): leaves `out` as
  `(0, 0, 0)` instead of dividing by zero. Mensura's `normalize3Into` already
  matches; this is verification reference only.
- **Module split + `sideEffects: false`**: each primitive lives in its own
  module and `package.json` declares no side effects. Mensura already does
  both; this confirms the tree-shake story.

**Rejected (conflict)**

- gl-matrix returns `null` from `invert` on failure. Mensura uses `Result`, so
  the success/failure shape is data, not nullable.
- gl-matrix uses absolute-tolerance test matchers (`EPSILON = 1e-5`) without
  ULP context. Mensura's `conversionLossF32` already covers absolute, relative,
  epsilon, and ULP loss — adopting gl-matrix's matcher would regress.

**Not adopted**

- `quat2` (dual quaternions) — out of Mensura's scope.
- `ANGLE_ORDER` global / per-call Euler order — Mensura prioritizes quaternions;
  Euler comes later (if at all) with explicit order in the function name.
- `setMatrixArrayType` — runtime swap of the storage type is global state and
  conflicts with Mensura's "no hidden control flow" rule.

### 2.2 wgpu-matrix (`%TEMP%\mensura-refs\wgpu-matrix\`)

**Adopted**

- **`perspectiveReverseZ` as its own function** (`src/mat4-impl.ts:840`): the
  reverse-Z path is a different function rather than a flag on `perspective`.
  Mensura adopts the same split — `mat4PerspectiveWebGpuRh` stays focused on
  the forward-Z `0..1` case, and `mat4PerspectiveReverseZWebGpuRh` becomes a
  sibling. The shared `assertPerspectiveArgs` validation is reused (and is the
  one place that still throws — see §3).
- **WebGPU regression tests**
  (`test/tests/mat4-test.js:465-466`): the test asserts
  `transform(perspective(...), [0, 0, -near]) ≈ [0, 0, 0]` and
  `transform(..., [0, 0, -far]) ≈ [0, 0, 1]`. Mensura needs the same regression
  to keep the `0..1` contract honest.
- **`Infinity` for `zFar`** (`src/mat4-impl.ts:840`): the reverse-Z perspective
  defaults `zFar = Infinity`. Mensura's `mat4PerspectiveWebGpuRhInto` already
  handles the finite/infinite split inside `assertPerspectiveArgs`; the reverse-Z
  sibling will use the same validator.

**Rejected (conflict)**

- **Single-function `dst?: T` overload**
  (`src/mat4-impl.ts:441`, `:785`, `:840`, `:1086`): convenient but blurs the
  immutable/Into split. Mensura keeps two named functions
  (`mat4Identity` vs `mat4IdentityInto`) so the caller's allocation intent is
  legible at the call site.
- **Silent zero-divide in `inverse`** (`src/mat4-impl.ts:441`): wgpu-matrix does
  `1 / d` without a determinant check. Mensura must convert this to a `Result`
  error before lifting any of the algorithm.

**Not adopted**

- `setDefaultType` was removed in wgpu-matrix v2 → v3; Mensura confirms the
  decision (no global runtime type switch).
- `euclideanModulo`, `lerp`, and other general utilities — out of Mensura's
  scope (math kernel, not a math standard library).

### 2.3 three.js math (`%TEMP%\mensura-refs\three.js\src\math\`)

This is Mensura's richest source. Only the `src/math/` directory is read; the
renderer, scene, and material directories are out of scope.

**Adopted**

- **`Box3.makeEmpty` via ±Infinity** (`Box3.js:189`): seed the AABB with
  `min = +∞`, `max = -∞` so `expandByPoint` always converges. Mensura adds
  `aabbEmpty()` and `aabbExpandByPointInto`.
- **`Box3.expandByPoint`** (`Box3.js:243`): per-component min/max into the
  existing AABB. Pairs with `aabbEmpty` for the standard "fold points into a
  bounds" idiom.
- **`Box3.containsPoint` inclusive** (`Box3.js:388`): matches Mensura's policy
  (`min <= p <= max`). Already aligned; cited as confirmation.
- **`Box3.getBoundingSphere`** (`Box3.js:606`): handles the empty-box case by
  emptying the sphere. Mensura ports the same empty-input contract.
- **`Frustum.setFromProjectionMatrix`** (`Frustum.js:95`): six-plane extraction
  with a `coordinateSystem` argument for the NDC choice and a `reversedDepth`
  flag. Mensura ports the extraction with WebGPU `0..1` as the default; the
  WebGL form is exposed by a separate name.
- **`Frustum.intersectsSphere`** (`Frustum.js:193`) and **`intersectsBox`**
  (`Frustum.js:221`): the classic "negative distance on any plane → outside"
  loops. Mensura ports both for culling.
- **`Ray.intersectBox` slab** (`Ray.js:451`): `invdir` caching + `isNaN` guard
  for axis-aligned rays. Mensura keeps its `distance >= 0` policy on top of
  this algorithm.
- **`Ray.intersectSphere`** (`Ray.js:311`): geometric `tca / d² / thc` form
  with no `sqrt` in the rejection path.
- **`Ray.intersectPlane`** (`Ray.js:397`): denominator sign check + `t >= 0`
  filter — already matches Mensura's hit-distance policy.
- **`Ray.intersectTriangle` Möller-Trumbore** (`Ray.js:540`): the standard
  formulation. The `backfaceCulling` parameter is intentionally deferred (see
  §3); the math itself is adopted as-is.
- **`Quaternion.setFromRotationMatrix` trace 4-way** (`Quaternion.js:405`):
  four branches on the largest diagonal/trace value, picked for numerical
  stability. Ported verbatim.
- **`Quaternion.setFromUnitVectors`** (`Quaternion.js:471`): handles the
  parallel and anti-parallel cases with `ε = 1e-8`. Mensura adopts the math;
  the anti-parallel "pick an orthogonal axis" path returns a `Result` when no
  stable axis is available.
- **`Quaternion.normalize`** (`Quaternion.js:635`): zero-length fallback to the
  identity quaternion. Mensura's `Result` policy means the fallback is opt-in
  through a documented helper; the algorithm itself is the same.
- **`Quaternion.slerp` with `cosHalfTheta` cutoff** (`Quaternion.js:719`):
  short-circuit lerp when `cosHalfTheta > 0.9995`. Mensura adopts the cutoff
  and pulls the constant into a named export.
- **`Matrix4.lookAt`** (`Matrix4.js:483`): handles `eye == target` and
  `up ∥ z` via small epsilon perturbations. Mensura adopts the detection but
  reports the degenerate case as `Result.error` rather than perturbing the
  basis.
- **`Matrix4.invert`** (`Matrix4.js:712`): cofactor expansion + `det` check.
  Mensura ports the math; `det == 0` becomes `Result.error`.
- **`Matrix4.compose` / `decompose`** (`Matrix4.js:1004`, `:1053`): quaternion
  to rotation expansion and the `det < 0 → flip scale.x` trick. Mensura needs
  these for transform compose/decompose.
- **`Matrix4.makePerspective`** (`Matrix4.js:1122`): `coordinateSystem` +
  `reversedDepth` parameters, with three numerical branches. Mensura adopts
  the branch structure but keeps WebGPU `0..1` as the default of the unnamed
  helper.

**Rejected (conflict)**

- Methods return `this` for chaining (`Matrix4`, `Quaternion`, `Box3`,
  `Ray`, `Frustum`, `Plane`, `Sphere` all do this). Mensura's pure default
  and explicit `Into` hot path are deliberately opposed to this style.
- `throw new Error(...)` on invalid `coordinateSystem`
  (`Matrix4.js:1153`, `Frustum.js:128`). Mensura encodes the choice in the
  type system (named functions per NDC), so the runtime throw becomes
  unreachable.
- WebGL `-1..1` NDC as the default branch in `makePerspective` and
  `setFromProjectionMatrix`. Mensura inverts the default: WebGPU `0..1` is the
  unnamed helper; WebGL is the explicitly named one.

**Not adopted**

- `Euler` — six rotation orders with no clear winner; Mensura standardizes on
  quaternions.
- `Interpolant`, `CubicInterpolant`, `LinearInterpolant`, etc. — animation
  curves are outside the math kernel.
- `Spherical`, `Cylindrical` — polar coordinates are not a core need yet.
- `Triangle`, `Vector2`, `Color`, `Matrix3` math beyond what other primitives
  already need — adopt on demand, not preemptively.

## 3. Style Decisions That Were Deliberately Skipped

- **Single-function `dst?: T` overloads (wgpu-matrix)**: convenient at the call
  site but weakens the immutable-vs-hot-path distinction and complicates type
  inference for downstream callers. Mensura keeps the explicit `Into` split.
- **`setDefaultType` runtime switch (wgpu-matrix v2)**: removed in v3 by the
  upstream maintainers. Mensura takes this as confirmation that "no global
  runtime state for storage type" is the correct call.
- **Method chaining returning `this` (three.js)**: composable but mutates
  silently; bug-prone in code that mixes immutable and mutable usage.
  Mensura's pure default + caller-owned `Into` output is the alternative.
- **`backfaceCulling` flag on ray-triangle**: deferred. Adopting the flag means
  bundling rendering policy with geometry math. Mensura's ray-triangle returns
  hit data; rendering layers above Mensura decide whether to ignore backfaces.

There is one open conflict with Mensura's own policy: `src/mat4.ts`'s
`assertPerspectiveArgs` still uses `throw`. This pre-dates the `Result` policy
and is tracked as a separate follow-up; this file does not introduce new
`throw` sites.

## 3.1 Open Policy Follow-up

- **`assertPerspectiveArgs` → `Result`**
  (`src/mat4.ts:331`). The argument validator still throws `RangeError`,
  which contradicts the Result-First rule in CLAUDE.md §1.2. The migration is
  intentionally out of scope for this borrowing round: every new perspective
  helper added under §1 (e.g. `mat4PerspectiveReverseZWebGpuRh`,
  `mat4PerspectiveOpenGlRh`) reuses the same validator, so it should be
  migrated **once**, not per-call-site. Tracked in
  `docs/TODO.md` P1 borrowings; this note exists so the conflict is visible
  from the borrowing rationale, not only from the task list.

## 4. Conversion Loss (Already Solved)

None of the three reference libraries expose a structured conversion-loss
function for `number → f32`. The closest is gl-matrix's test-side absolute
tolerance (`EPSILON = 1e-5`). Mensura's `conversionLossF32` (alias `lossF32`)
already reports `absolute`, `relative`, `epsilon`, and `ulps` per the documented
shape in `docs/float-loss.md`, so there is nothing to import on this axis.

This is the single area where Mensura is intentionally ahead of all three
references, and it is also the foundation that the rest of Mensura's adoption
decisions rest on: every numerical algorithm above must eventually be tested
against `conversionLossF32`-aware thresholds, not bare `1e-5` constants.

## 5. Collision Reference Notes

### 5.1 libccd / XenoCollide

**Adopted**

- **MPR as a support-mapping binary query**: the caller supplies a support
  function and an interior point. Mensura mirrors that shape with
  `MprShape = { center, support }`.
- **Two-phase control flow**: portal discovery builds an initial portal that
  crosses the origin ray; portal refinement repeatedly replaces the active
  portal face with a new support point until the origin is enclosed or the
  support advance stalls.
- **Per-call tolerance and budget**: Mensura exposes `tolerance` and
  `maxIterations` on `mprIntersect` rather than hiding them in global state.

**Mensura adaptation**

- `mprIntersect` is binary only. It returns `{ intersect, portalDirection,
  portalRefined, iterations }` and does not claim penetration depth, contact
  position, or a contact normal.
- Iteration failure is `Result.error("MPR_MAX_ITERATIONS")`.
- Touching follows Mensura's existing GJK boundary policy: exact boundary
  contact is not reported as positive overlap.
- Scratch vectors live in `CollisionContext`; there is no module-level mutable
  state.

**Not adopted**

- libccd's MPR penetration result path. Mensura keeps penetration recovery on
  GJK + EPA until a dedicated MPR penetration API has its own witnesses.
- Any global configuration object. Mensura keeps algorithm budgets and
  tolerance per call.
