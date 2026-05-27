# Mensura Examples

Runnable TypeScript snippets that show the intended API shape. Each file is
self-contained and uses the published layer entry points so that the same code
works for downstream consumers. Examples use the canonical layer names such as
`@exornea/mensura/core` and `@exornea/mensura/collision`; they do not use
duplicate `/index` subpath spellings.

The examples folder is **not** included in `tsc -p tsconfig.json`
(see `tsconfig.json` `include`), so it does not affect library builds. Run a
specific example with `tsx`, `ts-node`, or after `tsc` against
`tsconfig.examples.json` if you add one.

## Files

- [camera-projection.ts](camera-projection.ts): RH view + WebGPU `0..1`
  perspective + frustum-AABB culling + ray-AABB picking.
- [transform-trs.ts](transform-trs.ts): `transform3` semantic TRS records,
  direct point application, checked matrix decomposition, and the
  `mat4Compose` / `mat4Decompose` roundtrip with `det < 0 -> scale.x`
  flip behaviour.
- [quaternion-ops.ts](quaternion-ops.ts): `quatFromUnitVectors`,
  `quatConjugate`, `quatSlerp` with the lerp-fallback threshold.
- [error-handling.ts](error-handling.ts): `Result<T>` patterns: `unwrap`,
  discriminated check, error-code switch.
- [batch-and-unsafe.ts](batch-and-unsafe.ts): batch `*IntoMany` over semantic
  Vec3 objects vs `unsafe/*F32Many` over packed `Float32Array` /
  `SharedArrayBuffer`. Rule-of-thumb decision table at the bottom.
- [collision-source-of-truth.mjs](collision-source-of-truth.mjs): runnable
  support-mapped collision example. It keeps GJK/MPR as the single canonical
  `SupportFunctionInto` implementation and treats shape setup, assertions,
  workers, and visuals as adapters around that path.
- [geukbit-viewport-dogfood.mjs](geukbit-viewport-dogfood.mjs): Geukbit-style
  viewport math without Geukbit semantics. It combines camera frustum culling,
  ray/AABB picking, and bounds measurement while leaving entity ids,
  selection, placement, and undo policy to the host.
- [shared-array-buffer-worker.ts](shared-array-buffer-worker.ts): worker
  handoff over `SharedArrayBuffer` with caller-owned `Atomics` publication.
  Mensura kernels run on shared memory; the host owns synchronization.
- [visual-ray-fixtures.mjs](visual-ray-fixtures.mjs): dependency-free visual
  ray-hit fixtures. `npm run visual:ray` builds the package and writes SVG,
  2D HTML, 3D Canvas HTML, and a regression-tested JSON manifest to
  `.mensura-visual/`.

## Visual Ray Fixture Preview

This checked-in preview mirrors the 3D Canvas output from
`npm run visual:ray`, so package users can understand the expected ray hit
layout before running the generator.

![Ray hit visual fixture preview](visual-ray-fixtures-3d-preview.png)
