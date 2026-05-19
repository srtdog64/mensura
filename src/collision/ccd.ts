import type { Vec3 } from "../core/vec3.js";
import { dot3, scaleAndAdd3, sub3 } from "../core/vec3.js";
import type { Aabb } from "../geometry/aabb.js";
import type { Sphere } from "../geometry/sphere.js";

export interface TimeOfImpact {
  readonly hit: true;
  readonly time: number;
  readonly normal: Vec3;
}

export interface CcdOptions {
  readonly maxTime?: number;
  readonly epsilon?: number;
}

export function sweptAabbTimeOfImpact(
  moving: Aabb,
  velocity: Vec3,
  target: Aabb,
  options: CcdOptions = {}
): TimeOfImpact | null {
  const maxTime = options.maxTime ?? 1;
  const epsilon = options.epsilon ?? 1e-12;
  let tEnter = 0;
  let tExit = maxTime;
  let hitAxis = 0;
  let hitSign = 0;

  for (let axis = 0; axis < 3; axis++) {
    const v = axisValue(velocity, axis);
    const movingMin = axisValue(moving.min, axis);
    const movingMax = axisValue(moving.max, axis);
    const targetMin = axisValue(target.min, axis);
    const targetMax = axisValue(target.max, axis);

    if (Math.abs(v) <= epsilon) {
      if (movingMax < targetMin || movingMin > targetMax) {
        return null;
      }
      continue;
    }

    const invV = 1 / v;
    let axisEnter = (targetMin - movingMax) * invV;
    let axisExit = (targetMax - movingMin) * invV;
    let sign = -1;
    if (axisEnter > axisExit) {
      const tmp = axisEnter;
      axisEnter = axisExit;
      axisExit = tmp;
      sign = 1;
    }

    if (axisEnter > tEnter) {
      tEnter = axisEnter;
      hitAxis = axis;
      hitSign = sign;
    }
    if (axisExit < tExit) {
      tExit = axisExit;
    }
    if (tEnter > tExit) {
      return null;
    }
  }

  if (tEnter < 0 || tEnter > maxTime) {
    return null;
  }

  return {
    hit: true,
    time: tEnter,
    normal: axisNormal(hitAxis, hitSign)
  };
}

export function sweptSphereTimeOfImpact(
  moving: Sphere,
  velocity: Vec3,
  target: Sphere,
  options: CcdOptions = {}
): TimeOfImpact | null {
  if (moving.radius < 0 || target.radius < 0) {
    return null;
  }

  const maxTime = options.maxTime ?? 1;
  const relativeCenter = sub3(moving.center, target.center);
  const radius = moving.radius + target.radius;
  const c = dot3(relativeCenter, relativeCenter) - radius * radius;

  if (c <= 0) {
    return {
      hit: true,
      time: 0,
      normal: contactNormal(relativeCenter, velocity)
    };
  }

  const a = dot3(velocity, velocity);
  if (a <= 0) {
    return null;
  }

  const b = 2 * dot3(relativeCenter, velocity);
  if (b >= 0) {
    return null;
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t < 0 || t > maxTime) {
    return null;
  }

  return {
    hit: true,
    time: t,
    normal: contactNormal(scaleAndAdd3(relativeCenter, velocity, t), velocity)
  };
}

function axisValue(value: Vec3, axis: number): number {
  return axis === 0 ? value.x : axis === 1 ? value.y : value.z;
}

function axisNormal(axis: number, sign: number): Vec3 {
  if (axis === 0) return { x: sign, y: 0, z: 0 };
  if (axis === 1) return { x: 0, y: sign, z: 0 };
  return { x: 0, y: 0, z: sign };
}

function contactNormal(offset: Vec3, fallback: Vec3): Vec3 {
  const lenSq = dot3(offset, offset);
  if (lenSq > 0) {
    const invLen = 1 / Math.sqrt(lenSq);
    return {
      x: offset.x * invLen,
      y: offset.y * invLen,
      z: offset.z * invLen
    };
  }

  const fallbackLenSq = dot3(fallback, fallback);
  if (fallbackLenSq > 0) {
    const invLen = -1 / Math.sqrt(fallbackLenSq);
    return {
      x: fallback.x * invLen,
      y: fallback.y * invLen,
      z: fallback.z * invLen
    };
  }

  return { x: 1, y: 0, z: 0 };
}
