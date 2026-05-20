export type MensuraErrorStage =
  | "BvhBuild"
  | "DataViewProjection"
  | "EpaExpansion"
  | "GjkIteration"
  | "Measure"
  | "MprIteration"
  | "Transform"
  | "ValidateInput"
  | "Validation";

export type MensuraErrorCode =
  | "BVH_EMPTY_PRIMITIVES"
  | "DATA_INVALID_BYTE_RANGE"
  | "DATA_OFFSET_OUT_OF_RANGE"
  | "DATA_OFFSET_UNALIGNED"
  | "EPA_DEGENERATE_SIMPLEX"
  | "EPA_MAX_ITERATIONS"
  | "GJK_MAX_ITERATIONS"
  | "MEASURE_DEGENERATE"
  | "MEASURE_EMPTY_DOMAIN"
  | "MPR_MAX_ITERATIONS"
  | "TRANSFORM_DEGENERATE_BASIS"
  | "TRANSFORM_SINGULAR"
  | "VALIDATION_BIAS_OUT_OF_BUDGET"
  | "VALIDATION_BIAS_SAMPLE_OUT_OF_RANGE"
  | "VALIDATION_DEGENERATE_PLANE"
  | "VALIDATION_DEGENERATE_RAY"
  | "VALIDATION_DEGENERATE_TRIANGLE"
  | "VALIDATION_EMPTY_AABB"
  | "VALIDATION_F32_UNSTABLE"
  | "VALIDATION_INVALID_FORMAT"
  | "VALIDATION_INVALID_RADIUS"
  | "VALIDATION_INVALID_RANDOM_DISTRIBUTION"
  | "VALIDATION_INVALID_RANDOM_EXPONENT"
  | "VALIDATION_INVALID_RANGE"
  | "VALIDATION_INVALID_RNG_ALGORITHM"
  | "VALIDATION_INVALID_SEED"
  | "VALIDATION_MAT4_NON_FINITE"
  | "VALIDATION_MAT4_SINGULAR"
  | "VALIDATION_MEASURE_ABOVE_MAX"
  | "VALIDATION_MEASURE_BELOW_MIN"
  | "VALIDATION_NON_FINITE"
  | "VALIDATION_OBB_NEGATIVE_EXTENTS"
  | "VALIDATION_OBB_NON_ORTHONORMAL"
  | "VALIDATION_OBB_ROTATION_NON_FINITE"
  | "VALIDATION_OBSERVATION_EMPTY"
  | "VALIDATION_OBSERVATION_INSUFFICIENT"
  | "VALIDATION_OBSERVATION_MISSING_ANCHOR"
  | "VALIDATION_OBSERVATION_MISSING_SEED"
  | "VALIDATION_OBSERVATION_UNSTABLE"
  | "VALIDATION_VEC3_NON_FINITE";

export interface MensuraError {
  readonly code: MensuraErrorCode;
  readonly message: string;
  readonly stage: MensuraErrorStage;
  readonly retryable?: boolean;
  readonly cause?: unknown;
  readonly meta?: Record<string, unknown>;
}

export type AppError = MensuraError;

export type Result<T, E = MensuraError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface ErrorInput {
  readonly code: MensuraErrorCode;
  readonly message: string;
  readonly stage: MensuraErrorStage;
  readonly retryable?: boolean;
  readonly cause?: unknown;
  readonly meta?: Record<string, unknown>;
}

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never, E = MensuraError>(error: E): Result<T, E> => ({ ok: false, error });

export function mensuraError(input: ErrorInput): MensuraError {
  return input;
}

export const andThen = <A, B, E>(r: Result<A, E>, f: (a: A) => Result<B, E>): Result<B, E> =>
  r.ok ? f(r.value) : r;

export const mapErr = <T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> =>
  r.ok ? r : { ok: false, error: f(r.error) };

export const isOk = <T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } => !r.ok;

export function matchResult<T, E, R>(
  r: Result<T, E>,
  arms: {
    readonly ok: (value: T) => R;
    readonly err: (error: E) => R;
  }
): R {
  return r.ok ? arms.ok(r.value) : arms.err(r.error);
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/**
 * Assertion-style boundary helper. Throws on failure.
 *
 * Keep this out of library hot paths and use `result.ok`, `matchResult`, or
 * `unwrapOr` when failures should remain data.
 */
export function unwrap<T, E extends MensuraError = MensuraError>(r: Result<T, E>, hint?: string): T {
  if (r.ok) {
    return r.value;
  }

  const reason = `${r.error.stage}/${r.error.code}: ${r.error.message}`;
  throw new Error(hint ? `${hint}: ${reason}` : reason);
}
