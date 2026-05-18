import type { Vec3 } from "../core/vec3.js";
import { vec3, sub3, dot3, cross3, normalize3, lengthSq3, scale3 } from "../core/vec3.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { SupportFunction } from "./gjk.js";

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

export function epa(
  simplex: Vec3[],
  supportA: SupportFunction,
  supportB: SupportFunction,
  maxIterations: number = 64
): Result<EpaResult> {
  const support = (dir: Vec3) => sub3(supportA(dir), supportB(scale3(dir, -1)));

  const polytope = [...simplex];
  const faces: Face[] = [];

  const addFace = (a: number, b: number, c: number): Face | null => {
    const vA = polytope[a];
    const vB = polytope[b];
    const vC = polytope[c];
    
    let normal = normalize3(cross3(sub3(vB, vA), sub3(vC, vA)));
    let distance = dot3(normal, vA);

    if (distance < 0) {
      normal = scale3(normal, -1);
      distance = -distance;
    }

    if (lengthSq3(normal) < 1e-6) {
      return null;
    }

    const face = { a, b, c, normal, distance };
    faces.push(face);
    return face;
  };

  addFace(0, 1, 2);
  addFace(0, 2, 3);
  addFace(0, 3, 1);
  addFace(1, 3, 2);

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

    const p = support(closestFace.normal);
    const d = dot3(p, closestFace.normal);

    if (d - minDistance < 1e-4) {
      return ok({
        normal: closestFace.normal,
        depth: d
      });
    }

    // Expand polytope (silhouette edges logic omitted for brevity, simplified to complete the shape)
    // Note: Full EPA requires edge removal and silhouette finding.
    // We append the point and rebuild faces that face the point.
    const edges: [number, number][] = [];
    
    for (let j = faces.length - 1; j >= 0; j--) {
      const face = faces[j];
      if (dot3(face.normal, sub3(p, polytope[face.a])) > 0) {
        // Face is visible from p, remove it and add edges to silhouette
        const addEdge = (u: number, v: number) => {
          const edgeIdx = edges.findIndex(e => e[0] === v && e[1] === u);
          if (edgeIdx >= 0) {
            edges.splice(edgeIdx, 1);
          } else {
            edges.push([u, v]);
          }
        };
        addEdge(face.a, face.b);
        addEdge(face.b, face.c);
        addEdge(face.c, face.a);
        faces.splice(j, 1);
      }
    }

    const newIdx = polytope.length;
    polytope.push(p);

    for (const [u, v] of edges) {
      addFace(u, v, newIdx);
    }
  }

  return err({
    code: "EPA_MAX_ITERATIONS",
    message: "EPA algorithm exceeded maximum iterations",
    stage: "EpaExpansion",
    retryable: false
  });
}
