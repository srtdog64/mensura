import type { BvhNode } from "./bvh.js";

export class AccelContext {
  public bvhStack: BvhNode[] = [];
}
