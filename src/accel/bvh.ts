import type { Aabb } from "../geometry/aabb.js";
import { mutableAabb } from "../geometry/aabb.js";
import type { Ray } from "../geometry/ray.js";
import { rayIntersectsAabb } from "../geometry/ray.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { AccelContext } from "./context.js";

export interface BvhNode {
  aabb: Aabb;
  left?: BvhNode;
  right?: BvhNode;
  isLeaf: boolean;
  primitiveIndices?: number[];
}

export interface Bvh {
  root: BvhNode | null;
}


export function buildBvh(primitives: Aabb[], maxPrimitivesPerLeaf: number = 4): Result<Bvh> {
  if (primitives.length === 0) {
    return err({
      code: "BVH_EMPTY_PRIMITIVES",
      message: "Cannot build BVH with 0 primitives",
      stage: "BvhBuild",
      retryable: false
    });
  }

  const indices = Array.from({ length: primitives.length }, (_, i) => i);
  const root = buildBvhNode(primitives, indices, maxPrimitivesPerLeaf);

  return ok({ root });
}

function buildBvhNode(primitives: Aabb[], indices: number[], maxPrimitivesPerLeaf: number): BvhNode {
  const bounds = mutableAabb(primitives[indices[0]].min, primitives[indices[0]].max);
  for (let i = 1; i < indices.length; i++) {
    // simplified encapsulate
    bounds.min.x = Math.min(bounds.min.x, primitives[indices[i]].min.x);
    bounds.min.y = Math.min(bounds.min.y, primitives[indices[i]].min.y);
    bounds.min.z = Math.min(bounds.min.z, primitives[indices[i]].min.z);
    bounds.max.x = Math.max(bounds.max.x, primitives[indices[i]].max.x);
    bounds.max.y = Math.max(bounds.max.y, primitives[indices[i]].max.y);
    bounds.max.z = Math.max(bounds.max.z, primitives[indices[i]].max.z);
  }

  if (indices.length <= maxPrimitivesPerLeaf) {
    return {
      aabb: bounds,
      isLeaf: true,
      primitiveIndices: indices
    };
  }

  // Split on longest axis (simplified)
  const extentX = bounds.max.x - bounds.min.x;
  const extentY = bounds.max.y - bounds.min.y;
  const extentZ = bounds.max.z - bounds.min.z;

  let compare: (a: number, b: number) => number;
  if (extentY > extentX && extentY > extentZ) {
    compare = (a, b) => (primitives[a].min.y + primitives[a].max.y) - (primitives[b].min.y + primitives[b].max.y);
  } else if (extentZ > extentX && extentZ > extentY) {
    compare = (a, b) => (primitives[a].min.z + primitives[a].max.z) - (primitives[b].min.z + primitives[b].max.z);
  } else {
    compare = (a, b) => (primitives[a].min.x + primitives[a].max.x) - (primitives[b].min.x + primitives[b].max.x);
  }

  indices.sort(compare);

  const mid = Math.floor(indices.length / 2);
  const leftIndices = indices.slice(0, mid);
  const rightIndices = indices.slice(mid);

  return {
    aabb: bounds,
    isLeaf: false,
    left: buildBvhNode(primitives, leftIndices, maxPrimitivesPerLeaf),
    right: buildBvhNode(primitives, rightIndices, maxPrimitivesPerLeaf)
  };
}

export function bvhRaycast(bvh: Bvh, ray: Ray, ctx: AccelContext): number[] {
  const result: number[] = [];
  if (!bvh.root) return result;

  const stack = ctx.bvhStack;
  stack.length = 0;
  stack.push(bvh.root);

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (rayIntersectsAabb(ray, node.aabb)) {
      if (node.isLeaf && node.primitiveIndices) {
        const leaf = node.primitiveIndices;
        for (let i = 0; i < leaf.length; i++) {
          result.push(leaf[i]);
        }
      } else {
        if (node.left) stack.push(node.left);
        if (node.right) stack.push(node.right);
      }
    }
  }

  return result;
}
