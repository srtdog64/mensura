# Performance

Mensura keeps allocation-free `Into` APIs beside immutable object APIs. The
benchmark runner compares those paths against simple local baselines and
unchecked projection helpers. It also includes direct `gl-matrix` and
`wgpu-matrix` comparisons for matching vec3/mat4 hot-loop workloads.

Run:

```sh
npm run benchmark
```

The benchmark imports built files from `dist`, so it measures the same ESM
surface package consumers use.

## Latest Local Snapshot

Environment:

```txt
Node: v22.17.0
Samples: 7 median after 2 warmups
Date: 2026-05-18
```

Results:

```txt
vec3 add
naive object baseline          75,110,600 ops/s  1.00x
Mensura add3                   81,765,480 ops/s  1.09x
Mensura add3Into              112,365,863 ops/s  1.50x
gl-matrix vec3.add             92,250,071 ops/s  1.23x
wgpu-matrix vec3.add           72,434,374 ops/s  0.96x

vec3 normalize
naive object baseline          61,703,637 ops/s  1.00x
Mensura normalize3             53,438,786 ops/s  0.87x
Mensura normalize3Into         81,635,985 ops/s  1.32x
gl-matrix vec3.normalize       62,957,623 ops/s  1.02x
wgpu-matrix vec3.normalize     64,831,923 ops/s  1.05x

mat4 multiply
Mensura mat4Multiply           35,534,077 ops/s  1.00x
Mensura mat4MultiplyInto       47,062,367 ops/s  1.32x
gl-matrix mat4.multiply        34,980,201 ops/s  0.98x
wgpu-matrix mat4.multiply      35,341,683 ops/s  0.99x

mat4 transform
Mensura mat4TransformPoint3    81,784,873 ops/s  1.00x
Mensura mat4TransformPoint3Into 86,784,462 ops/s  1.06x
Mensura affinePoint3Into       98,845,485 ops/s  1.21x
gl-matrix vec3.transformMat4   58,366,213 ops/s  0.71x
wgpu-matrix vec3.transformMat4 60,165,576 ops/s  0.74x

ray/aabb
Mensura rayAabbHitDistance     56,903,537 ops/s  1.00x

f32 write
gpu vec3WriteFloat32          121,565,767 ops/s  1.00x
unsafeVec3WriteFloat32        109,878,035 ops/s  0.90x
unsafeVec3WriteDataViewF32     82,113,941 ops/s  0.68x
gpu mat4WriteFloat32          103,233,266 ops/s  0.85x
unsafeMat4WriteFloat32        110,558,320 ops/s  0.91x
unsafeMat4WriteDataViewF32     30,010,924 ops/s  0.25x
```

## Reading The Results

- `Into` paths are the meaningful hot-loop win: `vec3` and `mat4` reuse outputs
  and avoid repeated object/array allocation.
- On this Node/V8 run, Mensura `Into` paths are competitive with or faster than
  the matching `gl-matrix` and `wgpu-matrix` cases measured here.
- `mat4TransformAffinePoint3Into` is the preferred hot path for ordinary
  model/view transforms when the matrix has no perspective row.
- `unsafe` does not automatically mean faster. It means unchecked layout access
  for generated code and binary projections. DataView writes are useful for
  exact byte layout, not for raw speed against `Float32Array`.
- Snapshot numbers are machine- and runtime-sensitive. Compare relative numbers
  from the same run, not absolute ops/sec across machines.
