import type { Bvh } from "./bvh.js";
import { buildBvh, bvhRaycast } from "./bvh.js";
import type { Aabb } from "../geometry/aabb.js";
import type { Ray } from "../geometry/ray.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";

export interface CollisionBody {
  id: number;
  aabb: Aabb;
}

export class CollisionWorld {
  private bodies: Map<number, CollisionBody> = new Map();
  private bvh: Bvh | null = null;
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
    const primitives = Array.from(this.bodies.values()).map(b => b.aabb);
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
    const indices = bvhRaycast(this.bvh, ray);
    const bodyIds = Array.from(this.bodies.keys());
    return indices.map(idx => bodyIds[idx]);
  }
}
