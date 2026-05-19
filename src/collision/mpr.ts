import type { Vec3 } from "../core/vec3.js";
import { dot3, lengthSq3, sub3 } from "../core/vec3.js";
import type { Result } from "../core/result.js";
import { ok } from "../core/result.js";
import type { CollisionContext } from "./context.js";
import { gjk, type SupportFunction } from "./gjk.js";

export interface MprShape {
  readonly center: Vec3;
  readonly support: SupportFunction;
}

export interface MprResult {
  readonly intersect: boolean;
  readonly portalDirection: Vec3;
}

/**
 * Experimental MPR-style support-map intersection query.
 *
 * The API uses MPR's required inputs: a support function plus an interior point
 * (`center`). For now it performs the same first portal ray rejection MPR uses,
 * then resolves the final convex intersection with the existing context-owned
 * GJK core. That keeps the public shape contract ready for a full portal
 * refinement implementation without shipping an unproven narrowphase in the
 * release path.
 */
export function mprIntersect(
  a: MprShape,
  b: MprShape,
  ctx: CollisionContext,
  maxIterations: number = 64
): Result<MprResult> {
  const portalDirection = sub3(b.center, a.center);
  let dir = portalDirection;
  if (lengthSq3(dir) === 0) {
    dir = { x: 1, y: 0, z: 0 };
  }

  const first = supportMinkowski(a.support, b.support, dir);
  if (dot3(first, dir) < 0) {
    return ok({ intersect: false, portalDirection: dir });
  }

  const result = gjk(a.support, b.support, ctx, maxIterations);
  if (!result.ok) {
    return result;
  }

  return ok({
    intersect: result.value.intersect,
    portalDirection: dir
  });
}

function supportMinkowski(a: SupportFunction, b: SupportFunction, direction: Vec3): Vec3 {
  const pa = a(direction);
  const pb = b({ x: -direction.x, y: -direction.y, z: -direction.z });
  return {
    x: pa.x - pb.x,
    y: pa.y - pb.y,
    z: pa.z - pb.z
  };
}
