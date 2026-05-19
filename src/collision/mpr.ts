import type { Vec3 } from "../core/vec3.js";
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
  /**
   * The unrefined `b.center - a.center` direction used for the first portal
   * ray test. **This is not a contact normal** — full portal refinement is
   * not implemented yet. Use GJK + EPA when a real contact normal is
   * required.
   */
  readonly initialPortalDirection: Vec3;
}

/**
 * **Experimental MPR stub** (Minkowski Portal Refinement).
 *
 * The committed API shape mirrors the MPR contract — caller supplies a
 * support function plus an interior point — so a real portal-refinement
 * implementation can drop in later without changing the surface. Today's
 * implementation runs the first MPR portal-ray rejection
 * (`support(a, b, dir) · dir < 0` along the centre-to-centre direction)
 * and then **delegates the intersect decision to the existing GJK core**.
 *
 * Concretely this means:
 *
 * - `intersect` is GJK's strict-positive support classification (touching
 *   pairs read as `false`).
 * - `initialPortalDirection` is the raw `b.center - a.center` vector, not a
 *   refined portal normal. For contact normals, use GJK + EPA instead.
 * - The first portal rejection can early-out a clearly separated pair, but
 *   GJK runs in full afterwards. This is intentionally not a performance
 *   win over GJK alone — it is a placeholder for the public API surface.
 *
 * Listed as experimental in `docs/api-stability.md`. Do not depend on the
 * returned direction being any particular vector beyond the rejection
 * guarantee above.
 */
export function mprIntersectExperimental(
  a: MprShape,
  b: MprShape,
  ctx: CollisionContext,
  maxIterations: number = 64
): Result<MprResult> {
  // Initial direction from a's interior to b's interior. If they coincide
  // (shapes share a centre point), fall back to +X so the support call has
  // a defined direction.
  let dirX = b.center.x - a.center.x;
  let dirY = b.center.y - a.center.y;
  let dirZ = b.center.z - a.center.z;
  if (dirX * dirX + dirY * dirY + dirZ * dirZ === 0) {
    dirX = 1;
    dirY = 0;
    dirZ = 0;
  }
  const direction: Vec3 = { x: dirX, y: dirY, z: dirZ };

  // First portal-ray rejection: if the Minkowski support along `direction` is
  // on the wrong side, the shapes are clearly separated.
  const supportA = a.support(direction);
  const supportB = b.support({ x: -dirX, y: -dirY, z: -dirZ });
  const minkowskiDot =
    (supportA.x - supportB.x) * dirX +
    (supportA.y - supportB.y) * dirY +
    (supportA.z - supportB.z) * dirZ;
  if (minkowskiDot < 0) {
    return ok({ intersect: false, initialPortalDirection: direction });
  }

  const result = gjk(a.support, b.support, ctx, maxIterations);
  if (!result.ok) {
    return result;
  }

  return ok({
    intersect: result.value.intersect,
    initialPortalDirection: direction
  });
}

// Re-export shape utilities used by the type signatures so callers do not
// need to chase the helpers separately.
export type { SupportFunction };
