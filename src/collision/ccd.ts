import type { Vec3 } from "../core/vec3.js";
import type { Aabb } from "../geometry/aabb.js";
import type { Sphere } from "../geometry/sphere.js";

export interface TimeOfImpact {
  readonly hit: true;
  readonly time: number;
  readonly normal: Vec3;
}

export interface SweepHit extends TimeOfImpact {
  readonly point: Vec3;
  readonly remainingMotion: Vec3;
  readonly startedOverlapping: boolean;
}

export interface CcdOptions {
  readonly maxTime?: number;
  readonly epsilon?: number;
}

/**
 * Swept AABB time of impact under a constant linear velocity.
 *
 * Returns `null` for any of:
 *
 * - the pair already contacts at `t = 0` (any overlap or touching face);
 *   CCD reports first *future* contact events only — penetration recovery is
 *   the EPA layer's job;
 * - the slab test finds no entry on `[0, maxTime]`;
 * - parallel motion on an axis that is already separated.
 */
export function sweptAabbTimeOfImpact(
  moving: Aabb,
  velocity: Vec3,
  target: Aabb,
  options: CcdOptions = {}
): TimeOfImpact | null {
  // Reject pairs that already contact at t=0 (overlapping or touching). The
  // slab test below would produce a zero normal in this case because no axis
  // advances tEnter past 0.
  if (
    moving.max.x >= target.min.x && moving.min.x <= target.max.x &&
    moving.max.y >= target.min.y && moving.min.y <= target.max.y &&
    moving.max.z >= target.min.z && moving.min.z <= target.max.z
  ) {
    return null;
  }

  const maxTime = options.maxTime ?? 1;
  const epsilon = options.epsilon ?? 1e-12;
  let tEnter = 0;
  let tExit = maxTime;
  let hitAxis = -1;
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

  // No axis advanced tEnter past 0 — pair is moving apart or all motion is
  // parallel to axes that never close. Initial overlap was filtered above, so
  // this only fires for "no future contact event".
  if (hitAxis < 0 || tEnter > maxTime) {
    return null;
  }

  return {
    hit: true,
    time: tEnter,
    normal: axisNormal(hitAxis, hitSign)
  };
}

export function sweptAabbHit(
  moving: Aabb,
  velocity: Vec3,
  target: Aabb,
  options: CcdOptions = {}
): SweepHit | null {
  const toi = sweptAabbTimeOfImpact(moving, velocity, target, options);
  if (!toi) {
    return null;
  }
  const maxTime = options.maxTime ?? 1;
  return {
    hit: true,
    time: toi.time,
    normal: toi.normal,
    point: sweptAabbContactPoint(moving, velocity, target, toi.time, toi.normal),
    remainingMotion: scaleVector(velocity, maxTime - toi.time),
    startedOverlapping: false
  };
}

/**
 * Swept sphere–sphere time of impact under a constant relative velocity.
 *
 * Quadratic equation `a t² + b t + c = 0` for `|center + v t|² = (rA + rB)²`.
 * Returns `null` when the spheres are moving apart (`b ≥ 0` with `c > 0`),
 * never meet on `[0, maxTime]`, or either radius is negative. Already
 * overlapping pairs (`c ≤ 0`) report `time = 0` with the centre-to-centre
 * normal — there is a well-defined direction even at t=0 here, unlike the
 * AABB case.
 */
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
  const relX = moving.center.x - target.center.x;
  const relY = moving.center.y - target.center.y;
  const relZ = moving.center.z - target.center.z;
  const radius = moving.radius + target.radius;
  const c = relX * relX + relY * relY + relZ * relZ - radius * radius;

  if (c <= 0) {
    return {
      hit: true,
      time: 0,
      normal: contactNormalFromComponents(relX, relY, relZ, velocity)
    };
  }

  const vx = velocity.x;
  const vy = velocity.y;
  const vz = velocity.z;
  const a = vx * vx + vy * vy + vz * vz;
  if (a <= 0) {
    return null;
  }

  const b = 2 * (relX * vx + relY * vy + relZ * vz);
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
    normal: contactNormalFromComponents(relX + vx * t, relY + vy * t, relZ + vz * t, velocity)
  };
}

export function sweptSphereHit(
  moving: Sphere,
  velocity: Vec3,
  target: Sphere,
  options: CcdOptions = {}
): SweepHit | null {
  const toi = sweptSphereTimeOfImpact(moving, velocity, target, options);
  if (!toi) {
    return null;
  }
  const maxTime = options.maxTime ?? 1;
  const movedCenter = {
    x: moving.center.x + velocity.x * toi.time,
    y: moving.center.y + velocity.y * toi.time,
    z: moving.center.z + velocity.z * toi.time
  };
  return {
    hit: true,
    time: toi.time,
    normal: toi.normal,
    point: {
      x: movedCenter.x - toi.normal.x * moving.radius,
      y: movedCenter.y - toi.normal.y * moving.radius,
      z: movedCenter.z - toi.normal.z * moving.radius
    },
    remainingMotion: scaleVector(velocity, maxTime - toi.time),
    startedOverlapping: toi.time === 0 && spheresOverlap(moving, target)
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

function sweptAabbContactPoint(moving: Aabb, velocity: Vec3, target: Aabb, time: number, normal: Vec3): Vec3 {
  const min = {
    x: moving.min.x + velocity.x * time,
    y: moving.min.y + velocity.y * time,
    z: moving.min.z + velocity.z * time
  };
  const max = {
    x: moving.max.x + velocity.x * time,
    y: moving.max.y + velocity.y * time,
    z: moving.max.z + velocity.z * time
  };
  return {
    x: contactAxisPoint(normal.x, min.x, max.x, target.min.x, target.max.x),
    y: contactAxisPoint(normal.y, min.y, max.y, target.min.y, target.max.y),
    z: contactAxisPoint(normal.z, min.z, max.z, target.min.z, target.max.z)
  };
}

function contactAxisPoint(normalComponent: number, movingMin: number, movingMax: number, targetMin: number, targetMax: number): number {
  if (normalComponent < 0) {
    return movingMax;
  }
  if (normalComponent > 0) {
    return movingMin;
  }
  const overlapMin = Math.max(movingMin, targetMin);
  const overlapMax = Math.min(movingMax, targetMax);
  return (overlapMin + overlapMax) * 0.5;
}

function scaleVector(value: Vec3, scalar: number): Vec3 {
  return {
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  };
}

function spheresOverlap(a: Sphere, b: Sphere): boolean {
  const dx = a.center.x - b.center.x;
  const dy = a.center.y - b.center.y;
  const dz = a.center.z - b.center.z;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

/**
 * Normal from the centre-offset vector, falling back to the negated velocity
 * direction if the offset is degenerate. The fallback sign is documented:
 * "points away from velocity" so the caller can resolve along `-normal · v`.
 */
function contactNormalFromComponents(ox: number, oy: number, oz: number, fallback: Vec3): Vec3 {
  const lenSq = ox * ox + oy * oy + oz * oz;
  if (lenSq > 0) {
    const invLen = 1 / Math.sqrt(lenSq);
    return { x: ox * invLen, y: oy * invLen, z: oz * invLen };
  }

  const fallbackLenSq = fallback.x * fallback.x + fallback.y * fallback.y + fallback.z * fallback.z;
  if (fallbackLenSq > 0) {
    const invLen = -1 / Math.sqrt(fallbackLenSq);
    return { x: fallback.x * invLen, y: fallback.y * invLen, z: fallback.z * invLen };
  }

  return { x: 1, y: 0, z: 0 };
}
