# Compiler Readiness

Mensura is moving toward a kernel that can serve both editor/runtime code and
compiler-adjacent binary projection work. The package should stay small, but
its boundaries must be strict enough that generated code can target it without
guessing at conventions.

## Current Shape

```txt
core      semantic number math: float, vectors, matrices, quaternions, Result
geometry  spatial primitives and intersection/culling semantics
gpu       named WebGPU projection helpers and Float32Array transport
unsafe    unchecked binary/typed-array projection for generated or hot code
physics   source experiment only; not part of the public package surface
```

The root package facade exports `core`, `geometry`, and `gpu`. It does not
export `unsafe`; callers must import `@exornea/mensura/unsafe` explicitly.

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
- Do not export `physics` until it compiles under strict mode and has witness
  tests for GJK/EPA/BVH behavior.
- Add `data` or `layout` only when there is a safe, checked counterpart to an
  existing `unsafe` projection.
- Migrate matrix inverse/look-at/projection validation from `throw` to `Result`
  before treating them as compiler-targetable APIs.
