import { type MutableMat4, mat4Identity } from "../core/mat4.js";
import { type Result, err, mensuraError, ok } from "../core/result.js";

export function mat4PerspectiveWebGpuRh(
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number
): Result<MutableMat4> {
  return mat4PerspectiveWebGpuRhInto(fovYRadians, aspect, near, far, mat4Identity());
}

export function mat4PerspectiveWebGpuRhInto(
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number,
  out: MutableMat4
): Result<MutableMat4> {
  const validation = validatePerspectiveArgs(fovYRadians, aspect, near, far);

  if (!validation.ok) {
    return err(validation.error);
  }

  const f = 1 / Math.tan(fovYRadians * 0.5);

  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (Number.isFinite(far)) {
    const rangeInv = 1 / (near - far);
    out[10] = far * rangeInv;
    out[14] = far * near * rangeInv;
  } else {
    out[10] = -1;
    out[14] = -near;
  }

  return ok(out);
}

export function mat4PerspectiveReverseZWebGpuRh(
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number = Number.POSITIVE_INFINITY
): Result<MutableMat4> {
  return mat4PerspectiveReverseZWebGpuRhInto(fovYRadians, aspect, near, far, mat4Identity());
}

export function mat4PerspectiveReverseZWebGpuRhInto(
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number,
  out: MutableMat4
): Result<MutableMat4> {
  const validation = validatePerspectiveArgs(fovYRadians, aspect, near, far);

  if (!validation.ok) {
    return err(validation.error);
  }

  const f = 1 / Math.tan(fovYRadians * 0.5);

  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (Number.isFinite(far)) {
    const rangeInv = 1 / (far - near);
    out[10] = near * rangeInv;
    out[14] = near * far * rangeInv;
  } else {
    out[10] = 0;
    out[14] = near;
  }

  return ok(out);
}

function validatePerspectiveArgs(
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number
): Result<undefined> {
  if (!(fovYRadians > 0 && fovYRadians < Math.PI)) {
    return err(mensuraError({
      code: "VALIDATION_INVALID_FORMAT",
      stage: "ValidateInput",
      message: "fovYRadians must be greater than 0 and less than PI.",
      meta: { fovYRadians }
    }));
  }

  if (!(aspect > 0)) {
    return err(mensuraError({
      code: "VALIDATION_INVALID_FORMAT",
      stage: "ValidateInput",
      message: "aspect must be greater than 0.",
      meta: { aspect }
    }));
  }

  if (!(near > 0)) {
    return err(mensuraError({
      code: "VALIDATION_INVALID_FORMAT",
      stage: "ValidateInput",
      message: "near must be greater than 0.",
      meta: { near }
    }));
  }

  if (!(far > near) && far !== Number.POSITIVE_INFINITY) {
    return err(mensuraError({
      code: "VALIDATION_INVALID_FORMAT",
      stage: "ValidateInput",
      message: "far must be greater than near, or Infinity.",
      meta: { near, far }
    }));
  }

  return ok(undefined);
}
