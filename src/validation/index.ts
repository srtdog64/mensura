import type { Float32ConversionLoss } from "../core/float.js";
import { DEFAULT_FLOAT_TOLERANCE, conversionLossF32 } from "../core/float.js";
import type { MensuraError, Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { Vec3 } from "../core/vec3.js";
import { lengthSq3 } from "../core/vec3.js";
import type { Aabb } from "../geometry/aabb.js";
import { aabbIsEmpty } from "../geometry/aabb.js";
import type { Capsule } from "../geometry/capsule.js";
import type { Plane } from "../geometry/plane.js";
import type { Sphere } from "../geometry/sphere.js";
import { triangleDoubleArea } from "../measure/triangle.js";

const DEFAULT_STAGE = "Validation";

export interface ValidationOptions {
  readonly label?: string;
  readonly stage?: string;
}

export interface F32StabilityOptions extends ValidationOptions {
  readonly maxRelativeLoss?: number;
  readonly maxUlps?: number;
}

export interface StableMeasurementOptions extends F32StabilityOptions {
  readonly min?: number;
  readonly max?: number;
  readonly requireF32Stable?: boolean;
}

export interface PlaneValidationOptions extends ValidationOptions {
  readonly minNormalLengthSq?: number;
}

export interface TriangleValidationOptions extends ValidationOptions {
  readonly minDoubleArea?: number;
}

export interface TriangleValidation {
  readonly doubleArea: number;
  readonly area: number;
}

export function validateFiniteNumber(value: number, options: ValidationOptions = {}): Result<number> {
  if (!Number.isFinite(value)) {
    return validationError("VALIDATION_NON_FINITE", `${label(options)} must be finite`, options, { value });
  }

  return ok(value);
}

export function validateStableF32(value: number, options: F32StabilityOptions = {}): Result<Float32ConversionLoss> {
  const finite = validateFiniteNumber(value, options);
  if (!finite.ok) {
    return finite;
  }

  const loss = conversionLossF32(value);
  const maxRelativeLoss = options.maxRelativeLoss ?? DEFAULT_FLOAT_TOLERANCE.rel;
  const maxUlps = options.maxUlps ?? DEFAULT_FLOAT_TOLERANCE.ulps;

  if (loss.relative > maxRelativeLoss || loss.ulps > maxUlps) {
    return validationError(
      "VALIDATION_F32_UNSTABLE",
      `${label(options)} is not stable after float32 conversion`,
      options,
      {
        value,
        rounded: loss.rounded,
        relative: loss.relative,
        ulps: loss.ulps,
        maxRelativeLoss,
        maxUlps
      }
    );
  }

  return ok(loss);
}

export function validateStableMeasurement(value: number, options: StableMeasurementOptions = {}): Result<number> {
  const finite = validateFiniteNumber(value, options);
  if (!finite.ok) {
    return finite;
  }

  if (options.min !== undefined && value < options.min) {
    return validationError("VALIDATION_MEASURE_BELOW_MIN", `${label(options)} is below the accepted range`, options, {
      value,
      min: options.min
    });
  }

  if (options.max !== undefined && value > options.max) {
    return validationError("VALIDATION_MEASURE_ABOVE_MAX", `${label(options)} is above the accepted range`, options, {
      value,
      max: options.max
    });
  }

  if (options.requireF32Stable === true) {
    const stable = validateStableF32(value, options);
    if (!stable.ok) {
      return err(stable.error);
    }
  }

  return ok(value);
}

export function validateFiniteVec3(value: Vec3, options: ValidationOptions = {}): Result<Vec3> {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    return validationError("VALIDATION_VEC3_NON_FINITE", `${label(options)} must have finite components`, options, {
      x: value.x,
      y: value.y,
      z: value.z
    });
  }

  return ok(value);
}

export function validateFiniteAabb(value: Aabb, options: ValidationOptions = {}): Result<Aabb> {
  const min = validateFiniteVec3(value.min, withLabel(options, `${label(options)}.min`));
  if (!min.ok) {
    return min;
  }

  const max = validateFiniteVec3(value.max, withLabel(options, `${label(options)}.max`));
  if (!max.ok) {
    return max;
  }

  return ok(value);
}

export function validateNonEmptyAabb(value: Aabb, options: ValidationOptions = {}): Result<Aabb> {
  const finite = validateFiniteAabb(value, options);
  if (!finite.ok) {
    return finite;
  }

  if (aabbIsEmpty(value)) {
    return validationError("VALIDATION_EMPTY_AABB", `${label(options)} must be non-empty`, options, {
      min: value.min,
      max: value.max
    });
  }

  return ok(value);
}

export function validateSphere(value: Sphere, options: ValidationOptions = {}): Result<Sphere> {
  const center = validateFiniteVec3(value.center, withLabel(options, `${label(options)}.center`));
  if (!center.ok) {
    return center;
  }

  if (!Number.isFinite(value.radius) || value.radius < 0) {
    return validationError("VALIDATION_INVALID_RADIUS", `${label(options)} radius must be finite and non-negative`, options, {
      radius: value.radius
    });
  }

  return ok(value);
}

export function validateCapsule(value: Capsule, options: ValidationOptions = {}): Result<Capsule> {
  const point0 = validateFiniteVec3(value.point0, withLabel(options, `${label(options)}.point0`));
  if (!point0.ok) {
    return point0;
  }

  const point1 = validateFiniteVec3(value.point1, withLabel(options, `${label(options)}.point1`));
  if (!point1.ok) {
    return point1;
  }

  if (!Number.isFinite(value.radius) || value.radius < 0) {
    return validationError("VALIDATION_INVALID_RADIUS", `${label(options)} radius must be finite and non-negative`, options, {
      radius: value.radius
    });
  }

  return ok(value);
}

export function validatePlane(value: Plane, options: PlaneValidationOptions = {}): Result<Plane> {
  const normal = validateFiniteVec3(value.normal, withLabel(options, `${label(options)}.normal`));
  if (!normal.ok) {
    return normal;
  }

  if (!Number.isFinite(value.constant)) {
    return validationError("VALIDATION_NON_FINITE", `${label(options)} constant must be finite`, options, {
      constant: value.constant
    });
  }

  const minNormalLengthSq = options.minNormalLengthSq ?? 1e-12;
  const normalLengthSq = lengthSq3(value.normal);
  if (normalLengthSq <= minNormalLengthSq) {
    return validationError("VALIDATION_DEGENERATE_PLANE", `${label(options)} normal is degenerate`, options, {
      normalLengthSq,
      minNormalLengthSq
    });
  }

  return ok(value);
}

export function validateTriangle(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  options: TriangleValidationOptions = {}
): Result<TriangleValidation> {
  const aResult = validateFiniteVec3(a, withLabel(options, `${label(options)}.a`));
  if (!aResult.ok) {
    return aResult;
  }

  const bResult = validateFiniteVec3(b, withLabel(options, `${label(options)}.b`));
  if (!bResult.ok) {
    return bResult;
  }

  const cResult = validateFiniteVec3(c, withLabel(options, `${label(options)}.c`));
  if (!cResult.ok) {
    return cResult;
  }

  const doubleArea = triangleDoubleArea(a, b, c);
  const minDoubleArea = options.minDoubleArea ?? 0;
  if (doubleArea <= minDoubleArea) {
    return validationError("VALIDATION_DEGENERATE_TRIANGLE", `${label(options)} triangle is degenerate`, options, {
      doubleArea,
      minDoubleArea
    });
  }

  return ok({
    doubleArea,
    area: doubleArea * 0.5
  });
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

function validationError<T>(
  code: string,
  message: string,
  options: ValidationOptions,
  meta: Record<string, unknown>
): Result<T> {
  const error: MensuraError = {
    code,
    message,
    stage: stage(options),
    meta
  };

  return err(error);
}
