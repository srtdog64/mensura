import {
  mat4Identity,
  mat4Translation,
  mutableVec3,
  vec3
} from "@exornea/mensura/core";
import {
  add3IntoMany,
  cross3IntoMany,
  dot3IntoMany,
  mat4TransformAffinePoint3IntoMany,
  mat4TransformPoint3IntoMany,
  normalize3IntoMany
} from "@exornea/mensura/batch";
import {
  unsafeMat4TransformAffinePoint3F32Many,
  unsafeVec3AddF32Many,
  unsafeVec3CrossF32Many,
  unsafeVec3DotF32Many,
  unsafeVec3NormalizeF32Many
} from "@exornea/mensura/unsafe";

// 1. Batch over semantic objects
//
// When you already hold Vec3 objects (positions in a scene graph, vertex
// attributes, parsed glTF buffers), the batch entry points hoist matrix reads
// and amortize call overhead. Outputs are caller-owned MutableVec3 objects.

const N = 1024;
const positions = Array.from({ length: N }, (_, i) =>
  vec3(i * 0.01, i * 0.02, i * 0.03)
);
const velocities = Array.from({ length: N }, (_, i) =>
  vec3(0.1, 0.2, i * 0.001)
);
const positionOut = Array.from({ length: N }, () => mutableVec3());
const dotOut = new Float64Array(N);

// vec3 add: positions += velocities (this frame)
add3IntoMany(positions, velocities, positionOut, N);

// dot products: e.g. lighting N.L per vertex
dot3IntoMany(positions, velocities, dotOut, N);

// cross products: surface tangent/bitangent
const tangentOut = Array.from({ length: N }, () => mutableVec3());
cross3IntoMany(positions, velocities, tangentOut, N);

// Normalize after accumulating
normalize3IntoMany(positionOut, positionOut, N);

// Transform N points by one matrix. Use affine when the matrix has no
// perspective row (model/view); it skips the w-divide.
const modelMatrix = mat4Translation(vec3(1, 2, 3));
mat4TransformAffinePoint3IntoMany(modelMatrix, positionOut, positionOut, N);

// Use the perspective-aware variant when the matrix has a non-trivial
// fourth row (projection, MVP).
const mvp = mat4Identity();
mvp[3] = 0.01; // arbitrary perspective row
mvp[11] = -1;
mat4TransformPoint3IntoMany(mvp, positionOut, positionOut, N);

console.log("batch positionOut[0]:", positionOut[0]);
console.log("batch dotOut[0]:", dotOut[0]);
console.log("batch tangentOut[0]:", tangentOut[0]);

// 2. Packed Float32Array via unsafe/*
//
// When the buffer is already packed (SharedArrayBuffer for Worker handoff,
// GPU upload staging, parsed binary asset), drop straight to unsafe. No
// allocation, no copy, no per-element function call.

const sharedA = new SharedArrayBuffer(N * 3 * 4);
const sharedB = new SharedArrayBuffer(N * 3 * 4);
const sharedOut = new SharedArrayBuffer(N * 3 * 4);
const dotScratch = new Float32Array(N);

const viewA = new Float32Array(sharedA);
const viewB = new Float32Array(sharedB);
const viewOut = new Float32Array(sharedOut);

// Seed (copy the semantic-object positions in)
for (let i = 0; i < N; i++) {
  viewA[i * 3 + 0] = positions[i].x;
  viewA[i * 3 + 1] = positions[i].y;
  viewA[i * 3 + 2] = positions[i].z;
  viewB[i * 3 + 0] = velocities[i].x;
  viewB[i * 3 + 1] = velocities[i].y;
  viewB[i * 3 + 2] = velocities[i].z;
}

// Now operate directly on packed memory. Same buffer is visible from any
// worker that received the SharedArrayBuffer via postMessage.
unsafeVec3AddF32Many(viewA, viewB, viewOut, N);
unsafeVec3DotF32Many(viewA, viewB, dotScratch, N);
unsafeVec3CrossF32Many(viewA, viewB, viewOut, N);
unsafeVec3NormalizeF32Many(viewOut, viewOut, N);

// Transform N packed points by one packed matrix. Caller is responsible for
// publication (e.g. Atomics) before another worker reads the result.
const packedMvp = new Float32Array(16);
packedMvp[0] = 1;
packedMvp[5] = 1;
packedMvp[10] = 1;
packedMvp[12] = 1;
packedMvp[13] = 2;
packedMvp[14] = 3;
packedMvp[15] = 1;
unsafeMat4TransformAffinePoint3F32Many(packedMvp, 0, viewA, viewOut, N);

console.log("unsafe viewOut[0..3]:", viewOut[0], viewOut[1], viewOut[2]);
console.log("unsafe dotScratch[0]:", dotScratch[0]);

// 3. Rule of thumb
//
// - N < 64: per-call Into is fine; batch overhead does not pay back.
// - N >= 64, semantic objects: batch IntoMany.
// - N >= 64, packed Float32Array (or SharedArrayBuffer): unsafe*F32Many.
// - mat4 multiply: scalar Into is already at the SIMD-free ceiling on V8;
//   don't reach for unsafe here; measure first.
