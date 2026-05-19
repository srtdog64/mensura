# Compiler Readiness

Mensura is moving toward a kernel that can serve both editor/runtime code and
compiler-adjacent binary projection work. The package should stay small, but
its boundaries must be strict enough that generated code can target it without
guessing at conventions.

## Current Shape

```txt
core      semantic number math: float, vectors, matrices, quaternions, Result
geometry  spatial primitive definitions and primitive-local operations
query     spatial queries: ray hits, overlap tests, frustum culling
measure   derived primitive measurements, bounds, and closest-point projections
collision narrowphase collision algorithms: SAT, GJK, EPA, MPR, CCD
accel     acceleration structures and broadphase traversal
world     orchestration over collision bodies and acceleration structures
layout    WGSL-compatible byte layout metadata
data      checked DataView projection records with Result failures
batch     object-array batch kernels that preserve semantic value shapes
gpu       named WebGPU projection helpers and Float32Array transport
unsafe    unchecked binary/typed-array projection for generated or hot code
physics   compatibility facade for accel/collision/world
```

The root package facade exports the primary safe layers. It does not export
`unsafe`; callers must import `@exornea/mensura/unsafe` explicitly.

## Safe API Contract

Safe APIs should preserve these rules:

- Public values are inspectable `number` objects, not typed arrays.
- Hot paths use the `Into` suffix and caller-owned output objects.
- Expected failures return `Result`; `throw` is reserved for programming errors
  until those older call sites are migrated.
- Optional fields are omitted when absent. Do not assign `undefined` under
  `exactOptionalPropertyTypes`.
- WebGPU, OpenGL, reverse-Z, and external-engine policies are named in the API.

## Unsafe API Contract

Unsafe APIs are allowed, but must be visibly unsafe:

- Export only from `src/unsafe`.
- Function names start with `unsafe`.
- No bounds, alignment, ownership, or aliasing checks are implied.
- Byte offsets and element offsets are trusted.
- Layout constants must be exported next to the writer/reader functions.

This is the right surface for generated code, packed simulation records, WGSL
uniform/storage writes, and Zeno-style binary projections.

## Near-Term Gates

- Keep `npm run check` green before expanding the public export surface.
- Keep `npm run release:stub-check` in `check:release` and `prepublishOnly`.
  Generated or compiler-targetable code should never depend on a public API
  that is only a placeholder.
- Keep `physics` as a compatibility facade. New collision work should land in
  `collision`, `accel`, `query`, or `world` according to responsibility.
- Keep `layout` as metadata and `data` as the checked projection boundary.
  Generated code can drop to `unsafe` only after it owns the same layout
  contract explicitly.
- Keep matrix inverse/look-at/projection validation `Result`-first before
  treating them as compiler-targetable APIs.
