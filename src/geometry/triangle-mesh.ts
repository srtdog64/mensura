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
  if (indices) {
    return {
      vertices,
      indices,
      vertexStride
    };
  }

  return {
    vertices,
    vertexStride
  };
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
