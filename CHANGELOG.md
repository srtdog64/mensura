# Changelog

## 0.3.2

- Added `core/transform3` as the semantic translation/rotation/scale record
  layer over the canonical `mat4Compose` / `mat4Decompose` convention.
- Added direct `Transform3` point and direction application helpers that avoid
  composing an intermediate matrix for single-value use.
- Added checked `Transform3` matrix decomposition with `Result` errors for
  non-finite matrices, invalid decompose thresholds, and near-zero axis scale.
- Added `Transform3` composition helpers with caller-owned scratch support and
  documented the lossy shear caveat for non-uniform scale plus rotation.
- Updated examples, API docs, and API snapshot for the new transform surface.

## 0.3.1

- Tightened OBB SAT primary-axis projection to avoid re-projecting a box onto
  its own unit local axes.
- Fixed the focused performance benchmark to use the canonical
  `SupportFunctionInto` MPR contract.
- Added a release-gated type smoke check for `perf-benchmark.ts`.
- Canonicalized layer imports by blocking duplicate `/index` subpaths.
- Fixed API snapshot wildcard expansion so subpath snapshots inspect the
  intended layer directory.
- Removed stale benchmark/report surfaces that duplicated the authoritative
  benchmark harness.

## 0.3.0

- Unified collision support-map APIs around `SupportFunctionInto`.
- Removed allocating collision support wrappers from the public surface.
- Added observation suitability, measurement, anchor, analyzer, and comparison
  helpers under `@exornea/mensura/validation`.
- Added Geukbit viewport dogfood smoke example to the example smoke gate.
- Updated API snapshot, collision docs, validation docs, and migration notes.
