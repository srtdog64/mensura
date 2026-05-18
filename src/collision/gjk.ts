import type { Vec3 } from "../core/vec3.js";
import { dot3, lengthSq3, sub3Into, scale3Into, cross3Into, copy3Into } from "../core/vec3.js";
import type { MutableVec3 } from "../core/vec3.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { CollisionContext } from "./context.js";

export type SupportFunction = (direction: Vec3) => Vec3;

export interface GjkResult {
  /** True when the Minkowski difference contains the origin. */
  intersect: boolean;
  /**
   * View into `ctx.gjkSimplex`. Valid until the next `gjk()` call on the same
   * context. Copy with `copy3Into` if the caller needs to retain the points.
   */
  simplex: readonly MutableVec3[];
  /** Number of meaningful entries in `simplex` (1..4). */
  simplexSize: number;
}

function gjkSupportInto(
  supportA: SupportFunction,
  supportB: SupportFunction,
  ctx: CollisionContext,
  dir: Vec3,
  out: MutableVec3
): MutableVec3 {
  scale3Into(dir, -1, ctx.gjkNegDir);
  const sA = supportA(dir);
  const sB = supportB(ctx.gjkNegDir);
  return sub3Into(sA, sB, out);
}

export function gjk(
  supportA: SupportFunction,
  supportB: SupportFunction,
  ctx: CollisionContext,
  maxIterations: number = 64
): Result<GjkResult> {
  const simplex = ctx.gjkSimplex;
  const d = ctx.gjkD;
  const initialD = ctx.gjkInitialD;

  initialD.x = 1;
  initialD.y = 0;
  initialD.z = 0;

  gjkSupportInto(supportA, supportB, ctx, initialD, simplex[0]);
  let simplexSize = 1;

  d.x = -simplex[0].x;
  d.y = -simplex[0].y;
  d.z = -simplex[0].z;

  for (let i = 0; i < maxIterations; i++) {
    gjkSupportInto(supportA, supportB, ctx, d, simplex[simplexSize]);
    const a = simplex[simplexSize];

    if (dot3(a, d) <= 0) {
      return ok({ intersect: false, simplex, simplexSize });
    }

    simplexSize++;

    const newSize = handleSimplex(simplex, d, simplexSize, ctx);
    if (newSize === 0) {
      return ok({ intersect: true, simplex, simplexSize });
    }
    simplexSize = newSize;
  }

  return err({
    code: "GJK_MAX_ITERATIONS",
    message: "GJK algorithm exceeded maximum iterations without resolving",
    stage: "GjkIteration",
    retryable: false
  });
}

function handleSimplex(simplex: MutableVec3[], d: MutableVec3, size: number, ctx: CollisionContext): number {
  if (size === 2) {
    return line(simplex, d, ctx);
  } else if (size === 3) {
    return triangle(simplex, d, ctx);
  } else if (size === 4) {
    return tetrahedron(simplex, d, ctx);
  }
  return size;
}

function line(simplex: MutableVec3[], d: MutableVec3, ctx: CollisionContext): number {
  const a = simplex[1];
  const b = simplex[0];
  sub3Into(b, a, ctx.gjkAb);
  scale3Into(a, -1, ctx.gjkAo);

  if (dot3(ctx.gjkAb, ctx.gjkAo) > 0) {
    cross3Into(ctx.gjkAb, ctx.gjkAo, ctx.gjkCross1);
    cross3Into(ctx.gjkCross1, ctx.gjkAb, ctx.gjkCross2);
    if (lengthSq3(ctx.gjkCross2) < 1e-6) {
        return 0; // intersection
    }
    copy3Into(ctx.gjkCross2, d);
    return 2;
  } else {
    copy3Into(a, simplex[0]);
    copy3Into(ctx.gjkAo, d);
    return 1;
  }
}

function triangle(simplex: MutableVec3[], d: MutableVec3, ctx: CollisionContext): number {
  const a = simplex[2];
  const b = simplex[1];
  const c = simplex[0];

  sub3Into(b, a, ctx.gjkAb);
  sub3Into(c, a, ctx.gjkAc);
  scale3Into(a, -1, ctx.gjkAo);

  cross3Into(ctx.gjkAb, ctx.gjkAc, ctx.gjkAbc);

  cross3Into(ctx.gjkAbc, ctx.gjkAc, ctx.gjkCross1);
  if (dot3(ctx.gjkCross1, ctx.gjkAo) > 0) {
    if (dot3(ctx.gjkAc, ctx.gjkAo) > 0) {
      copy3Into(c, simplex[0]);
      copy3Into(a, simplex[1]);
      cross3Into(ctx.gjkAc, ctx.gjkAo, ctx.gjkCross1);
      cross3Into(ctx.gjkCross1, ctx.gjkAc, d);
      return 2;
    } else {
      copy3Into(b, simplex[0]);
      copy3Into(a, simplex[1]);
      return line(simplex, d, ctx);
    }
  } else {
    cross3Into(ctx.gjkAb, ctx.gjkAbc, ctx.gjkCross1);
    if (dot3(ctx.gjkCross1, ctx.gjkAo) > 0) {
      copy3Into(b, simplex[0]);
      copy3Into(a, simplex[1]);
      return line(simplex, d, ctx);
    } else {
      if (dot3(ctx.gjkAbc, ctx.gjkAo) > 0) {
        copy3Into(ctx.gjkAbc, d);
        return 3;
      } else {
        copy3Into(b, simplex[0]);
        copy3Into(c, simplex[1]);
        copy3Into(a, simplex[2]);
        scale3Into(ctx.gjkAbc, -1, d);
        return 3;
      }
    }
  }
}

function tetrahedron(simplex: MutableVec3[], d: MutableVec3, ctx: CollisionContext): number {
  const a = simplex[3];
  const b = simplex[2];
  const c = simplex[1];
  const dNode = simplex[0];

  sub3Into(b, a, ctx.gjkAb);
  sub3Into(c, a, ctx.gjkAc);
  sub3Into(dNode, a, ctx.gjkAd);
  scale3Into(a, -1, ctx.gjkAo);

  cross3Into(ctx.gjkAb, ctx.gjkAc, ctx.gjkAbc);
  cross3Into(ctx.gjkAc, ctx.gjkAd, ctx.gjkAcd);
  cross3Into(ctx.gjkAd, ctx.gjkAb, ctx.gjkAdb);

  if (dot3(ctx.gjkAbc, ctx.gjkAo) > 0) {
    copy3Into(c, simplex[0]);
    copy3Into(b, simplex[1]);
    copy3Into(a, simplex[2]);
    return triangle(simplex, d, ctx);
  }

  if (dot3(ctx.gjkAcd, ctx.gjkAo) > 0) {
    copy3Into(dNode, simplex[0]);
    copy3Into(c, simplex[1]);
    copy3Into(a, simplex[2]);
    return triangle(simplex, d, ctx);
  }

  if (dot3(ctx.gjkAdb, ctx.gjkAo) > 0) {
    copy3Into(b, simplex[0]);
    copy3Into(dNode, simplex[1]);
    copy3Into(a, simplex[2]);
    return triangle(simplex, d, ctx);
  }

  return 0; // intersection
}
