# Math Theory

This document records the formulas and source trail behind Mensura's math
surface. API signatures live in source files and usage intent lives in
[api-guide.md](api-guide.md). This file answers a narrower question:

```txt
Which mathematical identity or algorithm is this based on, and what did
Mensura change for its policy?
```

When an API is math-heavy, release review should be able to find three things
here: the formula, the source, and the Mensura-specific adaptation.

---

## 1. Numeric Model

JavaScript numbers are IEEE-754 binary64. WebGPU buffers and most packed GPU
interop paths use binary32. That conversion is lossy, so Mensura exposes the
loss as data instead of hiding it inside a tolerance.

For a JavaScript number `x` and its binary32 projection `x32 = Math.fround(x)`:

```txt
absolute(x)  = abs(x - x32)
relative(x)  = absolute(x) / abs(x)       (0 when x = 0)
epsilonAt(x) = binary32 ULP near abs(x)
ulps(x)      = absolute(x) / epsilonAt(x)
```

Binary32 has 23 stored fraction bits, so the ULP near magnitude `2^e` is
approximately `2^(e - 23)` for normalized values. Mensura reports
`{ absolute, relative, epsilonAt, ulps }` so boundary code can decide whether a
value is stable enough for a GPU or binary projection.

Source basis: Goldberg's floating-point survey and IEEE-style rounding-error
analysis.

---

## 2. Coordinate And Transform Theory

Mensura uses:

```txt
world          : right-handed, +Y up, -Z forward
matrix storage : column-major
math convention: column-vector, p' = M * p
composition    : M = T * R * S
clip depth     : WebGPU / DirectX style NDC Z = 0..1
```

Memory layout and multiplication convention are separate decisions:

```txt
row-major / column-major     = storage layout
row-vector / column-vector   = algebra convention
```

Mensura keeps one internal convention and pushes external differences into
named adapters or named helpers. That is why WebGPU depth is the default, while
OpenGL/WebGL `-1..1` depth must be explicit in function names.

### Reverse-Z

Standard perspective maps `near -> 0`, `far -> 1` after the w-divide. Reverse-Z
maps `near -> 1`, `far -> 0`. The motivation is depth precision: float depth
has more representable values near zero, and reverse-Z places the far range in
the region where the hyperbolic projection wastes less practical precision.

Mensura's reverse-Z WebGPU form uses the same coordinate policy and validates
finite finite-far divisions separately from the `far = Infinity` branch.

### Viewport Project / Unproject

`mat4ProjectPoint3WebGpu` applies the world-view-projection matrix, performs
the homogeneous w-divide, then maps WebGPU NDC to top-down viewport pixels:

```txt
screen.x = viewport.x + (ndc.x + 1) * 0.5 * viewport.width
screen.y = viewport.y + (1 - ndc.y) * 0.5 * viewport.height
screen.z = ndc.z
```

`mat4UnprojectPoint3WebGpu` performs the inverse mapping with a
caller-provided inverse world-view-projection matrix:

```txt
ndc.x = ((screen.x - viewport.x) / viewport.width) * 2 - 1
ndc.y = 1 - ((screen.y - viewport.y) / viewport.height) * 2
ndc.z = screen.z
world = inverseWvp * vec4(ndc, 1)
```

The API asks the caller for the inverse matrix so a picking path can invert
once per camera update instead of once per point.

### Signed Distance Helpers

Signed distance helpers use the common convention:

```txt
negative = point is inside the shape
zero     = point lies on the boundary
positive = point is outside the shape
```

For a sphere:

```txt
sdSphere(p) = |p - center| - radius
```

For an AABB, Mensura uses the standard box signed-distance form with
`q = abs(p - center) - halfExtent`:

```txt
outside = length(max(q, 0))
inside  = min(max(q.x, q.y, q.z), 0)
sdAabb  = outside + inside
```

Empty AABBs and negative-radius spheres return `+Infinity`, preserving the
existing "empty domains overlap nothing" convention.

---

## 3. Empty Domains

Hot-path measure functions avoid allocation and exceptions, but they still need
mathematically consistent empty-domain behavior.

Distance to the empty set is `+Infinity` by convention:

```txt
dist(p, empty) = inf({ |p - q| : q in empty }) = +Infinity
```

So `aabbDistanceSqToPoint(emptyBox, p)` returns `+Infinity`. Predicates such
as `distSq <= rSq` naturally evaluate to `false`.

Closest point on the empty set is different:

```txt
argmin({ |p - q| : q in empty })
```

has no element to return. Raw closest-point helpers therefore require a valid
domain, while checked variants return a `Result` error such as
`MEASURE_EMPTY_DOMAIN`.

---

## 4. Deterministic RNGs

Mensura RNGs are for stress tests, fixtures, benchmark input generation, and
asset replay. They are not cryptographic RNGs and not gameplay randomness.

### 4.1 `seedFromString`

`seedFromString(label)` uses 32-bit FNV-1a over UTF-16 code units. FNV is a
small non-cryptographic hash. Mensura uses it only to map stable labels to
uint32 seeds.

```txt
hash = offset_basis
for code_unit in label:
  hash = hash xor code_unit
  hash = hash * FNV_prime mod 2^32
```

### 4.2 `lcg32`

The default generator is the Numerical Recipes LCG:

```txt
state' = (state * 1664525 + 1013904223) mod 2^32
```

It is fast and stable for replay, but its low bits are weak. Mensura keeps it
as the default for backwards-compatible stress seeds, not because it is the
best statistical generator.

### 4.3 `xorshift32`

Marsaglia's 32-bit xorshift recurrence:

```txt
x ^= x << 13
x ^= x >>> 17
x ^= x << 5
```

The all-zero state is a fixed point, so Mensura swaps in a non-zero state if a
stream would otherwise enter zero.

### 4.4 `mulberry32`

`mulberry32` is a small 32-bit Weyl-increment generator plus integer output
mixing. It is useful for deterministic fixtures because it is compact and has
better practical sample shape than the simple LCG in many small tests.

There is no formal peer-reviewed paper for `mulberry32` that Mensura treats as
authoritative. It is documented as an implementation-backed fixture generator,
not as a statistical-quality or security claim.

---

## 5. Sampling Distributions

All unit distributions return values in `[0, 1]` or `[0, 1)`, depending on the
construction. `range(min, max, options)` then maps the unit sample linearly.

### 5.1 Uniform

Direct projection of a uint32 draw:

```txt
u = nextUint32() / 2^32
```

This gives one of `2^32` evenly spaced values in `[0, 1)`.

### 5.2 Integer Sampling Without Modulo Bias

`draw % span` is biased unless `span` divides `2^32`. Mensura uses rejection
sampling:

```txt
span  = max - min + 1
limit = floor(2^32 / span) * span
draw  = nextUint32()
while draw >= limit:
  draw = nextUint32()
return min + (draw % span)
```

Every accepted residue class then has exactly the same number of source draws.

### 5.3 Triangular / Center-Biased

The average of two independent uniforms has a triangular distribution centered
around `0.5`:

```txt
t = (u1 + u2) / 2
```

Mensura exposes both `triangular` and `center-biased`. They share the same
construction, but the names communicate different intent at call sites.

### 5.4 Low / High / Edge Bias

Mensura uses power transforms for stress-oriented bias:

```txt
low       = u^k
high      = 1 - u^k
edge side = coin flip
edge      = u^k * 0.5           or 1 - u^k * 0.5
```

This is intentionally an engineering stress distribution. It pulls samples
toward small values, large values, or both endpoints. The default
`exponent = 2` is strong enough to expose endpoint bugs without collapsing the
sample stream into only endpoints.

### 5.5 Gaussian

Mensura's `gaussian` distribution uses the Box-Muller transform:

```txt
z = sqrt(-2 * ln(u1)) * cos(2 * pi * u2)
sample = clamp(0.5 + z / 6, 0, 1)
```

`z` is standard normal. Scaling by `1/6` puts the three-sigma range near the
unit interval edges. Clamping is deliberate: stress generators must keep the
unit interval contract even when normal tails appear.

---

## 6. Geometric Sampling

### 6.1 Uniform Direction On `S^2`

Uniform latitude is wrong because the sphere surface element is not uniform in
the polar angle. Mensura samples:

```txt
z     = 2 * u1 - 1
theta = 2 * pi * u2
r     = sqrt(1 - z^2)
p     = (r * cos(theta), r * sin(theta), z)
```

This is area-uniform on the sphere. The reason is that the surface element can
be written as `dA = dz dtheta` after the cylinder projection, so `z` should be
uniform, not the latitude.

### 6.2 Uniform Point In The Unit Ball

A radius drawn directly as `r = u` is not volume-uniform. The CDF of radius in
the unit 3-ball is:

```txt
F(r) = r^3
```

So inverse-CDF sampling gives:

```txt
r = u^(1/3)
```

Mensura combines that radius with an area-uniform direction on `S^2`.

### 6.3 Uniform Point In An AABB

An AABB has separable volume element:

```txt
dV = dx dy dz
```

So Mensura samples one independent unit value per component and maps each
component into its own `[min, max]` interval. Empty AABB inputs return
`VALIDATION_EMPTY_AABB`.

---

## 7. Bias Diagnostics

### 7.1 Welford Summary

The naive variance formula:

```txt
sum(x^2) - sum(x)^2 / n
```

can lose the meaningful digits when the mean is large and the variance is
small. Mensura uses Welford's recurrence:

```txt
mean = 0
m2   = 0
for i = 1..n:
  delta = x_i - mean
  mean += delta / i
  m2   += delta * (x_i - mean)
variance = m2 / (n - 1)
```

It is one-pass, `O(n)`, and uses `O(1)` memory.

### 7.2 Uniform Bias Budget

`validateUniformBias` is an engineering check, not a formal statistical test.
It builds an equal-width histogram and compares each bin against expected count:

```txt
expected_i  = n / bins
deviation_i = abs(observed_i - expected_i) / expected_i
pass         = max(deviation_i) <= tolerance
```

This intentionally answers: "is this sample obviously not uniform for the test
that expects uniformity?" It does not claim a p-value.

---

## 8. Triangle And Intersection Theory

### 8.1 Triangle Closest Point

Triangle closest-point queries use the Voronoi-region split described by
Ericson. A point's closest location on a triangle is in one of seven regions:

```txt
A vertex, B vertex, C vertex,
AB edge, AC edge, BC edge,
or interior
```

The algorithm checks dot-product signs to identify the region and returns the
corresponding vertex, edge projection, or barycentric interior blend. Checked
variants validate that the triangle is non-degenerate before this split.

### 8.2 Ray-Triangle

The Moller-Trumbore intersection solves the ray-triangle hit using barycentric
coordinates without precomputing or storing a triangle plane:

```txt
ray(t) = origin + t * direction
tri(u,v) = a + u * (b - a) + v * (c - a)
```

The hit is valid when `t >= 0`, `u >= 0`, `v >= 0`, and `u + v <= 1`.

### 8.3 Frustum Planes

Frustum extraction combines rows/columns of the world-view-projection matrix to
obtain the six clipping planes. Mensura's extraction is adapted to its own
column-vector and WebGPU depth policy; OpenGL/WebGL depth should remain an
explicitly named variant.

---

## 9. Collision Theory

### 9.1 GJK

GJK treats convex distance as a support-mapping problem over the Minkowski
difference. Mensura's collision layer is still experimental, but the intended
contract follows the standard support-function shape: ask each convex object
for its farthest point in a direction, then iteratively refine a simplex toward
the origin.

### 9.2 MPR

Minkowski Portal Refinement also works in the Minkowski difference, but starts
from an interior point and constructs a portal intersecting the ray toward the
origin. Mensura's `mprIntersect` implements the binary intersection path:
portal discovery builds the initial tetrahedral portal, and portal refinement
replaces the active portal face with support points until the origin is inside
the portal or no further support advance is possible. The query follows the
same strict boundary policy as `gjk`: exact touching is not positive overlap.

The Mensura contract is intentionally narrower than full contact generation:

- Input is two convex support-mapped shapes, each with a caller-provided
  interior point (`center`) and `support(direction)`.
- Output is a boolean intersection decision plus diagnostic portal data.
- `portalDirection` is the final portal face direction, not a contact normal.
- Iteration exhaustion is a data failure: `Result.error.code =
  "MPR_MAX_ITERATIONS"`.
- Penetration depth and contact position remain the responsibility of EPA or a
  future dedicated MPR penetration API.

This keeps binary overlap useful while avoiding a false promise that the portal
face is already a physically meaningful contact manifold.

### 9.3 SAT / OBB / BVH

The separating axis theorem says two convex polytopes are disjoint if there is
an axis on which their projected intervals do not overlap. OBB overlap uses a
small fixed candidate axis set. BVH traversal uses cheap bounding tests to
avoid expensive primitive tests.

Mensura keeps this in experimental layers until enough randomized and
deterministic witness tests exist.

---

## 10. Source Map

| Mensura area | Formula / algorithm | Primary source | Mensura adaptation |
|---|---|---|---|
| `conversionLossF32`, ULP checks | Floating-point rounding and ULP reasoning | David Goldberg, *What Every Computer Scientist Should Know About Floating-Point Arithmetic*, ACM Computing Surveys 23(1), 1991. DOI: `10.1145/103162.103163` | Reports loss as data for policy checks. |
| `seedFromString` | FNV-1a 32-bit non-cryptographic hash | Fowler/Noll/Vo, RFC 9923, *The FNV Non-Cryptographic Hash Algorithm*, 2025. | Used only to derive deterministic labels into uint32 seeds. |
| `lcg32` | `state' = state * 1664525 + 1013904223 mod 2^32` | Press, Teukolsky, Vetterling, Flannery, *Numerical Recipes in C*, 2nd ed., section 7.1. | Default for backwards-compatible stress replay. |
| `xorshift32` | Three-shift XOR recurrence | George Marsaglia, *Xorshift RNGs*, Journal of Statistical Software 8(14), 2003. DOI: `10.18637/jss.v008.i14` | Adds zero-state guard. |
| `mulberry32` | Weyl increment plus integer output mixer | Public-domain/community implementation commonly attributed to Tommy Ettinger and bryc. | Fixture generator only; no paper-level guarantee claimed. |
| `sampleDeterministicInt` | Rejection sampling against modulo bias | Standard finite-uniform projection. | Returns `Result` for invalid integer ranges. |
| `gaussian` | Box-Muller transform | G. E. P. Box and Mervin E. Muller, *A Note on the Generation of Random Normal Deviates*, Annals of Mathematical Statistics 29(2), 1958. DOI: `10.1214/aoms/1177706645` | Shifts/scales into `[0, 1]` and clamps tails. |
| `sampleUnitDirection3Into` | Uniform sphere sampling | George Marsaglia, *Choosing a Point from the Surface of a Sphere*, Annals of Mathematical Statistics 43(2), 1972. DOI: `10.1214/aoms/1177692644` | Uses `z + azimuth` form for `S^2`. |
| `sampleInUnitBall3Into` | Radius inverse CDF `r = U^(1/3)` | Standard 3-ball volume-element derivation. | Combined with uniform direction. |
| `summarizeSamples` | Online variance | B. P. Welford, *Note on a Method for Calculating Corrected Sums of Squares and Products*, Technometrics 4(3), 1962. DOI: `10.1080/00401706.1962.10490022` | One-pass stable summary for stress diagnostics. |
| `validateUniformBias` | Histogram expected-count check | Derived from chi-square goodness-of-fit setup. | Uses relative-deviation budget, not p-values. |
| `triangleClosestPoint*` | Voronoi-region closest point | Christer Ericson, *Real-Time Collision Detection*, Morgan Kaufmann, 2005, section 5.1.5. | Checked variants guard degenerate triangles. |
| Ray-triangle intersection | Barycentric ray-triangle solve | Tomas Moller and Ben Trumbore, *Fast, Minimum Storage Ray-Triangle Intersection*, Journal of Graphics Tools 2(1), 1997. DOI: `10.1080/10867651.1997.10487468` | Applies Mensura hit-distance policy. |
| Frustum plane extraction | Extract planes from world-view-projection matrix | Gil Gribb and Klaus Hartmann, *Fast Extraction of Viewing Frustum Planes from the World-View-Projection Matrix*, 2001. | Adapted to WebGPU depth and column-vector policy. |
| Quaternion slerp / rotation curves | Spherical interpolation for rotations | Ken Shoemake, *Animating Rotation with Quaternion Curves*, SIGGRAPH 1985. DOI: `10.1145/325334.325242` | Thresholds are named constants; degenerate basis paths use `Result`. |
| GJK narrowphase | Convex distance via support mappings | Gilbert, Johnson, Keerthi, *A Fast Procedure for Computing the Distance Between Complex Objects in Three-Dimensional Space*, IEEE Journal on Robotics and Automation 4(2), 1988. DOI: `10.1109/56.2083` | Collision layer remains experimental. |
| MPR narrowphase | Portal discovery and refinement in the Minkowski difference | Gary Snethen, *XenoCollide: Complex Collision Made Simple*, Game Programming Gems 7, 2008; Daniel Fiser, `libccd` MPR implementation. | Binary `mprIntersect`; penetration/contact recovery remains separate work. |
| OBB / SAT / BVH direction | OBB overlap and hierarchy traversal | Gottschalk, Lin, Manocha, *OBBTree: A Hierarchical Structure for Rapid Interference Detection*, SIGGRAPH 1996. | Theory background for OBB/SAT/BVH policy. |

---

## 11. Source Policy

Mensura separates sources by strength:

- **Paper-backed**: cite the paper and state the exact adaptation.
- **Spec-backed**: cite the public specification and keep behavior aligned with
  that spec.
- **Implementation-backed**: cite the reference implementation or community
  origin, but do not overclaim mathematical or statistical guarantees.

When adding a math-heavy API:

1. Name the formula or algorithm.
2. Cite the paper, standard, book, or implementation reference.
3. State what Mensura changed: coordinate convention, failure behavior,
   validation threshold, output shape, or performance layout.
4. Add tests for both the formula and the Mensura-specific policy.
