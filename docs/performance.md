# Performance

Mensura keeps allocation-free `Into` APIs beside immutable object APIs. The
benchmark runner compares those paths against simple local baselines and
unchecked projection helpers.

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
naive object baseline          32,969,678 ops/s  1.00x
Mensura add3                   35,917,089 ops/s  1.09x
Mensura add3Into               55,965,659 ops/s  1.70x

vec3 normalize
naive object baseline          27,594,504 ops/s  1.00x
Mensura normalize3             22,686,900 ops/s  0.82x
Mensura normalize3Into         44,216,288 ops/s  1.60x

mat4 multiply
Mensura mat4Multiply           14,428,599 ops/s  1.00x
Mensura mat4MultiplyInto       24,675,030 ops/s  1.71x

mat4 transform
Mensura mat4TransformPoint3    37,828,922 ops/s  1.00x
Mensura mat4TransformPoint3Into 42,561,885 ops/s  1.13x

ray/aabb
Mensura rayAabbHitDistance     30,463,471 ops/s  1.00x

f32 write
gpu vec3WriteFloat32           70,217,816 ops/s  1.00x
unsafeVec3WriteFloat32         57,967,654 ops/s  0.83x
unsafeVec3WriteDataViewF32     47,756,860 ops/s  0.68x
unsafeMat4WriteDataViewF32     14,080,699 ops/s  0.20x
```

## Reading The Results

- `Into` paths are the meaningful hot-loop win: `vec3` and `mat4` reuse outputs
  and avoid repeated object/array allocation.
- `unsafe` does not automatically mean faster. It means unchecked layout access
  for generated code and binary projections. DataView writes are useful for
  exact byte layout, not for raw speed against `Float32Array`.
- Snapshot numbers are machine- and runtime-sensitive. Compare relative numbers
  from the same run, not absolute ops/sec across machines.
