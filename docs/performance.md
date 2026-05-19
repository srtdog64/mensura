# Performance

Mensura keeps allocation-free `Into` APIs beside immutable object APIs, adds
**batch (`*Many`)** entry points that amortize call overhead across many
elements, and exposes **unsafe `Float32Array` kernels** that operate on packed
buffers (including `SharedArrayBuffer`-backed views) for the lowest-overhead
hot loops.

Run:

```sh
npm run benchmark
```

Release gate:

```sh
npm run benchmark:check
npm run check:release
```

The benchmark imports built files from `dist`, so it measures the same ESM
surface package consumers use. It includes direct `gl-matrix` and
`wgpu-matrix` comparisons for matching vec3 and mat4 workloads.

`benchmark:check` fails the process when release-blocking hot paths fall below
their relative thresholds. The gate focuses on claims Mensura actually makes:
direct `Into` paths must stay within competitive range of gl-matrix and at
least two of those direct paths must win on the same run. Object-array batch
kernels must beat the equivalent gl-matrix loop, matrix batches that hoist
shared reads must beat the scalar Mensura loop, and the documented unsafe fast
cases must keep their packed-buffer advantage. Immutable helpers such as
`add3` and `normalize3` allocate inspectable `{x,y,z}` objects and are not the
hot-path performance claim. Known non-winning cases such as packed mat4
multiply and unstable cases such as packed quaternion multiply are documented
guidance, not release blockers.

The gate uses ratios instead of absolute ops/sec because V8 tiering and OS
scheduling make single-machine microbenchmarks noisy. The threshold constants
live next to the benchmark cases in `benchmark-runner.js` with comments
explaining why each family is gated differently.

## Latest Local Snapshot

Environment:

```txt
Node: v22.17.0
Samples: 7 median after 2 warmups
Date: 2026-05-20
```

### Per-Call (object API)

```txt
vec3 add
naive object baseline                  86.8M ops/s  1.00x
Mensura add3                           88.1M ops/s  1.02x
Mensura add3Into                      108.7M ops/s  1.25x
gl-matrix vec3.add                     96.9M ops/s  1.12x
wgpu-matrix vec3.add                   81.5M ops/s  0.94x

vec3 normalize
naive object baseline                  66.0M ops/s  1.00x
Mensura normalize3                     61.2M ops/s  0.93x
Mensura normalize3Into                 93.5M ops/s  1.42x
gl-matrix vec3.normalize               83.2M ops/s  1.26x
wgpu-matrix vec3.normalize             51.5M ops/s  0.78x

mat4 multiply
Mensura mat4Multiply                   33.6M ops/s  1.00x
Mensura mat4MultiplyInto               44.1M ops/s  1.32x
gl-matrix mat4.multiply                37.4M ops/s  1.12x
wgpu-matrix mat4.multiply              33.4M ops/s  0.99x

mat4 transform
Mensura mat4TransformPoint3            79.7M ops/s  1.00x
Mensura mat4TransformPoint3Into        79.9M ops/s  1.00x
Mensura affinePoint3Into               98.1M ops/s  1.23x
gl-matrix vec3.transformMat4           63.2M ops/s  0.79x
wgpu-matrix vec3.transformMat4         55.1M ops/s  0.69x

ray/aabb
Mensura rayAabbHitDistance             55.8M ops/s  1.00x

f32 write
gpu vec3WriteFloat32                  133.6M ops/s  1.00x
unsafeVec3WriteFloat32                122.7M ops/s  0.92x
unsafeVec3WriteDataViewF32             91.0M ops/s  0.68x
gpu mat4WriteFloat32                  108.6M ops/s  0.81x
unsafeMat4WriteFloat32                 97.2M ops/s  0.73x
unsafeMat4WriteDataViewF32             39.1M ops/s  0.29x
```

### Batch (object array vs unsafe Float32Array)

```txt
vec3 add batch
scalar object loop (add3Into)         190.0M ops/s  1.00x
Mensura add3IntoMany                  280.8M ops/s  1.48x
unsafe vec3 F32 Many                  729.7M ops/s  3.84x
gl-matrix loop                        174.6M ops/s  0.92x

vec3 normalize batch
scalar object loop (normalize3Into)   255.5M ops/s  1.00x
Mensura normalize3IntoMany            293.7M ops/s  1.15x
unsafe vec3 F32 Many                  306.5M ops/s  1.20x
gl-matrix loop                        198.3M ops/s  0.78x

mat4 affine transform batch
scalar object loop (affinePoint3Into) 197.3M ops/s  1.00x
Mensura affinePoint3IntoMany          295.8M ops/s  1.50x
unsafe mat4 affine F32 Many           419.2M ops/s  2.12x
gl-matrix loop                        158.1M ops/s  0.80x

vec3 add batch (WGSL stride 16)
unsafe vec3 F32 Many (stride 12)      680.3M ops/s  1.00x
unsafe vec3 F32 Many (stride 16)      673.0M ops/s  0.99x

mat4 multiply batch
scalar object loop (mat4MultiplyInto)  48.8M ops/s  1.00x
unsafe mat4 F32 Many                   48.3M ops/s  0.99x
gl-matrix loop                         43.9M ops/s  0.90x

vec3 dot batch
Mensura dot3IntoMany                  369.6M ops/s  1.00x
unsafe vec3 dot F32 Many              806.5M ops/s  2.18x
gl-matrix loop                        246.7M ops/s  0.67x

vec3 cross batch
Mensura cross3IntoMany                272.2M ops/s  1.00x
unsafe vec3 cross F32 Many            524.4M ops/s  1.93x
gl-matrix loop                        165.2M ops/s  0.61x

mat4 transform batch (perspective)
Mensura transformPoint3IntoMany       256.7M ops/s  1.00x
unsafe mat4 transformPoint3 F32 Many  257.5M ops/s  1.00x
gl-matrix loop                        160.8M ops/s  0.63x

vec3 length batch
Mensura length3IntoMany               508.8M ops/s  1.00x
unsafe vec3 length F32 Many           504.9M ops/s  0.99x

vec3 distance batch
Mensura distance3IntoMany             390.6M ops/s  1.00x
unsafe vec3 distance F32 Many         490.9M ops/s  1.26x

vec3 scaleAndAdd batch
Mensura scaleAndAdd3IntoMany          208.0M ops/s  1.00x
unsafe vec3 scaleAndAdd F32 Many      479.8M ops/s  2.31x

quat multiply batch
Mensura quatMultiplyIntoMany          180.3M ops/s  1.00x
unsafe quat multiply F32 Many         245.9M ops/s  1.36x

mat4 transform direction batch
Mensura transformDirection3IntoMany   284.4M ops/s  1.00x
unsafe mat4 transformDirection3 F32 Many  320.9M ops/s  1.13x
```

## Reading The Results

- **`Into` paths are the per-call hot-loop win.** `vec3` and `mat4` reuse
  outputs and avoid repeated object/array allocation. On this Node/V8 run,
  Mensura `Into` paths are competitive with `gl-matrix` and `wgpu-matrix`;
  `add3Into`, `normalize3Into`, `mat4MultiplyInto`, and `affinePoint3Into`
  beat the matching gl-matrix reference cases on this run.
- **Batch object APIs (`*IntoMany`) amortize call overhead.** For very small
  per-call bodies (vec3 add: 3 additions), Mensura batch stays close to a
  hand-rolled scalar loop, while a hand-rolled gl-matrix loop is **0.92x** of
  the scalar loop and **0.62x** of `add3IntoMany`; the gap is the
  cross-package call cost gl-matrix pays per element. For larger
  per-call bodies (mat4 affine transform: matrix hoist plus point math),
  Mensura batch is **1.50x** the scalar loop because the matrix read is hoisted
  out of the inner loop.
- **`unsafe/*F32Many` is the largest win for small kernels.** Packed
  `Float32Array` + a single function call gives **3.84x** on vec3 add and
  **2.12x** on mat4 affine transform versus the scalar object loop, and about
  **4.18x** versus the gl-matrix vec3-add loop. The win compounds with
  `SharedArrayBuffer` views, since no copy is involved.
- **`unsafe` does not always win.** For `mat4 multiply` (64 multiplies per
  pair), the inner body is so large that call overhead is negligible; unsafe
  batch is **0.99x** of the scalar object loop on this run. **Use unsafe only
  when the per-call body is small or the data is already packed.**
- **WGSL stride 16 vs packed stride 12 is close but not guaranteed faster** on
  this run (0.99x). Choose stride based on the layout contract with WGSL /
  uniform binding, not for raw speed.
- **`unsafe` is not automatically faster.** It means unchecked layout access
  for generated code, binary projections, and shared memory. `DataView`
  writes are useful for exact byte layout, not for raw speed against
  `Float32Array`.
- Snapshot numbers are machine- and runtime-sensitive. Compare relative
  numbers from the same run, not absolute ops/sec across machines.

## Usage Guide

Pick the layer based on call shape, not on theoretical fastness:

| Call shape | Recommended API |
|---|---|
| Single call, returns a new value | `add3`, `mat4Multiply` (immutable, allocates) |
| Single call, caller owns output | `add3Into`, `mat4MultiplyInto` (`Into` suffix) |
| Loop of N >= ~64 calls, semantic objects | `add3IntoMany`, `mat4TransformAffinePoint3IntoMany` |
| Loop of N >= ~64 calls, semantic objects, scalar result | `dot3IntoMany`, `length3IntoMany`, `distance3IntoMany` (write into a typed array of N numbers) |
| Loop of N >= ~64 calls, semantic objects, vec3 axpy / integrator step | `scaleAndAdd3IntoMany` |
| Loop of N >= ~64 calls, semantic objects, quaternion composition | `quatMultiplyIntoMany` |
| Loop of N >= ~64 calls, semantic objects, direction (no translation) | `mat4TransformDirection3IntoMany` |
| Semantic <-> packed conversion | `vec3ArrayWriteFloat32` / `vec3ArrayReadFloat32`, `quatArrayWriteFloat32` / `quatArrayReadFloat32`, `mat4ArrayWriteFloat32` / `mat4ArrayReadFloat32` (in `@exornea/mensura/batch`) |
| Loop of N >= ~64 calls, packed `Float32Array` (or `SharedArrayBuffer` view) | `unsafeVec3AddF32Many`, `unsafeVec3SubF32Many`, `unsafeVec3ScaleF32Many`, `unsafeVec3ScaleAndAddF32Many`, `unsafeVec3NormalizeF32Many`, `unsafeVec3DotF32Many`, `unsafeVec3CrossF32Many`, `unsafeVec3LengthF32Many`, `unsafeVec3DistanceF32Many`, `unsafeMat4TransformAffinePoint3F32Many`, `unsafeMat4TransformPoint3F32Many`, `unsafeMat4TransformDirection3F32Many` |
| WGSL `vec3<f32>` uniform/storage buffer (16-byte aligned) | `unsafeVec3AddF32ManyStride16` |
| Packed quaternion composition | `unsafeQuatMultiplyF32Many` only when inputs are already packed; on V8 it can be close to `quatMultiplyIntoMany`, so it is layout-driven rather than a guaranteed speed path |
| Mat4 multiply, N pairs, packed `Float32Array` | `unsafeMat4MultiplyF32Many` only if measured to win; the scalar `mat4MultiplyInto` loop is faster on this run |

Rules of thumb:

- Small per-element body + many elements: batch and unsafe both win big.
- Large per-element body (mat4 multiply, full perspective projection): batch
  and unsafe rarely beat scalar `Into`; measure first.
- Crossing the Worker boundary: use `unsafe/*F32` over `SharedArrayBuffer`;
  the writers do not allocate and do not interact with `Atomics`.
  Publication is the caller's responsibility (see
  [multithreading.md](multithreading.md)).
- Don't introduce module-scratch helpers as a "fast path". The migration cost
  to caller-owned context has already been paid once; new hot-path code lands
  with a context argument from the start.
