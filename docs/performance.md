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

The benchmark imports built files from `dist`, so it measures the same ESM
surface package consumers use. It includes direct `gl-matrix` and
`wgpu-matrix` comparisons for matching vec3 and mat4 workloads.

## Latest Local Snapshot

Environment:

```txt
Node: v22.17.0
Samples: 7 median after 2 warmups
Date: 2026-05-18
```

### Per-Call (object API)

```txt
vec3 add
naive object baseline                  76.2M ops/s  1.00x
Mensura add3                           85.3M ops/s  1.12x
Mensura add3Into                       93.3M ops/s  1.22x
gl-matrix vec3.add                     95.3M ops/s  1.25x
wgpu-matrix vec3.add                   80.1M ops/s  1.05x

vec3 normalize
naive object baseline                  60.7M ops/s  1.00x
Mensura normalize3                     59.1M ops/s  0.97x
Mensura normalize3Into                 90.3M ops/s  1.49x
gl-matrix vec3.normalize               75.0M ops/s  1.24x
wgpu-matrix vec3.normalize             58.6M ops/s  0.97x

mat4 multiply
Mensura mat4Multiply                   28.1M ops/s  1.00x
Mensura mat4MultiplyInto               41.0M ops/s  1.46x
gl-matrix mat4.multiply                34.4M ops/s  1.22x
wgpu-matrix mat4.multiply              33.3M ops/s  1.19x

mat4 transform
Mensura mat4TransformPoint3            70.0M ops/s  1.00x
Mensura mat4TransformPoint3Into        73.5M ops/s  1.05x
Mensura affinePoint3Into              100.5M ops/s  1.44x
gl-matrix vec3.transformMat4           64.0M ops/s  0.91x
wgpu-matrix vec3.transformMat4         57.1M ops/s  0.82x
```

### Batch (object array vs unsafe Float32Array)

```txt
vec3 add batch
scalar object loop (add3Into)         211.7M ops/s  1.00x
Mensura add3IntoMany                  238.1M ops/s  1.12x
unsafe vec3 F32 Many                  738.4M ops/s  3.49x
gl-matrix loop                        167.9M ops/s  0.79x

vec3 normalize batch
scalar object loop (normalize3Into)   263.4M ops/s  1.00x
Mensura normalize3IntoMany            236.6M ops/s  0.90x
unsafe vec3 F32 Many                  255.9M ops/s  0.97x
gl-matrix loop                        144.9M ops/s  0.55x

mat4 affine transform batch
scalar object loop (affinePoint3Into) 151.0M ops/s  1.00x
Mensura affinePoint3IntoMany          254.3M ops/s  1.68x
unsafe mat4 affine F32 Many           401.8M ops/s  2.66x
gl-matrix loop                        131.1M ops/s  0.87x

vec3 add batch (WGSL stride 16)
unsafe vec3 F32 Many (stride 12)      516.5M ops/s  1.00x
unsafe vec3 F32 Many (stride 16)      519.6M ops/s  1.01x

mat4 multiply batch
scalar object loop (mat4MultiplyInto)  47.2M ops/s  1.00x
unsafe mat4 F32 Many                   47.2M ops/s  1.00x
gl-matrix loop                         41.0M ops/s  0.87x

vec3 dot batch
Mensura dot3IntoMany                  351.4M ops/s  1.00x
unsafe vec3 dot F32 Many              483.4M ops/s  1.38x
gl-matrix loop                        234.5M ops/s  0.67x

vec3 cross batch
Mensura cross3IntoMany                241.5M ops/s  1.00x
unsafe vec3 cross F32 Many            529.1M ops/s  2.19x
gl-matrix loop                        168.6M ops/s  0.70x

mat4 transform batch (perspective)
Mensura transformPoint3IntoMany       231.8M ops/s  1.00x
unsafe mat4 transformPoint3 F32 Many  206.8M ops/s  0.89x
gl-matrix loop                        147.5M ops/s  0.64x

vec3 length batch
Mensura length3IntoMany               453.0M ops/s  1.00x
unsafe vec3 length F32 Many           477.1M ops/s  1.05x

vec3 distance batch
Mensura distance3IntoMany             341.6M ops/s  1.00x
unsafe vec3 distance F32 Many         291.9M ops/s  0.85x

vec3 scaleAndAdd batch
Mensura scaleAndAdd3IntoMany          201.9M ops/s  1.00x
unsafe vec3 scaleAndAdd F32 Many      707.0M ops/s  3.50x

quat multiply batch
Mensura quatMultiplyIntoMany          205.4M ops/s  1.00x
unsafe quat multiply F32 Many         292.4M ops/s  1.42x

mat4 transform direction batch
Mensura transformDirection3IntoMany   269.7M ops/s  1.00x
unsafe mat4 transformDirection3 F32 Many  327.7M ops/s  1.21x
```

## Reading The Results

- **`Into` paths are the per-call hot-loop win.** `vec3` and `mat4` reuse
  outputs and avoid repeated object/array allocation. On this Node/V8 run,
  Mensura `Into` paths are competitive with `gl-matrix` and `wgpu-matrix`;
  the only per-call miss on this run is `vec3.add`, where gl-matrix is about
  2 percent ahead of `add3Into`.
- **Batch object APIs (`*IntoMany`) amortize call overhead.** For very small
  per-call bodies (vec3 add: 3 additions), Mensura batch stays close to a
  hand-rolled scalar loop, while a hand-rolled gl-matrix loop is **0.79x**;
  the gap is the cross-package call cost gl-matrix pays per element. For larger
  per-call bodies (mat4 affine transform: matrix hoist plus point math),
  Mensura batch is **1.68x** the scalar loop because the matrix read is hoisted
  out of the inner loop.
- **`unsafe/*F32Many` is the largest win for small kernels.** Packed
  `Float32Array` + a single function call gives **3.49x** on vec3 add and
  **2.66x** on mat4 affine transform versus the scalar object loop, and about
  **4.4x** versus the gl-matrix vec3-add loop. The win compounds with
  `SharedArrayBuffer` views, since no copy is involved.
- **`unsafe` does not always win.** For `mat4 multiply` (64 multiplies per
  pair), the inner body is so large that call overhead is negligible; unsafe
  batch is effectively tied with the scalar object loop on this run. **Use
  unsafe only when the per-call body is small or the data is already packed.**
- **WGSL stride 16 vs packed stride 12 is a wash** on this run (1.01x). The
  padding lane fits in the same cache line; choose stride based on the layout
  contract with WGSL / uniform binding, not for raw speed.
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
| Loop of N >= ~64 calls, packed `Float32Array` (or `SharedArrayBuffer` view) | `unsafeVec3AddF32Many`, `unsafeVec3SubF32Many`, `unsafeVec3ScaleF32Many`, `unsafeVec3ScaleAndAddF32Many`, `unsafeVec3NormalizeF32Many`, `unsafeVec3DotF32Many`, `unsafeVec3CrossF32Many`, `unsafeVec3LengthF32Many`, `unsafeVec3DistanceF32Many`, `unsafeQuatMultiplyF32Many`, `unsafeMat4TransformAffinePoint3F32Many`, `unsafeMat4TransformPoint3F32Many`, `unsafeMat4TransformDirection3F32Many` |
| WGSL `vec3<f32>` uniform/storage buffer (16-byte aligned) | `unsafeVec3AddF32ManyStride16` |
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
