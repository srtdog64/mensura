import { DEFAULT_FLOAT_TOLERANCE, type FloatTolerance } from "./float.js";

export const QUAT_SLERP_LINEAR_THRESHOLD = 0.9995;
export const QUAT_PARALLEL_EPSILON = 1e-8;
export const PERSPECTIVE_MIN_FOV_Y_RADIANS = 0;
export const PERSPECTIVE_MAX_FOV_Y_RADIANS = Math.PI;

export interface QuatPolicy {
  readonly slerpLinearThreshold: number;
  readonly parallelEpsilon: number;
}

export interface PerspectivePolicy {
  readonly minFovYRadians: number;
  readonly maxFovYRadians: number;
}

export interface MensuraPolicy {
  readonly tolerance: FloatTolerance;
  readonly quat: QuatPolicy;
  readonly perspective: PerspectivePolicy;
}

export const DEFAULT_POLICY: MensuraPolicy = Object.freeze({
  tolerance: DEFAULT_FLOAT_TOLERANCE,
  quat: Object.freeze({
    slerpLinearThreshold: QUAT_SLERP_LINEAR_THRESHOLD,
    parallelEpsilon: QUAT_PARALLEL_EPSILON
  }),
  perspective: Object.freeze({
    minFovYRadians: PERSPECTIVE_MIN_FOV_Y_RADIANS,
    maxFovYRadians: PERSPECTIVE_MAX_FOV_Y_RADIANS
  })
});
