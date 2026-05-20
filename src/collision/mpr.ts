import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { copy3Into, cross3Into, dot3, lengthSq3, scale3Into, sub3Into } from "../core/vec3.js";
import type { Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { CollisionContext } from "./context.js";
import type { SupportFunctionInto } from "./gjk.js";

const DEFAULT_MPR_TOLERANCE = 1e-9;

export interface MprShape {
  /**
   * Interior point used to seed the Minkowski portal. For common primitive
   * shapes this is the geometric center.
   */
  readonly center: Vec3;
  readonly supportInto: SupportFunctionInto;
}

export interface MprResult {
  /** True when the two closed convex support-mapped shapes overlap with positive volume. */
  readonly intersect: boolean;
  /**
   * Direction reported alongside the binary classification.
   *
   * - When `portalRefined` is `true`, this is the **refined portal face
   *   direction** in the Minkowski difference. It is useful for diagnostics
   *   and binary-query inspection, but it is not a penetration normal/depth
   *   pair and should not be treated as a full contact manifold.
   * - When `portalRefined` is `false`, this is the **initial query direction**
   *   (`-v0`, the seed ray from `b.center` toward `a.center`) used for the
   *   early support test, or the `+X` fallback used when the two interior
   *   points coincide. Treat it as a query hint, not a contact normal.
   *
   * Components are sign-normalised so `-0` never leaks into the result.
   */
  readonly portalDirection: Vec3;
  /**
   * `true` when `portalDirection` came from a non-degenerate refined portal
   * face. Early-exit results (centres coincide, first support rejects,
   * collinear seed simplex, or degenerate portal faces) report `false`.
   */
  readonly portalRefined: boolean;
  /** Number of portal refinement/discovery support iterations consumed. */
  readonly iterations: number;
}

type PortalDiscoveryStatus = "miss" | "hit" | "portal";

interface PortalDiscovery {
  readonly status: PortalDiscoveryStatus;
  readonly iterations: number;
  /** Whether `ctx.mprDir` already holds a refined face normal. */
  readonly portalRefined: boolean;
}

/**
 * Minkowski Portal Refinement intersection query for convex support-mapped
 * shapes.
 *
 * The algorithm builds a tetrahedral portal in the Minkowski difference from
 * an interior point ray, then refines the portal face with new support points
 * until the face contains the origin or the Minkowski difference can no longer
 * advance toward it. The boundary policy matches Mensura's GJK query: exact
 * touching without positive overlap is reported as `false`.
 */
export function mprIntersect(
  a: MprShape,
  b: MprShape,
  ctx: CollisionContext,
  maxIterations: number = 64,
  tolerance: number = DEFAULT_MPR_TOLERANCE
): Result<MprResult> {
  const iterationLimit = maxIterations | 0;
  if (iterationLimit <= 0) {
    return mprIterationError(iterationLimit);
  }

  const discovery = discoverPortal(a, b, ctx, iterationLimit, tolerance);
  if (!discovery.ok) {
    return discovery;
  }
  if (discovery.value.status === "miss") {
    return ok({
      intersect: false,
      portalDirection: copyPortalDirection(ctx),
      portalRefined: discovery.value.portalRefined,
      iterations: discovery.value.iterations
    });
  }
  if (discovery.value.status === "hit") {
    return ok({
      intersect: true,
      portalDirection: copyPortalDirection(ctx),
      portalRefined: discovery.value.portalRefined,
      iterations: discovery.value.iterations
    });
  }

  return refinePortal(a, b, ctx, iterationLimit, tolerance, discovery.value.iterations);
}

function discoverPortal(
  a: MprShape,
  b: MprShape,
  ctx: CollisionContext,
  maxIterations: number,
  tolerance: number
): Result<PortalDiscovery> {
  const v0 = ctx.mprPortal0;
  const v1 = ctx.mprPortal1;
  const v2 = ctx.mprPortal2;
  const v3 = ctx.mprPortal3;
  const dir = ctx.mprDir;
  const va = ctx.mprVa;
  const vb = ctx.mprVb;
  const toleranceSq = tolerance * tolerance;

  sub3Into(a.center, b.center, v0);
  if (lengthSq3(v0) <= toleranceSq) {
    dir.x = 1;
    dir.y = 0;
    dir.z = 0;
    return ok({ status: "hit", iterations: 0, portalRefined: false });
  }

  normalizeComponentsInto(-v0.x, -v0.y, -v0.z, dir, tolerance);
  supportMinkowskiInto(a, b, dir, ctx, v1);
  if (dot3(v1, dir) <= tolerance) {
    return ok({ status: "miss", iterations: 1, portalRefined: false });
  }

  cross3Into(v0, v1, dir);
  if (lengthSq3(dir) <= toleranceSq) {
    normalizeComponentsInto(-v0.x, -v0.y, -v0.z, dir, tolerance);
    return ok({ status: "hit", iterations: 1, portalRefined: false });
  }
  normalizeInto(dir, tolerance);
  supportMinkowskiInto(a, b, dir, ctx, v2);
  if (dot3(v2, dir) <= tolerance) {
    return ok({ status: "miss", iterations: 2, portalRefined: false });
  }

  sub3Into(v1, v0, va);
  sub3Into(v2, v0, vb);
  cross3Into(va, vb, dir);
  if (!normalizeInto(dir, tolerance)) {
    return ok({ status: "hit", iterations: 2, portalRefined: false });
  }
  if (dot3(dir, v0) > 0) {
    swapInto(v1, v2, ctx.mprSwap);
    scale3Into(dir, -1, dir);
  }

  let iterations = 2;
  while (iterations < maxIterations) {
    supportMinkowskiInto(a, b, dir, ctx, v3);
    iterations++;

    if (dot3(v3, dir) <= tolerance) {
      return ok({ status: "miss", iterations, portalRefined: false });
    }

    let changed = false;
    cross3Into(v1, v3, va);
    if (dot3(va, v0) < -tolerance) {
      copy3Into(v3, v2);
      changed = true;
    } else {
      cross3Into(v3, v2, va);
      if (dot3(va, v0) < -tolerance) {
        copy3Into(v3, v1);
        changed = true;
      }
    }

    if (!changed) {
      return ok({ status: "portal", iterations, portalRefined: false });
    }

    sub3Into(v1, v0, va);
    sub3Into(v2, v0, vb);
    cross3Into(va, vb, dir);
    if (!normalizeInto(dir, tolerance)) {
      return ok({ status: "hit", iterations, portalRefined: false });
    }
  }

  return mprIterationError(maxIterations);
}

function refinePortal(
  a: MprShape,
  b: MprShape,
  ctx: CollisionContext,
  maxIterations: number,
  tolerance: number,
  iterationsSoFar: number
): Result<MprResult> {
  const dir = ctx.mprDir;
  const candidate = ctx.mprCandidate;
  let iterations = iterationsSoFar;

  while (iterations < maxIterations) {
    if (!portalDirectionInto(ctx, dir, tolerance)) {
      return ok({
        intersect: true,
        portalDirection: copyPortalDirection(ctx),
        portalRefined: false,
        iterations
      });
    }

    if (dot3(dir, ctx.mprPortal1) > tolerance) {
      return ok({
        intersect: true,
        portalDirection: copyPortalDirection(ctx),
        portalRefined: true,
        iterations
      });
    }

    supportMinkowskiInto(a, b, dir, ctx, candidate);
    iterations++;

    if (dot3(candidate, dir) <= tolerance || portalReachTolerance(ctx, candidate, dir, tolerance)) {
      return ok({
        intersect: false,
        portalDirection: copyPortalDirection(ctx),
        portalRefined: true,
        iterations
      });
    }

    expandPortal(ctx, candidate);
  }

  return mprIterationError(maxIterations);
}

function supportMinkowskiInto(
  a: MprShape,
  b: MprShape,
  direction: Vec3,
  ctx: CollisionContext,
  out: MutableVec3
): MutableVec3 {
  ctx.mprNegDir.x = -direction.x;
  ctx.mprNegDir.y = -direction.y;
  ctx.mprNegDir.z = -direction.z;
  a.supportInto(direction, ctx.supportA);
  b.supportInto(ctx.mprNegDir, ctx.supportB);
  out.x = ctx.supportA.x - ctx.supportB.x;
  out.y = ctx.supportA.y - ctx.supportB.y;
  out.z = ctx.supportA.z - ctx.supportB.z;
  return out;
}

function portalDirectionInto(ctx: CollisionContext, out: MutableVec3, tolerance: number): boolean {
  sub3Into(ctx.mprPortal2, ctx.mprPortal1, ctx.mprVa);
  sub3Into(ctx.mprPortal3, ctx.mprPortal1, ctx.mprVb);
  cross3Into(ctx.mprVa, ctx.mprVb, out);
  return normalizeInto(out, tolerance);
}

function portalReachTolerance(
  ctx: CollisionContext,
  candidate: Vec3,
  direction: Vec3,
  tolerance: number
): boolean {
  const candidateDot = dot3(candidate, direction);
  const d1 = candidateDot - dot3(ctx.mprPortal1, direction);
  const d2 = candidateDot - dot3(ctx.mprPortal2, direction);
  const d3 = candidateDot - dot3(ctx.mprPortal3, direction);
  return Math.min(d1, d2, d3) <= tolerance;
}

function expandPortal(ctx: CollisionContext, candidate: Vec3): void {
  cross3Into(candidate, ctx.mprPortal0, ctx.mprCross);
  if (dot3(ctx.mprPortal1, ctx.mprCross) > 0) {
    if (dot3(ctx.mprPortal2, ctx.mprCross) > 0) {
      copy3Into(candidate, ctx.mprPortal1);
    } else {
      copy3Into(candidate, ctx.mprPortal3);
    }
  } else if (dot3(ctx.mprPortal3, ctx.mprCross) > 0) {
    copy3Into(candidate, ctx.mprPortal2);
  } else {
    copy3Into(candidate, ctx.mprPortal1);
  }
}

/**
 * Copy the current portal direction out of `ctx.mprDir` into a fresh `Vec3`,
 * normalising signed zero so `-0` never leaks into the result. Callers that
 * compare components with `===` against `0` rely on this — the rest of
 * mensura keeps `-0` distinct.
 */
function copyPortalDirection(ctx: CollisionContext): Vec3 {
  return {
    x: cleanZero(ctx.mprDir.x),
    y: cleanZero(ctx.mprDir.y),
    z: cleanZero(ctx.mprDir.z)
  };
}

function mprIterationError<T = MprResult>(maxIterations: number): Result<T> {
  return err({
    code: "MPR_MAX_ITERATIONS",
    message: "MPR algorithm exceeded maximum iterations without resolving",
    stage: "MprIteration",
    retryable: false,
    meta: { maxIterations }
  });
}

function normalizeInto(value: MutableVec3, tolerance: number): boolean {
  return normalizeComponentsInto(value.x, value.y, value.z, value, tolerance);
}

/**
 * MPR uses a tolerance-aware normalize that reports success/failure. The
 * mensura `normalize3Into` always normalises and never signals an empty
 * input, so MPR carries its own variant.
 */
function normalizeComponentsInto(
  x: number,
  y: number,
  z: number,
  out: MutableVec3,
  tolerance: number
): boolean {
  const lenSq = x * x + y * y + z * z;
  if (lenSq <= tolerance * tolerance) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return false;
  }
  const invLen = 1 / Math.sqrt(lenSq);
  out.x = x * invLen;
  out.y = y * invLen;
  out.z = z * invLen;
  return true;
}

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function swapInto(a: MutableVec3, b: MutableVec3, temp: MutableVec3): void {
  copy3Into(a, temp);
  copy3Into(b, a);
  copy3Into(temp, b);
}

export type { SupportFunctionInto };
