export interface MensuraError {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
  readonly retryable?: boolean;
  readonly cause?: unknown;
  readonly meta?: Record<string, unknown>;
}

export type AppError = MensuraError;

export type Result<T, E = MensuraError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface ErrorInput {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
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

export function unwrap<T, E extends MensuraError = MensuraError>(r: Result<T, E>, hint?: string): T {
  if (r.ok) {
    return r.value;
  }

  const reason = `${r.error.stage}/${r.error.code}: ${r.error.message}`;
  throw new Error(hint ? `${hint}: ${reason}` : reason);
}
