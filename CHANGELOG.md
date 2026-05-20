# Changelog

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
