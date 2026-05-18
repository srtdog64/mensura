# Floating-Point Loss Functions

## Purpose

Mensura treats numeric conversion loss as first-class data. Geometry code often
rounds JavaScript `number` values to `f32` because GPU buffers, WGSL shaders,
WebGL attributes, and many binary projections operate on 32-bit floats. That
conversion is not just a cast. It is a lossy projection.

Mensura models that projection as a loss function.

```txt
round32(x) = Math.fround(x)
loss32(x) = loss between x and round32(x)
```

## Loss Terms

For an input value `x`:

```txt
y = round32(x)
```

Mensura reports:

```txt
absolute_loss(x) = |x - y|
relative_loss(x) = |x - y| / |x|
epsilon32(y)     = local f32 spacing around y
ulp_loss(x)      = absolute_loss(x) / epsilon32(y)
```

The public API is:

```ts
import { conversionLossF32, lossF32 } from "@exornea/mensura";

const loss = conversionLossF32(1 + Number.EPSILON);
const same = lossF32(1 + Number.EPSILON);
```

`lossF32` is an alias for `conversionLossF32`. The longer name is clearer at API
boundaries; the shorter name is useful when writing formulas or tests.

## Return Shape

```ts
interface Float32ConversionLoss {
  readonly input: number;
  readonly rounded: number;
  readonly exact: boolean;
  readonly finite: boolean;
  readonly absolute: number;
  readonly relative: number;
  readonly epsilon: number;
  readonly ulps: number;
}
```

## Interpretation

- `absolute` answers: how far did the value move?
- `relative` answers: how large is that movement compared with the input?
- `epsilon` answers: what is the local spacing between nearby `f32` values?
- `ulps` answers: how many local representable steps does the loss represent?

This is intentionally more explicit than a single global epsilon. A single
epsilon hides magnitude effects. Local spacing changes as the exponent changes.

## Edge Policy

- `NaN` loss is not accepted as equal to itself.
- `Infinity` can only be exactly equal to the same infinity.
- `+0` and `-0` are treated as equal for ULP distance.
- Subnormal values are part of the P0 test matrix.

## Why This Matters

The same loss function will later be used by:

- transform compose/decompose tests
- ray and plane intersection thresholds
- frustum culling tolerance
- grid/world coordinate conversion
- GPU buffer packing checks
- Zeno renderer-facing benchmarks

Mensura should expose the loss instead of burying it in ad hoc epsilon checks.
