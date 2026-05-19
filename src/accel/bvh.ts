import type { Aabb, MutableAabb } from "../geometry/aabb.js";
import { aabbIntersectsAabb, mutableAabb } from "../geometry/aabb.js";
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

export type BvhSplitMethod = "median" | "sah";

export interface BvhBuildOptions {
  readonly maxPrimitivesPerLeaf?: number;
  readonly splitMethod?: BvhSplitMethod;
  readonly sahBins?: number;
}

export interface BroadphasePair {
  readonly a: number;
  readonly b: number;
}

export function buildBvh(
  primitives: Aabb[],
  optionsOrMaxPrimitivesPerLeaf: BvhBuildOptions | number = 4
): Result<Bvh> {
  if (primitives.length === 0) {
    return err({
      code: "BVH_EMPTY_PRIMITIVES",
      message: "Cannot build BVH with 0 primitives",
      stage: "BvhBuild",
      retryable: false
    });
  }

  const options = normalizeBvhOptions(optionsOrMaxPrimitivesPerLeaf);
  const indices = Array.from({ length: primitives.length }, (_, i) => i);
  const root = buildBvhNode(primitives, indices, options);

  return ok({ root });
}

function normalizeBvhOptions(optionsOrMaxPrimitivesPerLeaf: BvhBuildOptions | number): Required<BvhBuildOptions> {
  if (typeof optionsOrMaxPrimitivesPerLeaf === "number") {
    return {
      maxPrimitivesPerLeaf: Math.max(1, optionsOrMaxPrimitivesPerLeaf | 0),
      splitMethod: "median",
      sahBins: 12
    };
  }

  return {
    maxPrimitivesPerLeaf: Math.max(1, (optionsOrMaxPrimitivesPerLeaf.maxPrimitivesPerLeaf ?? 4) | 0),
    splitMethod: optionsOrMaxPrimitivesPerLeaf.splitMethod ?? "median",
    sahBins: Math.max(2, (optionsOrMaxPrimitivesPerLeaf.sahBins ?? 12) | 0)
  };
}

function buildBvhNode(primitives: Aabb[], indices: number[], options: Required<BvhBuildOptions>): BvhNode {
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

  if (indices.length <= options.maxPrimitivesPerLeaf) {
    return {
      aabb: bounds,
      isLeaf: true,
      primitiveIndices: indices
    };
  }

  const split = options.splitMethod === "sah"
    ? findSahSplit(primitives, indices, bounds, options.sahBins)
    : findMedianSplit(primitives, indices, bounds);

  if (!split) {
    return {
      aabb: bounds,
      isLeaf: true,
      primitiveIndices: indices
    };
  }

  return {
    aabb: bounds,
    isLeaf: false,
    left: buildBvhNode(primitives, split.left, options),
    right: buildBvhNode(primitives, split.right, options)
  };
}

function findMedianSplit(
  primitives: Aabb[],
  indices: number[],
  bounds: Aabb
): { left: number[]; right: number[] } | null {
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

  if (leftIndices.length === 0 || rightIndices.length === 0) {
    return null;
  }

  return { left: leftIndices, right: rightIndices };
}

function findSahSplit(
  primitives: Aabb[],
  indices: number[],
  bounds: Aabb,
  bins: number
): { left: number[]; right: number[] } | null {
  const parentCost = surfaceArea(bounds) * indices.length;
  let bestAxis = 0;
  let bestBin = -1;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let axis = 0; axis < 3; axis++) {
    const min = axisValue(bounds.min, axis);
    const max = axisValue(bounds.max, axis);
    const extent = max - min;
    if (!(extent > 0)) {
      continue;
    }

    const counts = new Array<number>(bins).fill(0);
    const binBounds = Array.from({ length: bins }, () => mutableAabb());
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const center = primitiveCenter(primitives[index], axis);
      const bin = Math.min(bins - 1, Math.max(0, Math.floor(((center - min) / extent) * bins)));
      counts[bin]++;
      expandBoundsByAabb(binBounds[bin], primitives[index]);
    }

    const leftCounts = new Array<number>(bins).fill(0);
    const rightCounts = new Array<number>(bins).fill(0);
    const leftBounds = Array.from({ length: bins }, () => mutableAabb());
    const rightBounds = Array.from({ length: bins }, () => mutableAabb());

    let runningCount = 0;
    const runningLeft = mutableAabb();
    for (let i = 0; i < bins; i++) {
      runningCount += counts[i];
      expandBoundsByAabb(runningLeft, binBounds[i]);
      leftCounts[i] = runningCount;
      copyBounds(runningLeft, leftBounds[i]);
    }

    runningCount = 0;
    const runningRight = mutableAabb();
    for (let i = bins - 1; i >= 0; i--) {
      runningCount += counts[i];
      expandBoundsByAabb(runningRight, binBounds[i]);
      rightCounts[i] = runningCount;
      copyBounds(runningRight, rightBounds[i]);
    }

    for (let split = 0; split < bins - 1; split++) {
      if (leftCounts[split] === 0 || rightCounts[split + 1] === 0) {
        continue;
      }
      const cost =
        surfaceArea(leftBounds[split]) * leftCounts[split] +
        surfaceArea(rightBounds[split + 1]) * rightCounts[split + 1];
      if (cost < bestCost) {
        bestCost = cost;
        bestAxis = axis;
        bestBin = split;
      }
    }
  }

  if (bestBin < 0 || bestCost >= parentCost) {
    return findMedianSplit(primitives, indices, bounds);
  }

  const min = axisValue(bounds.min, bestAxis);
  const max = axisValue(bounds.max, bestAxis);
  const extent = max - min;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    const center = primitiveCenter(primitives[index], bestAxis);
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(((center - min) / extent) * bins)));
    if (bin <= bestBin) {
      left.push(index);
    } else {
      right.push(index);
    }
  }

  if (left.length === 0 || right.length === 0) {
    return findMedianSplit(primitives, indices, bounds);
  }

  return { left, right };
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

export function bvhOverlapPairs(bvh: Bvh, ctx: AccelContext): BroadphasePair[] {
  const pairs: BroadphasePair[] = [];
  if (!bvh.root) {
    return pairs;
  }
  collectNodePairs(bvh.root, bvh.root, pairs, ctx);
  return pairs;
}

function collectNodePairs(a: BvhNode, b: BvhNode, pairs: BroadphasePair[], ctx: AccelContext): void {
  if (a === b) {
    if (a.isLeaf) {
      const indices = a.primitiveIndices ?? [];
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          pairs.push({ a: indices[i], b: indices[j] });
        }
      }
      return;
    }
    if (a.left) collectNodePairs(a.left, a.left, pairs, ctx);
    if (a.right) collectNodePairs(a.right, a.right, pairs, ctx);
    if (a.left && a.right) collectNodePairs(a.left, a.right, pairs, ctx);
    return;
  }

  if (!aabbIntersectsAabb(a.aabb, b.aabb)) {
    return;
  }

  if (a.isLeaf && b.isLeaf) {
    const left = a.primitiveIndices ?? [];
    const right = b.primitiveIndices ?? [];
    for (let i = 0; i < left.length; i++) {
      for (let j = 0; j < right.length; j++) {
        const ia = left[i];
        const ib = right[j];
        if (ia === ib) continue;
        pairs.push(ia < ib ? { a: ia, b: ib } : { a: ib, b: ia });
      }
    }
    return;
  }

  // Descend the node with larger surface area first. This keeps the traversal
  // deterministic while reducing duplicate leaf-pair work on unbalanced trees.
  if (!a.isLeaf && (b.isLeaf || surfaceArea(a.aabb) >= surfaceArea(b.aabb))) {
    if (a.left) collectNodePairs(a.left, b, pairs, ctx);
    if (a.right) collectNodePairs(a.right, b, pairs, ctx);
  } else {
    if (b.left) collectNodePairs(a, b.left, pairs, ctx);
    if (b.right) collectNodePairs(a, b.right, pairs, ctx);
  }

  ctx.bvhStack.length = 0;
}

function axisValue(value: { readonly x: number; readonly y: number; readonly z: number }, axis: number): number {
  return axis === 0 ? value.x : axis === 1 ? value.y : value.z;
}

function primitiveCenter(value: Aabb, axis: number): number {
  return (axisValue(value.min, axis) + axisValue(value.max, axis)) * 0.5;
}

function surfaceArea(value: Aabb): number {
  const x = Math.max(0, value.max.x - value.min.x);
  const y = Math.max(0, value.max.y - value.min.y);
  const z = Math.max(0, value.max.z - value.min.z);
  return 2 * (x * y + y * z + z * x);
}

function expandBoundsByAabb(out: MutableAabb, value: Aabb): void {
  out.min.x = Math.min(out.min.x, value.min.x);
  out.min.y = Math.min(out.min.y, value.min.y);
  out.min.z = Math.min(out.min.z, value.min.z);
  out.max.x = Math.max(out.max.x, value.max.x);
  out.max.y = Math.max(out.max.y, value.max.y);
  out.max.z = Math.max(out.max.z, value.max.z);
}

function copyBounds(value: Aabb, out: MutableAabb): void {
  out.min.x = value.min.x;
  out.min.y = value.min.y;
  out.min.z = value.min.z;
  out.max.x = value.max.x;
  out.max.y = value.max.y;
  out.max.z = value.max.z;
}
