import type { Float32ConversionLoss } from "../core/float.js";
import { DEFAULT_FLOAT_TOLERANCE, conversionLossF32 } from "../core/float.js";
import type { Mat4Like } from "../core/mat4.js";
import type { MensuraError, MensuraErrorCode, MensuraErrorStage, Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { Vec3 } from "../core/vec3.js";
import { lengthSq3 } from "../core/vec3.js";
import type { Aabb } from "../geometry/aabb.js";
import { aabbIsEmpty } from "../geometry/aabb.js";
import type { Capsule } from "../geometry/capsule.js";
import type { Frustum } from "../geometry/frustum.js";
import type { Obb } from "../geometry/obb.js";
import type { Plane } from "../geometry/plane.js";
import type { Ray } from "../geometry/ray.js";
import type { Sphere } from "../geometry/sphere.js";
import { triangleDoubleArea } from "../measure/triangle.js";

export * from "./reproducibility.js";

const DEFAULT_STAGE = "Validation" as const;

export interface ValidationOptions {
  readonly label?: string;
  readonly stage?: MensuraErrorStage;
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

export interface RayValidationOptions extends ValidationOptions {
  readonly minDirectionLengthSq?: number;
}

export function validateRay(value: Ray, options: RayValidationOptions = {}): Result<Ray> {
  const origin = validateFiniteVec3(value.origin, withLabel(options, `${label(options)}.origin`));
  if (!origin.ok) {
    return origin;
  }

  const direction = validateFiniteVec3(value.direction, withLabel(options, `${label(options)}.direction`));
  if (!direction.ok) {
    return direction;
  }

  const minDirectionLengthSq = options.minDirectionLengthSq ?? 1e-24;
  const lengthSq = lengthSq3(value.direction);
  if (lengthSq < minDirectionLengthSq) {
    return validationError("VALIDATION_DEGENERATE_RAY", `${label(options)} direction is degenerate`, options, {
      lengthSq,
      minDirectionLengthSq
    });
  }

  return ok(value);
}

export interface Mat4ValidationOptions extends ValidationOptions {
  readonly requireFiniteDeterminant?: boolean;
  readonly minAbsDeterminant?: number;
}

export function validateMat4(value: Mat4Like, options: Mat4ValidationOptions = {}): Result<Mat4Like> {
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(value[i])) {
      return validationError("VALIDATION_MAT4_NON_FINITE", `${label(options)}[${i}] must be finite`, options, {
        index: i,
        value: value[i]
      });
    }
  }

  if (options.requireFiniteDeterminant === true) {
    // 4x4 determinant via co-factor expansion. Avoids importing core/mat4 to
    // keep the validation layer self-contained.
    const det = mat4DeterminantInline(value);
    const minAbs = options.minAbsDeterminant ?? 1e-12;
    if (!Number.isFinite(det) || Math.abs(det) < minAbs) {
      return validationError(
        "VALIDATION_MAT4_SINGULAR",
        `${label(options)} determinant is below the singular threshold`,
        options,
        { determinant: det, minAbsDeterminant: minAbs }
      );
    }
  }

  return ok(value);
}

function mat4DeterminantInline(m: Mat4Like): number {
  const m00 = m[0], m10 = m[1], m20 = m[2], m30 = m[3];
  const m01 = m[4], m11 = m[5], m21 = m[6], m31 = m[7];
  const m02 = m[8], m12 = m[9], m22 = m[10], m32 = m[11];
  const m03 = m[12], m13 = m[13], m23 = m[14], m33 = m[15];

  return (
    m00 * (
      m11 * (m22 * m33 - m23 * m32) -
      m12 * (m21 * m33 - m23 * m31) +
      m13 * (m21 * m32 - m22 * m31)
    ) -
    m10 * (
      m01 * (m22 * m33 - m23 * m32) -
      m02 * (m21 * m33 - m23 * m31) +
      m03 * (m21 * m32 - m22 * m31)
    ) +
    m20 * (
      m01 * (m12 * m33 - m13 * m32) -
      m02 * (m11 * m33 - m13 * m31) +
      m03 * (m11 * m32 - m12 * m31)
    ) -
    m30 * (
      m01 * (m12 * m23 - m13 * m22) -
      m02 * (m11 * m23 - m13 * m21) +
      m03 * (m11 * m22 - m12 * m21)
    )
  );
}

export interface ObbValidationOptions extends ValidationOptions {
  /** Tolerance for column orthonormality, dot product and length comparisons. */
  readonly orthonormalEpsilon?: number;
  /** When true, also check that rotation columns are orthonormal. Default false. */
  readonly requireOrthonormalRotation?: boolean;
}

export function validateObb(value: Obb, options: ObbValidationOptions = {}): Result<Obb> {
  const center = validateFiniteVec3(value.center, withLabel(options, `${label(options)}.center`));
  if (!center.ok) {
    return center;
  }

  const extents = validateFiniteVec3(value.extents, withLabel(options, `${label(options)}.extents`));
  if (!extents.ok) {
    return extents;
  }

  if (value.extents.x < 0 || value.extents.y < 0 || value.extents.z < 0) {
    return validationError("VALIDATION_OBB_NEGATIVE_EXTENTS", `${label(options)} extents must be non-negative`, options, {
      extents: { x: value.extents.x, y: value.extents.y, z: value.extents.z }
    });
  }

  for (let i = 0; i < 9; i++) {
    if (!Number.isFinite(value.rotation[i])) {
      return validationError(
        "VALIDATION_OBB_ROTATION_NON_FINITE",
        `${label(options)} rotation[${i}] must be finite`,
        options,
        { index: i, value: value.rotation[i] }
      );
    }
  }

  if (options.requireOrthonormalRotation === true) {
    const eps = options.orthonormalEpsilon ?? 1e-5;
    const r = value.rotation;
    // Columns of column-major mat3: c0 = r[0..2], c1 = r[3..5], c2 = r[6..8].
    const c0Sq = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
    const c1Sq = r[3] * r[3] + r[4] * r[4] + r[5] * r[5];
    const c2Sq = r[6] * r[6] + r[7] * r[7] + r[8] * r[8];
    const c0c1 = r[0] * r[3] + r[1] * r[4] + r[2] * r[5];
    const c0c2 = r[0] * r[6] + r[1] * r[7] + r[2] * r[8];
    const c1c2 = r[3] * r[6] + r[4] * r[7] + r[5] * r[8];
    if (
      Math.abs(c0Sq - 1) > eps ||
      Math.abs(c1Sq - 1) > eps ||
      Math.abs(c2Sq - 1) > eps ||
      Math.abs(c0c1) > eps ||
      Math.abs(c0c2) > eps ||
      Math.abs(c1c2) > eps
    ) {
      return validationError(
        "VALIDATION_OBB_NON_ORTHONORMAL",
        `${label(options)} rotation columns are not orthonormal within epsilon`,
        options,
        { c0Sq, c1Sq, c2Sq, c0c1, c0c2, c1c2, epsilon: eps }
      );
    }
  }

  return ok(value);
}

export function validateFrustum(value: Frustum, options: ValidationOptions = {}): Result<Frustum> {
  const planes: readonly [string, Plane][] = [
    ["left", value.left],
    ["right", value.right],
    ["bottom", value.bottom],
    ["top", value.top],
    ["far", value.far],
    ["near", value.near]
  ];
  for (let i = 0; i < planes.length; i++) {
    const [name, p] = planes[i];
    const result = validatePlane(p, withLabel(options, `${label(options)}.${name}`));
    if (!result.ok) {
      return result;
    }
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

function stage(options: ValidationOptions): MensuraErrorStage {
  return options.stage ?? DEFAULT_STAGE;
}

function withLabel<T extends ValidationOptions>(options: T, nextLabel: string): ValidationOptions {
  return {
    label: nextLabel,
    stage: stage(options)
  };
}

function validationError<T>(
  code: MensuraErrorCode,
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
