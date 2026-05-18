import { mutableVec3 } from "../core/vec3.js";
import type { MutableVec3 } from "../core/vec3.js";

export class CollisionContext {
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

  // EPA scratchpad
  public epaNorm: MutableVec3 = mutableVec3();
  public epaEdge: MutableVec3 = mutableVec3();
  public epaTemp: MutableVec3 = mutableVec3();
}
