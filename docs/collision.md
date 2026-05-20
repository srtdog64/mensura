# Collision Layer

`@exornea/mensura/collision` is experimental, but exported algorithms must be
real implementations. Work that is only exploratory belongs under
`src/experimental`, not the public package.

The collision layer is intentionally narrow:

- It answers narrowphase questions for convex shapes and simple continuous
  collision cases.
- It does not own a rigid-body solver, integration, sleeping, impulses, joints,
  islands, or broadphase scheduling.
- It uses caller-owned contexts for scratch memory. A context is not reentrant
  and must not be shared by concurrent callers.

## Source Of Truth Policy

Complex collision algorithms have one canonical implementation. For GJK and
MPR that implementation is the support-mapped path:

```txt
shape data -> support function -> CollisionContext -> gjk/mprIntersect -> Result
```

`examples/collision-source-of-truth.mjs` is the public witness for that policy.
It builds simple convex shapes, supplies support functions, and routes every
decision through `gjk` or `mprIntersect`.

Do not create separate batch or unsafe copies of GJK, EPA, MPR, CCD, BVH
traversal, or broadphase pair generation. Those algorithms have too much state
and too many boundary conventions to keep multiple hand-written versions in
sync. If a future caller needs packed memory, worker handoff, or visualization,
add a thin adapter that prepares shape data and then calls the canonical
algorithm.

Small leaf kernels are the exception. `vec3`, `mat4`, and `quat` may expose
`foo`, `fooInto`, batch, and `unsafe` variants when benchmark gates justify the
duplication. That exception does not extend to complex collision logic.

Unsafe collision paths are release-blocked until a real benchmark proves that
the canonical path is the bottleneck, records the Node/V8 version, and keeps a
tested fallback. Measurement is the only justification for adding `unsafe`
collision code.

## Boundary Policy

Different algorithms use different mathematical boundary conventions. Mensura
keeps those differences explicit:

| API | Boundary behavior |
|---|---|
| `testObbObbSat` | Inclusive. Touching OBB boundaries count as overlap. |
| `gjk` | Strict support advance. Exact touching reports `intersect: false`. |
| `mprIntersect` | Matches `gjk`: exact touching reports `intersect: false`. |
| `sweptAabbTimeOfImpact` | Existing overlap or touching at `t = 0` returns `null`; it reports first future contact events. |
| `sweptSphereTimeOfImpact` | Existing overlap reports `time = 0` with a defined center-offset normal. |
| `sweptAabbHit` / `sweptSphereHit` | Rich wrappers over the TOI functions. They add contact point, remaining motion, and `startedInContact` metadata without changing the underlying TOI policy. |

This is why SAT and GJK/MPR can intentionally disagree on exact boundary cases.
SAT is usually useful for inclusive overlap tests; GJK and MPR are strict
support-mapped positive-overlap queries.

## Numeric Policy And Diagnostics

SAT and GJK tolerances are explicit data on `CollisionContext.policy`:

- `satParallelAxisEpsilonSq` controls when a SAT cross axis is considered
  near-parallel and skipped.
- `gjkDegenerateDirectionEpsilonSq` controls when a GJK simplex direction is
  treated as degenerate.

These thresholds are squared-length values because the hot paths already have
squared lengths available. The default constants preserve the historical
`1e-6` guards, but callers that need a stricter debug pass can construct a
context with their own `CollisionPolicy`.

Collision core does not perform JSON logging. Logging inside the narrowphase
loop would add side effects and allocation pressure to hot paths. Use explicit
diagnostic surfaces instead:

- `testObbObbSatTrace(a, b, ctx, sink)` emits `axis-tested` and
  `parallel-axis-skipped` events while running the same canonical SAT
  implementation as `testObbObbSat`.
- `gjk` returns `GJK_MAX_ITERATIONS` with `{ maxIterations, simplexSize }` in
  `Result.error.meta` when the iteration budget is exhausted.

## Support-Mapped Shapes

`gjk`, `epa`, and `mprIntersect` operate on support functions:

```ts
type SupportFunction = (direction: Vec3) => Vec3;
```

A valid support function returns the farthest point on the convex shape in the
given direction. It should be deterministic for a fixed direction. For MPR,
`MprShape.center` must be an interior point or a very close approximation of
one; using an exterior point can break the portal-discovery assumptions.

## MPR Contract

`mprIntersect(a, b, ctx, maxIterations = 64, tolerance = 1e-9)` implements the
binary Minkowski Portal Refinement path:

1. Build the Minkowski interior point from `a.center - b.center`.
2. Discover an initial portal that crosses the ray toward the origin.
3. Refine the portal face by asking for a new support point along the portal
   normal.
4. Return `intersect: true` when the portal contains the origin.
5. Return `intersect: false` when the support advance cannot pass the current
   portal face.
6. Return `MPR_MAX_ITERATIONS` if the iteration budget is exhausted.

`MprResult.portalDirection` is diagnostic. When `portalRefined` is `true`, it
comes from a non-degenerate refined portal face. When `portalRefined` is
`false`, it is an early-exit ray/fallback direction or a degenerate portal
case. Neither form implies penetration depth or a full contact manifold.

Use MPR when you have support-mapped convex shapes plus useful interior points
and only need a boolean intersection decision. Use GJK + EPA when you need a
penetration normal and depth.

## Sweep Result Contract

`sweptAabbTimeOfImpact` and `sweptSphereTimeOfImpact` remain the scalar
source-of-truth functions for continuous collision. Use `sweptAabbHit` and
`sweptSphereHit` when a caller also needs derived placement data:

```ts
type SweepHit = {
  hit: true;
  time: number;
  normal: Vec3;
  point: Vec3;
  remainingMotion: Vec3;
  startedInContact: boolean;
};
```

The `point` is pure geometry: it is not a placement decision, trigger event, or
editor warning. Hosts such as Geukbit decide how to interpret the hit.

## GJK / EPA Contract

`gjk` returns a context-owned simplex view:

- `simplex` points into `ctx.gjkSimplex`.
- `simplexSize` tells how many entries are meaningful.
- The view is valid only until the next `gjk` call using the same context.

`epa(simplex, simplexSize, supportA, supportB, ctx)` expects a real
4-simplex from an intersecting GJK result. Degenerate inputs return
`EPA_DEGENERATE_SIMPLEX`; iteration exhaustion returns `EPA_MAX_ITERATIONS`.

## Context Ownership

`CollisionContext` owns scratch storage for SAT, GJK, EPA, and MPR. Reusing a
context across calls is the intended allocation-free hot path. Sharing one
context across concurrent calls is a caller bug.

Good:

```ts
const ctx = new CollisionContext();
const a = gjk(supportA, supportB, ctx);
const b = mprIntersect(shapeA, shapeB, ctx);
```

Bad:

```ts
// Two concurrent tasks mutate the same scratch vectors.
await Promise.all([
  task(() => gjk(supportA, supportB, ctx)),
  task(() => mprIntersect(shapeA, shapeB, ctx))
]);
```

## Release Rules

Public collision APIs are release-blocked if they describe themselves as
placeholder or unimplemented work. `npm run check:release` runs
`release:stub-check`, and `prepublishOnly` runs the same release gate.

Before promoting `collision` out of experimental status, Mensura still needs:

- broader randomized support-map corpus coverage for GJK/MPR agreement away
  from boundary cases.
- dedicated MPR penetration/contact recovery, if that API is added at all.
- more EPA non-convergence witnesses beyond explicit zero-budget coverage.
