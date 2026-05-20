import type { Obb } from "../geometry/obb.js";
import type { MutableVec3 } from "../core/vec3.js";
import { dot3, cross3Into, sub3Into, lengthSq3 } from "../core/vec3.js";
import type { CollisionContext } from "./context.js";

export type SatTraceEvent =
  | {
      readonly type: "axis-tested";
      readonly group: "a" | "b" | "cross";
      readonly axisA?: number;
      readonly axisB?: number;
      readonly distance: number;
      readonly radiusA: number;
      readonly radiusB: number;
      readonly separated: boolean;
    }
  | {
      readonly type: "parallel-axis-skipped";
      readonly axisA: number;
      readonly axisB: number;
      readonly lengthSq: number;
      readonly epsilonSq: number;
    };

export type SatTraceSink = (event: SatTraceEvent) => void;

function extractObbAxes(obb: Obb, out: MutableVec3[]) {
  const rot = obb.rotation;
  out[0].x = rot[0]; out[0].y = rot[1]; out[0].z = rot[2];
  out[1].x = rot[3]; out[1].y = rot[4]; out[1].z = rot[5];
  out[2].x = rot[6]; out[2].y = rot[7]; out[2].z = rot[8];
}

export function testObbObbSat(a: Obb, b: Obb, ctx: CollisionContext): boolean {
  return testObbObbSatInternal(a, b, ctx);
}

export function testObbObbSatTrace(a: Obb, b: Obb, ctx: CollisionContext, trace: SatTraceSink): boolean {
  return testObbObbSatInternal(a, b, ctx, trace);
}

function testObbObbSatInternal(a: Obb, b: Obb, ctx: CollisionContext, trace?: SatTraceSink): boolean {
  extractObbAxes(a, ctx.satAAxes);
  extractObbAxes(b, ctx.satBAxes);

  sub3Into(b.center, a.center, ctx.satT);

  // 3 axes from A
  for (let i = 0; i < 3; i++) {
    const rA = a.extents.x * Math.abs(dot3(ctx.satAAxes[i], ctx.satAAxes[0])) +
               a.extents.y * Math.abs(dot3(ctx.satAAxes[i], ctx.satAAxes[1])) +
               a.extents.z * Math.abs(dot3(ctx.satAAxes[i], ctx.satAAxes[2]));
    const rB = b.extents.x * Math.abs(dot3(ctx.satAAxes[i], ctx.satBAxes[0])) +
               b.extents.y * Math.abs(dot3(ctx.satAAxes[i], ctx.satBAxes[1])) +
               b.extents.z * Math.abs(dot3(ctx.satAAxes[i], ctx.satBAxes[2]));
    const distance = Math.abs(dot3(ctx.satT, ctx.satAAxes[i]));
    if (emitAxisTrace(trace, "a", i, undefined, distance, rA, rB)) return false;
  }

  // 3 axes from B
  for (let i = 0; i < 3; i++) {
    const rA = a.extents.x * Math.abs(dot3(ctx.satBAxes[i], ctx.satAAxes[0])) +
               a.extents.y * Math.abs(dot3(ctx.satBAxes[i], ctx.satAAxes[1])) +
               a.extents.z * Math.abs(dot3(ctx.satBAxes[i], ctx.satAAxes[2]));
    const rB = b.extents.x * Math.abs(dot3(ctx.satBAxes[i], ctx.satBAxes[0])) +
               b.extents.y * Math.abs(dot3(ctx.satBAxes[i], ctx.satBAxes[1])) +
               b.extents.z * Math.abs(dot3(ctx.satBAxes[i], ctx.satBAxes[2]));
    const distance = Math.abs(dot3(ctx.satT, ctx.satBAxes[i]));
    if (emitAxisTrace(trace, "b", undefined, i, distance, rA, rB)) return false;
  }

  // 9 cross products
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      cross3Into(ctx.satAAxes[i], ctx.satBAxes[j], ctx.satAxis);
      const lengthSq = lengthSq3(ctx.satAxis);
      const epsilonSq = ctx.policy.satParallelAxisEpsilonSq;
      if (lengthSq < epsilonSq) {
        trace?.({
          type: "parallel-axis-skipped",
          axisA: i,
          axisB: j,
          lengthSq,
          epsilonSq
        });
        continue;
      }

      const rA = a.extents.x * Math.abs(dot3(ctx.satAxis, ctx.satAAxes[0])) +
                 a.extents.y * Math.abs(dot3(ctx.satAxis, ctx.satAAxes[1])) +
                 a.extents.z * Math.abs(dot3(ctx.satAxis, ctx.satAAxes[2]));
      const rB = b.extents.x * Math.abs(dot3(ctx.satAxis, ctx.satBAxes[0])) +
                 b.extents.y * Math.abs(dot3(ctx.satAxis, ctx.satBAxes[1])) +
                 b.extents.z * Math.abs(dot3(ctx.satAxis, ctx.satBAxes[2]));
      const distance = Math.abs(dot3(ctx.satT, ctx.satAxis));
      if (emitAxisTrace(trace, "cross", i, j, distance, rA, rB)) return false;
    }
  }

  return true;
}

function emitAxisTrace(
  trace: SatTraceSink | undefined,
  group: "a" | "b" | "cross",
  axisA: number | undefined,
  axisB: number | undefined,
  distance: number,
  radiusA: number,
  radiusB: number
): boolean {
  const separated = distance > radiusA + radiusB;
  if (trace) {
    const event: SatTraceEvent = {
      type: "axis-tested",
      group,
      distance,
      radiusA,
      radiusB,
      separated,
      ...(axisA !== undefined ? { axisA } : {}),
      ...(axisB !== undefined ? { axisB } : {})
    };
    trace(event);
  }
  return separated;
}
