import type { Vec3 } from "../core/vec3.js";
import { dot3, sub3Into, cross3Into, scale3Into } from "../core/vec3.js";
import type { MutableVec3 } from "../core/vec3.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { SupportFunction } from "./gjk.js";
import type { CollisionContext } from "./context.js";

function addSilhouetteEdge(edges: [number, number][], u: number, v: number): void {
  for (let i = 0; i < edges.length; i++) {
    if (edges[i][0] === v && edges[i][1] === u) {
      edges.splice(i, 1);
      return;
    }
  }
  edges.push([u, v]);
}

export interface EpaResult {
  normal: Vec3;
  depth: number;
}

interface Face {
  a: number;
  b: number;
  c: number;
  normal: Vec3;
  distance: number;
}

function epaSupportInto(
  supportA: SupportFunction,
  supportB: SupportFunction,
  ctx: CollisionContext,
  dir: Vec3,
  out: MutableVec3
): MutableVec3 {
  scale3Into(dir, -1, ctx.epaTemp);
  const sA = supportA(dir);
  const sB = supportB(ctx.epaTemp);
  return sub3Into(sA, sB, out);
}

export function epa(
  simplex: ArrayLike<Vec3>,
  simplexSize: number,
  supportA: SupportFunction,
  supportB: SupportFunction,
  ctx: CollisionContext,
  maxIterations: number = 64
): Result<EpaResult> {
  if (simplexSize < 4) {
    return err({
      code: "EPA_DEGENERATE_SIMPLEX",
      message: "EPA requires a tetrahedron simplex with at least 4 points",
      stage: "EpaExpansion",
      retryable: false
    });
  }

  const polytope: Vec3[] = [
    { x: simplex[0].x, y: simplex[0].y, z: simplex[0].z },
    { x: simplex[1].x, y: simplex[1].y, z: simplex[1].z },
    { x: simplex[2].x, y: simplex[2].y, z: simplex[2].z },
    { x: simplex[3].x, y: simplex[3].y, z: simplex[3].z }
  ];
  const faces: Face[] = [];

  const addFace = (a: number, b: number, c: number): Face | null => {
    const vA = polytope[a];
    const vB = polytope[b];
    const vC = polytope[c];

    sub3Into(vB, vA, ctx.epaEdge);
    sub3Into(vC, vA, ctx.epaTemp);
    cross3Into(ctx.epaEdge, ctx.epaTemp, ctx.epaNorm);

    const cx = ctx.epaNorm.x;
    const cy = ctx.epaNorm.y;
    const cz = ctx.epaNorm.z;
    const crossLenSq = cx * cx + cy * cy + cz * cz;

    if (crossLenSq < 1e-6) {
      return null;
    }

    const invLen = 1 / Math.sqrt(crossLenSq);
    let nx = cx * invLen;
    let ny = cy * invLen;
    let nz = cz * invLen;
    let distance = nx * vA.x + ny * vA.y + nz * vA.z;

    if (distance < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
      distance = -distance;
    }

    const face: Face = {
      a,
      b,
      c,
      normal: { x: nx, y: ny, z: nz },
      distance
    };
    faces.push(face);
    return face;
  };

  addFace(0, 1, 2);
  addFace(0, 2, 3);
  addFace(0, 3, 1);
  addFace(1, 3, 2);

  if (faces.length === 0) {
    return err({
      code: "EPA_DEGENERATE_SIMPLEX",
      message: "EPA could not build non-degenerate simplex faces",
      stage: "EpaExpansion",
      retryable: false
    });
  }

  for (let i = 0; i < maxIterations; i++) {
    // Find closest face
    let closestFaceIndex = 0;
    let minDistance = Infinity;

    for (let j = 0; j < faces.length; j++) {
      if (faces[j].distance < minDistance) {
        minDistance = faces[j].distance;
        closestFaceIndex = j;
      }
    }

    const closestFace = faces[closestFaceIndex];
    if (!closestFace) {
      return err({
        code: "EPA_DEGENERATE_SIMPLEX",
        message: "EPA encountered degenerate simplex faces",
        stage: "EpaExpansion",
        retryable: false
      });
    }

    epaSupportInto(supportA, supportB, ctx, closestFace.normal, ctx.epaTemp);
    const p = { x: ctx.epaTemp.x, y: ctx.epaTemp.y, z: ctx.epaTemp.z };
    const d = dot3(p, closestFace.normal);

    if (d - minDistance < 1e-4) {
      return ok({
        normal: closestFace.normal,
        depth: d
      });
    }

    // Expand polytope: collect silhouette edges from faces visible from p,
    // then remove those faces.
    const edges: [number, number][] = [];

    for (let j = faces.length - 1; j >= 0; j--) {
      const face = faces[j];
      const anchor = polytope[face.a];
      const visible =
        face.normal.x * (p.x - anchor.x) +
        face.normal.y * (p.y - anchor.y) +
        face.normal.z * (p.z - anchor.z) > 0;

      if (visible) {
        addSilhouetteEdge(edges, face.a, face.b);
        addSilhouetteEdge(edges, face.b, face.c);
        addSilhouetteEdge(edges, face.c, face.a);
        faces.splice(j, 1);
      }
    }

    const newIdx = polytope.length;
    polytope.push(p);

    for (let k = 0; k < edges.length; k++) {
      const edge = edges[k];
      addFace(edge[0], edge[1], newIdx);
    }
  }

  return err({
    code: "EPA_MAX_ITERATIONS",
    message: "EPA algorithm exceeded maximum iterations",
    stage: "EpaExpansion",
    retryable: false
  });
}
