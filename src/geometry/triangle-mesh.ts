export interface TriangleMesh {
  readonly vertices: Float32Array;
  readonly indices?: Uint16Array | Uint32Array;
  readonly vertexStride: number;
}

export function triangleMesh(
  vertices: Float32Array,
  indices?: Uint16Array | Uint32Array,
  vertexStride: number = 3
): TriangleMesh {
  if (indices !== undefined) {
    return Object.freeze({
      vertices,
      indices,
      vertexStride
    });
  } else {
    return Object.freeze({
      vertices,
      vertexStride
    }) as TriangleMesh;
  }
}

export function triangleMeshGetVertexCount(mesh: TriangleMesh): number {
  return Math.floor(mesh.vertices.length / mesh.vertexStride);
}

export function triangleMeshGetTriangleCount(mesh: TriangleMesh): number {
  if (mesh.indices) {
    return Math.floor(mesh.indices.length / 3);
  } else {
    return Math.floor(triangleMeshGetVertexCount(mesh) / 3);
  }
}