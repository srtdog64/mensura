import type { MensuraErrorCode, MensuraErrorStage, Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { ValidationOptions } from "./index.js";
import { summarizeSamples } from "./reproducibility.js";

const DEFAULT_STAGE = "Validation" as const;

export interface ObservationSet {
  readonly values: ArrayLike<number>;
  readonly label?: string;
  readonly seed?: number;
  readonly unit?: string;
  readonly meta?: Record<string, unknown>;
}

export interface SuitabilityGateOptions extends ValidationOptions {
  readonly minCount?: number;
  readonly requireSeed?: boolean;
  readonly requireAnchor?: boolean;
  readonly anchor?: MeasurementAnchor;
  readonly minVariance?: number;
  readonly maxRelativeStddev?: number;
}

export interface ObservationSuitability {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly variance: number;
  readonly stddev: number;
  readonly relativeStddev: number;
  readonly label: string;
  readonly unit?: string;
  readonly seed?: number;
}

export interface Measurement {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly p75: number;
  readonly p95: number;
  readonly variance: number;
  readonly stddev: number;
  readonly relativeStddev: number;
  readonly label: string;
  readonly unit?: string;
  readonly seed?: number;
}

export interface MeasurementAnchor {
  readonly label: string;
  readonly measurement: Measurement;
  readonly version?: string;
  readonly meta?: Record<string, unknown>;
}

export interface MeasurementAnalysisOptions {
  readonly maxRelativeStddev?: number;
}

export interface MeasurementAnalysis {
  readonly stable: boolean;
  readonly relativeStddev: number;
  readonly maxRelativeStddev: number;
  readonly count: number;
}

export interface MeasurementComparisonOptions extends ValidationOptions {
  readonly maxRegressionRatio?: number;
}

export interface MeasurementComparison {
  readonly subject: Measurement;
  readonly anchor: MeasurementAnchor;
  readonly ratio: number;
  readonly delta: number;
  readonly relativeDelta: number;
}

export function checkObservationSetSuitability(
  set: ObservationSet,
  options: SuitabilityGateOptions = {}
): Result<ObservationSuitability> {
  const label = observationLabel(set, options);
  const count = set.values.length;
  const minCount = options.minCount ?? 1;

  if (count === 0) {
    return observationError("VALIDATION_OBSERVATION_EMPTY", `${label} has no observations`, options, { count });
  }

  if (!Number.isInteger(minCount) || minCount <= 0) {
    return observationError("VALIDATION_INVALID_RANGE", "minCount must be a positive integer", options, {
      minCount
    });
  }

  if (count < minCount) {
    return observationError(
      "VALIDATION_OBSERVATION_INSUFFICIENT",
      `${label} does not contain enough observations`,
      options,
      { count, minCount }
    );
  }

  for (let i = 0; i < count; i++) {
    const value = set.values[i];
    if (!Number.isFinite(value)) {
      return observationError("VALIDATION_NON_FINITE", `${label}[${i}] must be finite`, options, {
        index: i,
        value
      });
    }
  }

  if (options.requireSeed === true && set.seed === undefined) {
    return observationError("VALIDATION_OBSERVATION_MISSING_SEED", `${label} requires a reproducibility seed`, options, {
      label
    });
  }

  if (set.seed !== undefined && (!Number.isFinite(set.seed) || !Number.isInteger(set.seed))) {
    return observationError("VALIDATION_INVALID_SEED", `${label} seed must be a finite integer`, options, {
      seed: set.seed
    });
  }

  if (options.requireAnchor === true && options.anchor === undefined) {
    return observationError("VALIDATION_OBSERVATION_MISSING_ANCHOR", `${label} requires a comparison anchor`, options, {
      label
    });
  }

  const summary = summarizeSamples(set.values);
  const relativeStddev = relativeStddevOf(summary.mean, summary.stddev);
  const minVariance = options.minVariance;
  if (minVariance !== undefined && summary.variance < minVariance) {
    return observationError("VALIDATION_OBSERVATION_UNSTABLE", `${label} variance is below the suitability floor`, options, {
      variance: summary.variance,
      minVariance
    });
  }

  const maxRelativeStddev = options.maxRelativeStddev;
  if (maxRelativeStddev !== undefined && relativeStddev > maxRelativeStddev) {
    return observationError(
      "VALIDATION_OBSERVATION_UNSTABLE",
      `${label} relative stddev exceeds the suitability budget`,
      options,
      { relativeStddev, maxRelativeStddev }
    );
  }

  const result: ObservationSuitability = {
    count,
    min: summary.min,
    max: summary.max,
    mean: summary.mean,
    variance: summary.variance,
    stddev: summary.stddev,
    relativeStddev,
    label
  };

  return ok(withOptionalObservationMeta(result, set));
}

export function measureObservationSet(
  set: ObservationSet,
  options: SuitabilityGateOptions = {}
): Result<Measurement> {
  const suitability = checkObservationSetSuitability(set, options);
  if (!suitability.ok) {
    return suitability;
  }

  const sorted = new Array<number>(set.values.length);
  for (let i = 0; i < set.values.length; i++) {
    sorted[i] = set.values[i];
  }
  sorted.sort((a, b) => a - b);

  const value: Measurement = {
    count: suitability.value.count,
    min: suitability.value.min,
    max: suitability.value.max,
    mean: suitability.value.mean,
    median: quantileSorted(sorted, 0.5),
    p75: quantileSorted(sorted, 0.75),
    p95: quantileSorted(sorted, 0.95),
    variance: suitability.value.variance,
    stddev: suitability.value.stddev,
    relativeStddev: suitability.value.relativeStddev,
    label: suitability.value.label
  };

  return ok(withOptionalMeasurementMeta(value, set));
}

export function analyzeMeasurement(
  measurement: Measurement,
  options: MeasurementAnalysisOptions = {}
): MeasurementAnalysis {
  const maxRelativeStddev = options.maxRelativeStddev ?? 0.05;
  return {
    stable: measurement.relativeStddev <= maxRelativeStddev,
    relativeStddev: measurement.relativeStddev,
    maxRelativeStddev,
    count: measurement.count
  };
}

export function anchorMeasurement(
  measurement: Measurement,
  label: string = measurement.label,
  version?: string
): MeasurementAnchor {
  const anchor: MeasurementAnchor = {
    label,
    measurement
  };
  return version === undefined ? anchor : { ...anchor, version };
}

export function compareMeasurementToAnchor(
  subject: Measurement,
  anchor: MeasurementAnchor,
  options: MeasurementComparisonOptions = {}
): Result<MeasurementComparison> {
  const anchorMean = anchor.measurement.mean;
  if (!Number.isFinite(anchorMean) || anchorMean === 0) {
    return observationError("VALIDATION_INVALID_RANGE", `${anchor.label} anchor mean must be finite and non-zero`, options, {
      anchorMean
    });
  }

  const delta = subject.mean - anchorMean;
  const ratio = subject.mean / anchorMean;
  const comparison: MeasurementComparison = {
    subject,
    anchor,
    ratio,
    delta,
    relativeDelta: delta / Math.abs(anchorMean)
  };

  const maxRegressionRatio = options.maxRegressionRatio;
  if (maxRegressionRatio !== undefined && ratio > maxRegressionRatio) {
    return observationError(
      "VALIDATION_OBSERVATION_UNSTABLE",
      `${subject.label} regressed beyond the comparison budget`,
      options,
      { ratio, maxRegressionRatio, anchor: anchor.label }
    );
  }

  return ok(comparison);
}

function quantileSorted(sorted: readonly number[], q: number): number {
  if (sorted.length === 1) {
    return sorted[0];
  }
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const t = index - low;
  return sorted[low] * (1 - t) + sorted[high] * t;
}

function relativeStddevOf(mean: number, stddev: number): number {
  const scale = Math.abs(mean);
  return scale === 0 ? stddev : stddev / scale;
}

function observationLabel(set: ObservationSet, options: ValidationOptions): string {
  return options.label ?? set.label ?? "observation";
}

function stage(options: ValidationOptions): MensuraErrorStage {
  return options.stage ?? DEFAULT_STAGE;
}

function withOptionalObservationMeta(value: ObservationSuitability, set: ObservationSet): ObservationSuitability {
  let result = value;
  if (set.unit !== undefined) {
    result = { ...result, unit: set.unit };
  }
  if (set.seed !== undefined) {
    result = { ...result, seed: set.seed };
  }
  return result;
}

function withOptionalMeasurementMeta(value: Measurement, set: ObservationSet): Measurement {
  let result = value;
  if (set.unit !== undefined) {
    result = { ...result, unit: set.unit };
  }
  if (set.seed !== undefined) {
    result = { ...result, seed: set.seed };
  }
  return result;
}

function observationError<T>(
  code: MensuraErrorCode,
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
