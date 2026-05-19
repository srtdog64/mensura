import type { Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { ValidationOptions } from "./index.js";

const DEFAULT_STAGE = "Validation";
const UINT32_MAX = 0xffffffff;
const FNV1A_OFFSET = 0x811c9dc5;
const FNV1A_PRIME = 0x01000193;
const FLOAT_SCALE = 0x100000000;
const LCG_A = 1664525;
const LCG_C = 1013904223;

export const DETERMINISTIC_RNG_ALGORITHMS = ["lcg32", "xorshift32", "mulberry32"] as const;
export type DeterministicRngAlgorithm = (typeof DETERMINISTIC_RNG_ALGORITHMS)[number];

export const RANDOM_DISTRIBUTIONS = [
  "uniform",
  "center-biased",
  "edge-biased",
  "low-biased",
  "high-biased",
  "gaussian",
  "triangular"
] as const;
export type RandomDistribution = (typeof RANDOM_DISTRIBUTIONS)[number];

export interface DeterministicRngOptions extends ValidationOptions {
  readonly algorithm?: DeterministicRngAlgorithm;
}

export interface RandomSampleOptions {
  readonly distribution?: RandomDistribution;
  /**
   * Bias strength for edge/low/high distributions.
   *
   * `2` is intentionally the default: it is strong enough to reveal boundary
   * sensitivity in stress tests without collapsing most samples onto a single
   * endpoint.
   */
  readonly exponent?: number;
}

export interface DeterministicRng {
  readonly seed: number;
  readonly algorithm: DeterministicRngAlgorithm;
  nextUint32(): number;
  nextFloat(): number;
  sample(options?: RandomSampleOptions): number;
  range(min: number, max: number, options?: RandomSampleOptions): number;
}

/**
 * Validate a numeric seed and normalize it to an unsigned 32-bit integer.
 *
 * Use this at test, benchmark, generated-input, and serialized-scene
 * boundaries when a seed must reproduce the exact same input sequence later.
 */
export function validateSeed(value: number, options: ValidationOptions = {}): Result<number> {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return seedError("VALIDATION_INVALID_SEED", `${label(options)} seed must be a finite integer`, options, { value });
  }

  if (value < 0 || value > UINT32_MAX) {
    return seedError("VALIDATION_INVALID_SEED", `${label(options)} seed must fit uint32`, options, {
      value,
      min: 0,
      max: UINT32_MAX
    });
  }

  return ok(value >>> 0);
}

export function validateRngAlgorithm(
  value: string,
  options: ValidationOptions = {}
): Result<DeterministicRngAlgorithm> {
  if (isDeterministicRngAlgorithm(value)) {
    return ok(value);
  }

  return seedError("VALIDATION_INVALID_RNG_ALGORITHM", `${label(options)} must be a supported RNG algorithm`, options, {
    value,
    allowed: DETERMINISTIC_RNG_ALGORITHMS
  });
}

export function validateRandomDistribution(
  value: string,
  options: ValidationOptions = {}
): Result<RandomDistribution> {
  if (isRandomDistribution(value)) {
    return ok(value);
  }

  return seedError(
    "VALIDATION_INVALID_RANDOM_DISTRIBUTION",
    `${label(options)} must be a supported random distribution`,
    options,
    {
      value,
      allowed: RANDOM_DISTRIBUTIONS
    }
  );
}

/**
 * Deterministically derive a uint32 seed from a stable string label.
 *
 * This is FNV-1a over UTF-16 code units. It is intentionally simple and stable
 * for reproducibility; it is not a hashing or security primitive.
 */
export function seedFromString(value: string): number {
  let hash = FNV1A_OFFSET;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, FNV1A_PRIME);
  }
  return hash >>> 0;
}

/**
 * Create a small deterministic RNG from a validated uint32 seed.
 *
 * The generator is the Numerical Recipes LCG used by Mensura stress tests:
 * `state = state * 1664525 + 1013904223 (mod 2^32)`.
 */
export function createDeterministicRng(
  seed: number,
  optionsOrAlgorithm: DeterministicRngOptions | DeterministicRngAlgorithm = {}
): DeterministicRng {
  const normalized = seed >>> 0;
  const algorithm =
    typeof optionsOrAlgorithm === "string" ? optionsOrAlgorithm : optionsOrAlgorithm.algorithm ?? "lcg32";
  let state = normalized;
  const next = createNextUint32(() => state, (value) => {
    state = value;
  }, algorithm);

  return {
    seed: normalized,
    algorithm,
    nextUint32() {
      return next();
    },
    nextFloat() {
      return next() / FLOAT_SCALE;
    },
    sample(options: RandomSampleOptions = {}) {
      return sampleUnit(this, options);
    },
    range(min: number, max: number, options: RandomSampleOptions = {}) {
      return min + (max - min) * sampleUnit(this, options);
    }
  };
}

export function createValidatedDeterministicRng(
  seed: number,
  options: DeterministicRngOptions = {}
): Result<DeterministicRng> {
  const validSeed = validateSeed(seed, options);
  if (!validSeed.ok) {
    return validSeed;
  }

  const algorithm = options.algorithm ?? "lcg32";
  const validAlgorithm = validateRngAlgorithm(algorithm, withLabel(options, `${label(options)}.algorithm`));
  if (!validAlgorithm.ok) {
    return validAlgorithm;
  }

  return ok(createDeterministicRng(validSeed.value, validAlgorithm.value));
}

export function sampleDeterministicUnit(rng: DeterministicRng, options: RandomSampleOptions = {}): Result<number> {
  const distribution = options.distribution ?? "uniform";
  const validDistribution = validateRandomDistribution(distribution, { label: "distribution" });
  if (!validDistribution.ok) {
    return validDistribution;
  }

  const exponent = options.exponent ?? 2;
  if (!Number.isFinite(exponent) || exponent <= 0) {
    return seedError("VALIDATION_INVALID_RANDOM_EXPONENT", "random exponent must be finite and positive", {}, {
      exponent
    });
  }

  return ok(sampleUnit(rng, { distribution: validDistribution.value, exponent }));
}

export function sampleDeterministicRange(
  rng: DeterministicRng,
  min: number,
  max: number,
  options: RandomSampleOptions = {}
): Result<number> {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return seedError("VALIDATION_NON_FINITE", "random range bounds must be finite", {}, { min, max });
  }

  const unit = sampleDeterministicUnit(rng, options);
  if (!unit.ok) {
    return unit;
  }

  return ok(min + (max - min) * unit.value);
}

// -----------------------------------------------------------------------------
// Integer and shuffle primitives
// -----------------------------------------------------------------------------

/**
 * Inclusive integer in `[min, max]`. The implementation rejects values from the
 * top of the uint32 range that would skew the distribution, so the result is
 * exactly uniform over `(max - min + 1)` integers regardless of range size.
 *
 * Caller should pre-validate that `min` and `max` are finite integers; the
 * function returns a `Result` so non-integer or inverted ranges are observable.
 */
export function sampleDeterministicInt(
  rng: DeterministicRng,
  min: number,
  max: number
): Result<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return seedError("VALIDATION_INVALID_RANGE", "random int range must be integer-valued", {}, { min, max });
  }
  if (min > max) {
    return seedError("VALIDATION_INVALID_RANGE", "random int range must satisfy min <= max", {}, { min, max });
  }

  // (max - min + 1) is bounded; cast through Number is safe because we already
  // know both ends are finite integers.
  const span = max - min + 1;
  if (span <= 0 || span > UINT32_MAX + 1) {
    return seedError("VALIDATION_INVALID_RANGE", "random int range exceeds uint32 span", {}, {
      min,
      max,
      span
    });
  }

  // Rejection sampling: discard draws inside the bias zone at the top of the
  // uint32 range. `limit` is the largest multiple of `span` that fits in
  // uint32 + 1, so every accepted draw maps to exactly one integer in span.
  const limit = Math.floor((UINT32_MAX + 1) / span) * span;
  let draw = rng.nextUint32();
  while (draw >= limit) {
    draw = rng.nextUint32();
  }
  return ok(min + (draw % span));
}

/**
 * Fisher-Yates shuffle in place. Returns the same array reference for chaining.
 *
 * The shuffle consumes one RNG draw per index from the tail down; replaying the
 * same seed produces the exact same permutation. Use this in stress tests to
 * keep the iteration order deterministic without sorting.
 */
export function shuffleInPlace<T>(rng: DeterministicRng, values: T[]): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const swap = sampleDeterministicInt(rng, 0, i);
    if (!swap.ok) {
      // sampleDeterministicInt only fails on invalid range, never on a derived
      // `[0, i]` for i >= 1. Skip the swap if it ever does.
      continue;
    }
    const j = swap.value;
    const tmp = values[i];
    values[i] = values[j];
    values[j] = tmp;
  }
  return values;
}

// -----------------------------------------------------------------------------
// Geometric samplers
// -----------------------------------------------------------------------------

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface AabbLike {
  readonly min: { readonly x: number; readonly y: number; readonly z: number };
  readonly max: { readonly x: number; readonly y: number; readonly z: number };
}

/**
 * Uniform direction on the unit sphere `S^2`.
 *
 * Marsaglia-style parameterisation: `z` is uniform in `[-1, 1]`, the azimuth
 * is uniform in `[0, 2π)`. The horizontal radius `r = sqrt(1 - z^2)` keeps the
 * area element correct so the result is uniform per solid angle, not biased
 * toward the poles.
 *
 * Result is written into `out` and aliasing-safe.
 */
export function sampleUnitDirection3Into(rng: DeterministicRng, out: Vec3Like): Vec3Like {
  const z = rng.nextFloat() * 2 - 1;
  const angle = rng.nextFloat() * TWO_PI;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  out.x = r * Math.cos(angle);
  out.y = r * Math.sin(angle);
  out.z = z;
  return out;
}

/**
 * Uniform point in the unit ball `B^3`.
 *
 * Combines a direction on `S^2` with a radius drawn so the volume element is
 * uniform. `r = u^(1/3)` is the inverse CDF of the radial marginal, so taking
 * `u ~ U(0, 1)` produces a uniform distribution over the ball volume.
 *
 * Result is written into `out` and aliasing-safe.
 */
export function sampleInUnitBall3Into(rng: DeterministicRng, out: Vec3Like): Vec3Like {
  sampleUnitDirection3Into(rng, out);
  const r = Math.cbrt(rng.nextFloat());
  out.x *= r;
  out.y *= r;
  out.z *= r;
  return out;
}

/**
 * Uniform point inside an AABB. Empty AABB (any component with `min > max`)
 * returns `VALIDATION_EMPTY_AABB` so the caller can branch on it.
 *
 * Writes into `out` and returns the result wrapped in `Result`.
 */
export function sampleInAabbInto(
  rng: DeterministicRng,
  box: AabbLike,
  out: Vec3Like,
  options: RandomSampleOptions = {}
): Result<Vec3Like> {
  if (box.min.x > box.max.x || box.min.y > box.max.y || box.min.z > box.max.z) {
    return seedError("VALIDATION_EMPTY_AABB", "sampleInAabb requires a non-empty AABB", {}, {
      min: box.min,
      max: box.max
    });
  }

  const ux = sampleDeterministicUnit(rng, options);
  if (!ux.ok) return ux;
  const uy = sampleDeterministicUnit(rng, options);
  if (!uy.ok) return uy;
  const uz = sampleDeterministicUnit(rng, options);
  if (!uz.ok) return uz;

  out.x = box.min.x + (box.max.x - box.min.x) * ux.value;
  out.y = box.min.y + (box.max.y - box.min.y) * uy.value;
  out.z = box.min.z + (box.max.z - box.min.z) * uz.value;
  return ok(out);
}

// -----------------------------------------------------------------------------
// Stream split / fork
// -----------------------------------------------------------------------------

/**
 * Fork a deterministic RNG into a named sub-stream. The child seed is derived
 * from the parent's current state and the label, so two children with
 * different labels diverge immediately while two children with the same label
 * stay reproducible.
 *
 * Use this when a stress test spawns several workers or pipelines that each
 * need their own independent sequence under the same top-level seed. Each
 * fork advances the parent stream once so subsequent parent draws also stay
 * deterministic and do not overlap with the children.
 */
export function forkRng(
  rng: DeterministicRng,
  label: string,
  options: DeterministicRngOptions = {}
): DeterministicRng {
  const mix = rng.nextUint32();
  const childSeed = (seedFromString(label) ^ mix) >>> 0;
  return createDeterministicRng(childSeed, options.algorithm ?? rng.algorithm);
}

// -----------------------------------------------------------------------------
// Bias diagnostics
// -----------------------------------------------------------------------------

export interface SampleSummary {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly variance: number;
  readonly stddev: number;
}

/**
 * One-pass min/max/mean/variance over a numeric sample. Variance uses Welford's
 * online algorithm so single-pass batches stay numerically stable across long
 * stress runs. Returns `count = 0` and zeros for an empty input — the caller
 * should typically guard.
 */
export function summarizeSamples(samples: ArrayLike<number>): SampleSummary {
  const count = samples.length;
  if (count === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, variance: 0, stddev: 0 };
  }

  let min = samples[0];
  let max = samples[0];
  let mean = 0;
  let m2 = 0;
  for (let i = 0; i < count; i++) {
    const value = samples[i];
    if (value < min) min = value;
    if (value > max) max = value;
    const delta = value - mean;
    mean += delta / (i + 1);
    m2 += delta * (value - mean);
  }
  const variance = count > 1 ? m2 / (count - 1) : 0;
  return { count, min, max, mean, variance, stddev: Math.sqrt(variance) };
}

export interface UniformBiasOptions {
  /** Number of buckets; default 16. Higher values catch finer bias at higher
   * variance cost. */
  readonly bins?: number;
  /** Lower bound of the expected sample range. Default 0. */
  readonly min?: number;
  /** Upper bound (exclusive). Default 1. */
  readonly max?: number;
  /**
   * Maximum acceptable relative deviation per bin. A bin failing
   * `|observed - expected| / expected > tolerance` triggers
   * `VALIDATION_BIAS_OUT_OF_BUDGET`. Default `0.25` (25% per bin) — strict
   * enough to catch real bias on N >= 1024 samples, loose enough that a
   * correctly-uniform RNG passes consistently.
   */
  readonly maxRelativeDeviation?: number;
}

export interface UniformBiasReport {
  readonly counts: readonly number[];
  readonly expectedPerBin: number;
  readonly maxRelativeDeviation: number;
  readonly worstBin: number;
}

/**
 * Diagnose whether a numeric sample looks uniform on `[min, max)`. Builds an
 * equal-width histogram with `bins` buckets and reports the worst per-bin
 * relative deviation from the expected count. Returns `Result.error` with
 * `VALIDATION_BIAS_OUT_OF_BUDGET` when the deviation exceeds the budget.
 *
 * This is a coarse uniformity check, not a formal statistical test. It is
 * deliberately tunable rather than significance-based so stress tests can
 * encode a domain-specific "obviously biased" threshold and fail fast.
 */
export function validateUniformBias(
  samples: ArrayLike<number>,
  options: UniformBiasOptions = {}
): Result<UniformBiasReport> {
  const bins = options.bins ?? 16;
  const min = options.min ?? 0;
  const max = options.max ?? 1;
  const tolerance = options.maxRelativeDeviation ?? 0.25;

  if (!Number.isInteger(bins) || bins <= 0) {
    return seedError("VALIDATION_INVALID_RANGE", "bins must be a positive integer", {}, { bins });
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return seedError("VALIDATION_INVALID_RANGE", "bias range must satisfy min < max with finite bounds", {}, {
      min,
      max
    });
  }

  const count = samples.length;
  if (count === 0) {
    return seedError("VALIDATION_INVALID_RANGE", "bias diagnostics require at least one sample", {}, { count });
  }

  const counts = new Array<number>(bins).fill(0);
  const width = max - min;
  for (let i = 0; i < count; i++) {
    const value = samples[i];
    if (!Number.isFinite(value) || value < min || value >= max) {
      return seedError(
        "VALIDATION_BIAS_SAMPLE_OUT_OF_RANGE",
        "sample fell outside the declared bias range",
        {},
        { index: i, value, min, max }
      );
    }
    const slot = Math.min(bins - 1, Math.floor(((value - min) / width) * bins));
    counts[slot]++;
  }

  const expected = count / bins;
  let worstBin = 0;
  let worstDeviation = 0;
  for (let i = 0; i < bins; i++) {
    const deviation = Math.abs(counts[i] - expected) / expected;
    if (deviation > worstDeviation) {
      worstDeviation = deviation;
      worstBin = i;
    }
  }

  const report: UniformBiasReport = {
    counts,
    expectedPerBin: expected,
    maxRelativeDeviation: worstDeviation,
    worstBin
  };

  if (worstDeviation > tolerance) {
    return seedError(
      "VALIDATION_BIAS_OUT_OF_BUDGET",
      "sample distribution deviates from uniform beyond the configured tolerance",
      {},
      {
        bins,
        count,
        expectedPerBin: expected,
        worstBin,
        worstBinCount: counts[worstBin],
        maxRelativeDeviation: worstDeviation,
        tolerance
      }
    );
  }

  return ok(report);
}

function label(options: ValidationOptions): string {
  return options.label ?? "value";
}

function stage(options: ValidationOptions): string {
  return options.stage ?? DEFAULT_STAGE;
}

function withLabel<T extends ValidationOptions>(options: T, nextLabel: string): ValidationOptions {
  return {
    label: nextLabel,
    stage: stage(options)
  };
}

function isDeterministicRngAlgorithm(value: string): value is DeterministicRngAlgorithm {
  return (DETERMINISTIC_RNG_ALGORITHMS as readonly string[]).includes(value);
}

function isRandomDistribution(value: string): value is RandomDistribution {
  return (RANDOM_DISTRIBUTIONS as readonly string[]).includes(value);
}

function createNextUint32(
  getState: () => number,
  setState: (value: number) => void,
  algorithm: DeterministicRngAlgorithm
): () => number {
  switch (algorithm) {
    case "lcg32":
      // Stable legacy stream. Keep constants fixed so old stress seeds replay.
      return () => {
        const value = (Math.imul(getState(), LCG_A) + LCG_C) >>> 0;
        setState(value);
        return value;
      };
    case "xorshift32":
      return () => {
        const value = xorshift32(getState());
        setState(value);
        return value;
      };
    case "mulberry32":
      return () => {
        const nextState = (getState() + 0x6d2b79f5) >>> 0;
        setState(nextState);
        return mulberry32Output(nextState);
      };
  }
}

function xorshift32(state: number): number {
  let x = state;
  if (x === 0) {
    x = 0x6d2b79f5;
  }
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function mulberry32Output(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

function sampleUnit(rng: DeterministicRng, options: RandomSampleOptions): number {
  const distribution = options.distribution ?? "uniform";
  const exponent = options.exponent ?? 2;

  switch (distribution) {
    case "uniform":
      return rng.nextFloat();
    case "center-biased":
      return (rng.nextFloat() + rng.nextFloat()) * 0.5;
    case "edge-biased": {
      const side = rng.nextFloat() < 0.5;
      const edge = Math.pow(rng.nextFloat(), exponent) * 0.5;
      return side ? edge : 1 - edge;
    }
    case "low-biased":
      return Math.pow(rng.nextFloat(), exponent);
    case "high-biased":
      return 1 - Math.pow(rng.nextFloat(), exponent);
    case "gaussian":
      // Box-Muller transform into unit interval: take N(0,1), shift to mean 0.5,
      // scale by 1/6 so +/- 3 sigma lands inside [0, 1], and clamp the tails so
      // the result stays inside the unit interval contract used by `range()`.
      return clampUnit(0.5 + boxMullerStandardNormal(rng) * GAUSSIAN_UNIT_SCALE);
    case "triangular": {
      // Symmetric triangular distribution on [0, 1] with peak at 0.5. Equivalent
      // to averaging two uniform samples, but kept as an explicit case for
      // documentation and for sampler distinctness in stress tests.
      const u1 = rng.nextFloat();
      const u2 = rng.nextFloat();
      return (u1 + u2) * 0.5;
    }
  }
}

const GAUSSIAN_UNIT_SCALE = 1 / 6;
const TWO_PI = Math.PI * 2;

function boxMullerStandardNormal(rng: DeterministicRng): number {
  // Standard Box-Muller. Take u1 from (0, 1] so log is finite; pair it with a
  // uniform angle. Cheap enough for stress generation; if a hot loop ever needs
  // millions of normals we should switch to a packed unsafe kernel.
  let u1 = rng.nextFloat();
  if (u1 <= 0) {
    u1 = Number.MIN_VALUE;
  }
  const u2 = rng.nextFloat();
  const radius = Math.sqrt(-2 * Math.log(u1));
  return radius * Math.cos(TWO_PI * u2);
}

function clampUnit(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function seedError<T>(
  code: string,
  message: string,
  options: ValidationOptions,
  meta: Record<string, unknown>
): Result<T> {
  return err({
    code,
    message,
    stage: stage(options),
    meta
  });
}
