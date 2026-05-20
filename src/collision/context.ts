import { mutableVec3 } from "../core/vec3.js";
import type { MutableVec3 } from "../core/vec3.js";

// Squared-length guards. These preserve the original SAT/GJK behavior while
// making the tolerance explicit on `CollisionPolicy`. Keep them squared so the
// hot paths do not take a sqrt just to compare against a threshold.
export const DEFAULT_SAT_PARALLEL_AXIS_EPSILON_SQ = 1e-6;
export const DEFAULT_GJK_DEGENERATE_DIRECTION_EPSILON_SQ = 1e-6;

export interface CollisionPolicy {
  /**
   * Squared length below which an OBB SAT cross axis is treated as parallel
   * and skipped. This is squared because SAT already compares squared axis
   * length in the hot loop.
   */
  readonly satParallelAxisEpsilonSq: number;
  /**
   * Squared length below which a GJK direction is treated as degenerate.
   * The default preserves the historical `1e-6` behavior.
   */
  readonly gjkDegenerateDirectionEpsilonSq: number;
}

export const DEFAULT_COLLISION_POLICY: CollisionPolicy = Object.freeze({
  satParallelAxisEpsilonSq: DEFAULT_SAT_PARALLEL_AXIS_EPSILON_SQ,
  gjkDegenerateDirectionEpsilonSq: DEFAULT_GJK_DEGENERATE_DIRECTION_EPSILON_SQ
});

export class CollisionContext {
  public readonly policy: CollisionPolicy;

  // SAT scratchpad
  public satT: MutableVec3 = mutableVec3();
  public satAxis: MutableVec3 = mutableVec3();
  public satAAxes: MutableVec3[] = [mutableVec3(), mutableVec3(), mutableVec3()];
  public satBAxes: MutableVec3[] = [mutableVec3(), mutableVec3(), mutableVec3()];

  // GJK scratchpad
  public gjkAb: MutableVec3 = mutableVec3();
  public gjkAc: MutableVec3 = mutableVec3();
  public gjkAd: MutableVec3 = mutableVec3();
  public gjkAo: MutableVec3 = mutableVec3();
  public gjkAbc: MutableVec3 = mutableVec3();
  public gjkAcd: MutableVec3 = mutableVec3();
  public gjkAdb: MutableVec3 = mutableVec3();
  public gjkCross1: MutableVec3 = mutableVec3();
  public gjkCross2: MutableVec3 = mutableVec3();
  public gjkNegDir: MutableVec3 = mutableVec3();
  public gjkInitialD: MutableVec3 = mutableVec3();
  public gjkD: MutableVec3 = mutableVec3();
  public gjkSimplex: MutableVec3[] = [mutableVec3(), mutableVec3(), mutableVec3(), mutableVec3()];

  // Support-map scratch shared by GJK, EPA, and MPR. SupportFunctionInto
  // callers write into these slots so support queries do not allocate.
  public supportA: MutableVec3 = mutableVec3();
  public supportB: MutableVec3 = mutableVec3();

  // EPA scratchpad
  public epaNorm: MutableVec3 = mutableVec3();
  public epaEdge: MutableVec3 = mutableVec3();
  public epaTemp: MutableVec3 = mutableVec3();

  // MPR scratchpad
  public mprPortal0: MutableVec3 = mutableVec3();
  public mprPortal1: MutableVec3 = mutableVec3();
  public mprPortal2: MutableVec3 = mutableVec3();
  public mprPortal3: MutableVec3 = mutableVec3();
  public mprCandidate: MutableVec3 = mutableVec3();
  public mprDir: MutableVec3 = mutableVec3();
  public mprNegDir: MutableVec3 = mutableVec3();
  public mprVa: MutableVec3 = mutableVec3();
  public mprVb: MutableVec3 = mutableVec3();
  public mprCross: MutableVec3 = mutableVec3();
  /**
   * Dedicated swap scratch slot so `mprCandidate` is not reused as a
   * three-way temporary during portal discovery. Costs one extra vec3 in
   * exchange for keeping `mprCandidate` semantically a single value.
   */
  public mprSwap: MutableVec3 = mutableVec3();

  constructor(policy: CollisionPolicy = DEFAULT_COLLISION_POLICY) {
    this.policy = policy;
  }
}
