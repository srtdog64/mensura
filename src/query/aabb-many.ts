import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { mutableVec3 } from "../core/vec3.js";
import type { Aabb } from "../geometry/aabb.js";
import { aabbIntersectsAabb } from "../geometry/aabb.js";
import type { Ray } from "../geometry/ray.js";
import { rayAabbHitDistance, rayAtInto } from "../geometry/ray.js";

export interface IndexedRayHit {
  readonly index: number;
  readonly distance: number;
  readonly point: Vec3;
}

export interface MutableIndexedRayHit {
  index: number;
  distance: number;
  point: MutableVec3;
}

export interface IndexedAabbPair {
  readonly a: number;
  readonly b: number;
}

/**
 * Raycast a ray against `count` AABBs and append hit records to `out`.
 *
 * The returned hits preserve input order, not distance order. Use
 * `nearestRayAabbHit` when only the closest hit matters.
 */
export function raycastManyAabbInto(
  value: Ray,
  boxes: ArrayLike<Aabb>,
  out: MutableIndexedRayHit[],
  count: number = boxes.length
): MutableIndexedRayHit[] {
  out.length = 0;
  for (let i = 0; i < count; i++) {
    const distance = rayAabbHitDistance(value, boxes[i]);
    if (distance === null) {
      continue;
    }
    out.push({
      index: i,
      distance,
      point: rayAtInto(value, distance, mutableVec3())
    });
  }
  return out;
}

export function raycastManyAabb(
  value: Ray,
  boxes: ArrayLike<Aabb>,
  count: number = boxes.length
): IndexedRayHit[] {
  return raycastManyAabbInto(value, boxes, [], count);
}

export function nearestRayAabbHitInto(
  value: Ray,
  boxes: ArrayLike<Aabb>,
  out: MutableIndexedRayHit,
  count: number = boxes.length
): MutableIndexedRayHit | null {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < count; i++) {
    const distance = rayAabbHitDistance(value, boxes[i]);
    if (distance !== null && distance < bestDistance) {
      bestIndex = i;
      bestDistance = distance;
    }
  }

  if (bestIndex < 0) {
    return null;
  }

  out.index = bestIndex;
  out.distance = bestDistance;
  rayAtInto(value, bestDistance, out.point);
  return out;
}

export function nearestRayAabbHit(
  value: Ray,
  boxes: ArrayLike<Aabb>,
  count: number = boxes.length
): IndexedRayHit | null {
  return nearestRayAabbHitInto(value, boxes, {
    index: -1,
    distance: 0,
    point: mutableVec3()
  }, count);
}

/**
 * Brute-force pair overlap query for small or already-filtered AABB sets.
 *
 * Results are canonical `(a < b)` input indices. For large dynamic sets prefer
 * the BVH broadphase in `@exornea/mensura/accel` or `CollisionWorld`.
 */
export function overlapManyAabbInto(
  boxes: ArrayLike<Aabb>,
  out: IndexedAabbPair[],
  count: number = boxes.length
): IndexedAabbPair[] {
  out.length = 0;
  for (let a = 0; a < count; a++) {
    const boxA = boxes[a];
    for (let b = a + 1; b < count; b++) {
      if (aabbIntersectsAabb(boxA, boxes[b])) {
        out.push({ a, b });
      }
    }
  }
  return out;
}

export function overlapManyAabb(
  boxes: ArrayLike<Aabb>,
  count: number = boxes.length
): IndexedAabbPair[] {
  return overlapManyAabbInto(boxes, [], count);
}
