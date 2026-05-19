import type { Bvh } from "../accel/bvh.js";
import type { BroadphasePair, BvhBuildOptions } from "../accel/bvh.js";
import { buildBvh, bvhOverlapPairs, bvhRaycast } from "../accel/bvh.js";
import { AccelContext } from "../accel/context.js";
import type { Aabb } from "../geometry/aabb.js";
import type { Ray } from "../geometry/ray.js";
import { rayIntersectsAabb } from "../geometry/ray.js";
import type { Result } from "../core/result.js";
import { err } from "../core/result.js";

export interface CollisionBody {
  id: number;
  aabb: Aabb;
}

export interface CollisionBodyPair {
  readonly a: number;
  readonly b: number;
}

export class CollisionWorld {
  private bodies: Map<number, CollisionBody> = new Map();
  private bvh: Bvh | null = null;
  private orderedBodies: CollisionBody[] = [];
  private accelCtx: AccelContext = new AccelContext();
  private nextId = 1;

  public addBody(aabb: Aabb): number {
    const id = this.nextId++;
    this.bodies.set(id, { id, aabb });
    this.bvh = null;
    return id;
  }

  public removeBody(id: number): boolean {
    const removed = this.bodies.delete(id);
    if (removed) {
      this.bvh = null;
    }
    return removed;
  }

  /**
   * Replace the AABB of an existing body. Returns `true` when the body was
   * found and updated. Invalidates the cached BVH so the next `raycast` will
   * trigger a rebuild on the caller's next `updateBvh()`.
   *
   * Callers running dynamic scenes can use this instead of remove+add to
   * avoid churning ids; the BVH is still rebuilt lazily, not incrementally
   * (that is on the TODO list once a real workload demands it).
   */
  public updateBody(id: number, aabb: Aabb): boolean {
    const body = this.bodies.get(id);
    if (!body) {
      return false;
    }
    body.aabb = aabb;
    this.bvh = null;
    return true;
  }

  public hasBody(id: number): boolean {
    return this.bodies.has(id);
  }

  public bodyCount(): number {
    return this.bodies.size;
  }

  public updateBvh(options: BvhBuildOptions | number = 4): Result<Bvh> {
    this.orderedBodies.length = 0;
    const primitives: Aabb[] = [];

    for (const body of this.bodies.values()) {
      this.orderedBodies.push(body);
      primitives.push(body.aabb);
    }

    if (primitives.length === 0) {
      return err({
        code: "BVH_EMPTY_PRIMITIVES",
        message: "No bodies to build BVH",
        stage: "BvhBuild",
        retryable: true
      });
    }

    const bvhResult = buildBvh(primitives, options);
    if (bvhResult.ok) {
      this.bvh = bvhResult.value;
    }
    return bvhResult;
  }

  public raycast(ray: Ray): number[] {
    if (!this.bvh) {
      return [];
    }
    const indices = bvhRaycast(this.bvh, ray, this.accelCtx);
    const hits: number[] = [];
    const ordered = this.orderedBodies;

    for (let i = 0; i < indices.length; i++) {
      const body = ordered[indices[i]];
      if (body && rayIntersectsAabb(ray, body.aabb)) {
        hits.push(body.id);
      }
    }

    return hits;
  }

  public broadphasePairs(): CollisionBodyPair[] {
    if (!this.bvh) {
      return [];
    }

    const pairs = bvhOverlapPairs(this.bvh, this.accelCtx);
    const result: CollisionBodyPair[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i] as BroadphasePair;
      const aBody = this.orderedBodies[pair.a];
      const bBody = this.orderedBodies[pair.b];
      if (!aBody || !bBody || !aabbIntersectsBody(aBody.aabb, bBody.aabb)) {
        continue;
      }
      const a = Math.min(aBody.id, bBody.id);
      const b = Math.max(aBody.id, bBody.id);
      const key = `${a}:${b}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ a, b });
      }
    }

    return result;
  }
}

function aabbIntersectsBody(a: Aabb, b: Aabb): boolean {
  return (
    b.max.x >= a.min.x &&
    b.min.x <= a.max.x &&
    b.max.y >= a.min.y &&
    b.min.y <= a.max.y &&
    b.max.z >= a.min.z &&
    b.min.z <= a.max.z
  );
}
