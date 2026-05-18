import type { Bvh } from "../accel/bvh.js";
import { buildBvh, bvhRaycast } from "../accel/bvh.js";
import { AccelContext } from "../accel/context.js";
import type { Aabb } from "../geometry/aabb.js";
import type { Ray } from "../geometry/ray.js";
import { rayIntersectsAabb } from "../geometry/ray.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";

export interface CollisionBody {
  id: number;
  aabb: Aabb;
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

  public updateBvh(): Result<Bvh> {
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

    const bvhResult = buildBvh(primitives);
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
}
