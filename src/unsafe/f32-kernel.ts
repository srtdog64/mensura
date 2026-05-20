// Unsafe kernels spell out stride constants in the loop bodies on purpose:
// vec3 = 3 floats, WGSL vec3<f32> = 4-float / 16-byte stride, quat = 4 floats,
// mat4 = 16 floats. These are data-layout contracts, not arbitrary magic
// numbers. Keep layout-specific variants separate so callers opt in explicitly
// and benchmark gates can judge each packed path on the current Node/V8.

export function unsafeVec3AddF32(
  a: Float32Array,
  aOffset: number,
  b: Float32Array,
  bOffset: number,
  out: Float32Array,
  outOffset: number
): void {
  out[outOffset + 0] = a[aOffset + 0] + b[bOffset + 0];
  out[outOffset + 1] = a[aOffset + 1] + b[bOffset + 1];
  out[outOffset + 2] = a[aOffset + 2] + b[bOffset + 2];
}

export function unsafeVec3AddF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    out[offset + 0] = a[offset + 0] + b[offset + 0];
    out[offset + 1] = a[offset + 1] + b[offset + 1];
    out[offset + 2] = a[offset + 2] + b[offset + 2];
  }
}

export function unsafeVec3NormalizeF32Many(
  values: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const x = values[offset + 0];
    const y = values[offset + 1];
    const z = values[offset + 2];
    const lenSq = x * x + y * y + z * z;

    if (lenSq > 0) {
      const invLen = 1 / Math.sqrt(lenSq);
      out[offset + 0] = x * invLen;
      out[offset + 1] = y * invLen;
      out[offset + 2] = z * invLen;
    } else {
      out[offset + 0] = 0;
      out[offset + 1] = 0;
      out[offset + 2] = 0;
    }
  }
}

export function unsafeMat4TransformAffinePoint3F32Many(
  matrix: Float32Array,
  matrixOffset: number,
  points: Float32Array,
  out: Float32Array,
  count: number
): void {
  const xAxisX = matrix[matrixOffset + 0];
  const xAxisY = matrix[matrixOffset + 1];
  const xAxisZ = matrix[matrixOffset + 2];
  const yAxisX = matrix[matrixOffset + 4];
  const yAxisY = matrix[matrixOffset + 5];
  const yAxisZ = matrix[matrixOffset + 6];
  const zAxisX = matrix[matrixOffset + 8];
  const zAxisY = matrix[matrixOffset + 9];
  const zAxisZ = matrix[matrixOffset + 10];
  const originX = matrix[matrixOffset + 12];
  const originY = matrix[matrixOffset + 13];
  const originZ = matrix[matrixOffset + 14];
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const x = points[offset + 0];
    const y = points[offset + 1];
    const z = points[offset + 2];
    out[offset + 0] = xAxisX * x + yAxisX * y + zAxisX * z + originX;
    out[offset + 1] = xAxisY * x + yAxisY * y + zAxisY * z + originY;
    out[offset + 2] = xAxisZ * x + yAxisZ * y + zAxisZ * z + originZ;
  }
}

export function unsafeVec3SubF32(
  a: Float32Array,
  aOffset: number,
  b: Float32Array,
  bOffset: number,
  out: Float32Array,
  outOffset: number
): void {
  out[outOffset + 0] = a[aOffset + 0] - b[bOffset + 0];
  out[outOffset + 1] = a[aOffset + 1] - b[bOffset + 1];
  out[outOffset + 2] = a[aOffset + 2] - b[bOffset + 2];
}

export function unsafeVec3SubF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    out[offset + 0] = a[offset + 0] - b[offset + 0];
    out[offset + 1] = a[offset + 1] - b[offset + 1];
    out[offset + 2] = a[offset + 2] - b[offset + 2];
  }
}

export function unsafeVec3ScaleF32(
  value: Float32Array,
  valueOffset: number,
  scale: number,
  out: Float32Array,
  outOffset: number
): void {
  out[outOffset + 0] = value[valueOffset + 0] * scale;
  out[outOffset + 1] = value[valueOffset + 1] * scale;
  out[outOffset + 2] = value[valueOffset + 2] * scale;
}

export function unsafeVec3ScaleF32Many(
  values: Float32Array,
  scale: number,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    out[offset + 0] = values[offset + 0] * scale;
    out[offset + 1] = values[offset + 1] * scale;
    out[offset + 2] = values[offset + 2] * scale;
  }
}

/**
 * Add vec3 pairs packed with WGSL `vec3<f32>` alignment: 4-float stride per
 * element (3 used + 1 padding). The padding lane is written to 0 in `out` to
 * keep the buffer deterministic for downstream WGSL/uniform binding.
 */
export function unsafeVec3AddF32ManyStride16(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 4;

  for (let offset = 0; offset < end; offset += 4) {
    out[offset + 0] = a[offset + 0] + b[offset + 0];
    out[offset + 1] = a[offset + 1] + b[offset + 1];
    out[offset + 2] = a[offset + 2] + b[offset + 2];
    out[offset + 3] = 0;
  }
}

export function unsafeVec3DotF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;
  let outIndex = 0;

  for (let offset = 0; offset < end; offset += 3) {
    out[outIndex++] =
      a[offset + 0] * b[offset + 0] +
      a[offset + 1] * b[offset + 1] +
      a[offset + 2] * b[offset + 2];
  }
}

export function unsafeVec3LengthF32Many(
  values: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;
  let outIndex = 0;

  for (let offset = 0; offset < end; offset += 3) {
    const x = values[offset + 0];
    const y = values[offset + 1];
    const z = values[offset + 2];
    out[outIndex++] = Math.sqrt(x * x + y * y + z * z);
  }
}

export function unsafeVec3DistanceF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;
  let outIndex = 0;

  for (let offset = 0; offset < end; offset += 3) {
    const dx = b[offset + 0] - a[offset + 0];
    const dy = b[offset + 1] - a[offset + 1];
    const dz = b[offset + 2] - a[offset + 2];
    out[outIndex++] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

/**
 * `out[i] = a[i] + b[i] * scale` for N packed vec3 elements (stride 3).
 * The 3-input axpy / scaleAndAdd pattern used by integrators and damping.
 */
export function unsafeVec3ScaleAndAddF32Many(
  a: Float32Array,
  b: Float32Array,
  scale: number,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    out[offset + 0] = a[offset + 0] + b[offset + 0] * scale;
    out[offset + 1] = a[offset + 1] + b[offset + 1] * scale;
    out[offset + 2] = a[offset + 2] + b[offset + 2] * scale;
  }
}

/**
 * `out[i] = a[i] * b[i]` for N packed quaternions (stride 4, xyzw order).
 */
export function unsafeQuatMultiplyF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 4;

  for (let offset = 0; offset < end; offset += 4) {
    const ax = a[offset + 0];
    const ay = a[offset + 1];
    const az = a[offset + 2];
    const aw = a[offset + 3];
    const bx = b[offset + 0];
    const by = b[offset + 1];
    const bz = b[offset + 2];
    const bw = b[offset + 3];
    out[offset + 0] = ax * bw + aw * bx + ay * bz - az * by;
    out[offset + 1] = ay * bw + aw * by + az * bx - ax * bz;
    out[offset + 2] = az * bw + aw * bz + ax * by - ay * bx;
    out[offset + 3] = aw * bw - ax * bx - ay * by - az * bz;
  }
}

/**
 * Transform N directions (no translation, no perspective) by the upper-left
 * 3x3 of a 4x4 matrix. Use this for normals and direction vectors; use
 * `unsafeMat4TransformAffinePoint3F32Many` for positions.
 */
export function unsafeMat4TransformDirection3F32Many(
  matrix: Float32Array,
  matrixOffset: number,
  directions: Float32Array,
  out: Float32Array,
  count: number
): void {
  const xAxisX = matrix[matrixOffset + 0];
  const xAxisY = matrix[matrixOffset + 1];
  const xAxisZ = matrix[matrixOffset + 2];
  const yAxisX = matrix[matrixOffset + 4];
  const yAxisY = matrix[matrixOffset + 5];
  const yAxisZ = matrix[matrixOffset + 6];
  const zAxisX = matrix[matrixOffset + 8];
  const zAxisY = matrix[matrixOffset + 9];
  const zAxisZ = matrix[matrixOffset + 10];
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const x = directions[offset + 0];
    const y = directions[offset + 1];
    const z = directions[offset + 2];
    out[offset + 0] = xAxisX * x + yAxisX * y + zAxisX * z;
    out[offset + 1] = xAxisY * x + yAxisY * y + zAxisY * z;
    out[offset + 2] = xAxisZ * x + yAxisZ * y + zAxisZ * z;
  }
}

export function unsafeVec3CrossF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const ax = a[offset + 0];
    const ay = a[offset + 1];
    const az = a[offset + 2];
    const bx = b[offset + 0];
    const by = b[offset + 1];
    const bz = b[offset + 2];
    out[offset + 0] = ay * bz - az * by;
    out[offset + 1] = az * bx - ax * bz;
    out[offset + 2] = ax * by - ay * bx;
  }
}

/**
 * Transform N points by a 4x4 matrix including the perspective row. Each point
 * is divided by the homogeneous w. Use `unsafeMat4TransformAffinePoint3F32Many`
 * when the matrix is known to be affine (no perspective row).
 */
export function unsafeMat4TransformPoint3F32Many(
  matrix: Float32Array,
  matrixOffset: number,
  points: Float32Array,
  out: Float32Array,
  count: number
): void {
  const xAxisX = matrix[matrixOffset + 0];
  const xAxisY = matrix[matrixOffset + 1];
  const xAxisZ = matrix[matrixOffset + 2];
  const xAxisW = matrix[matrixOffset + 3];
  const yAxisX = matrix[matrixOffset + 4];
  const yAxisY = matrix[matrixOffset + 5];
  const yAxisZ = matrix[matrixOffset + 6];
  const yAxisW = matrix[matrixOffset + 7];
  const zAxisX = matrix[matrixOffset + 8];
  const zAxisY = matrix[matrixOffset + 9];
  const zAxisZ = matrix[matrixOffset + 10];
  const zAxisW = matrix[matrixOffset + 11];
  const originX = matrix[matrixOffset + 12];
  const originY = matrix[matrixOffset + 13];
  const originZ = matrix[matrixOffset + 14];
  const originW = matrix[matrixOffset + 15];
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const x = points[offset + 0];
    const y = points[offset + 1];
    const z = points[offset + 2];
    const w = xAxisW * x + yAxisW * y + zAxisW * z + originW;
    const invW = w === 0 ? 1 : 1 / w;
    out[offset + 0] = (xAxisX * x + yAxisX * y + zAxisX * z + originX) * invW;
    out[offset + 1] = (xAxisY * x + yAxisY * y + zAxisY * z + originY) * invW;
    out[offset + 2] = (xAxisZ * x + yAxisZ * y + zAxisZ * z + originZ) * invW;
  }
}

/**
 * Multiply N matrix pairs `out[i] = a[i] * b[i]`. Each matrix is 16 packed
 * floats. Aliasing with `a` or `b` is safe because each matrix lane is loaded
 * before its corresponding output writes can affect later reads.
 */
export function unsafeMat4MultiplyF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 16;

  for (let base = 0; base < end; base += 16) {
    const a00 = a[base + 0];
    const a01 = a[base + 1];
    const a02 = a[base + 2];
    const a03 = a[base + 3];
    const a10 = a[base + 4];
    const a11 = a[base + 5];
    const a12 = a[base + 6];
    const a13 = a[base + 7];
    const a20 = a[base + 8];
    const a21 = a[base + 9];
    const a22 = a[base + 10];
    const a23 = a[base + 11];
    const a30 = a[base + 12];
    const a31 = a[base + 13];
    const a32 = a[base + 14];
    const a33 = a[base + 15];

    let b0 = b[base + 0];
    let b1 = b[base + 1];
    let b2 = b[base + 2];
    let b3 = b[base + 3];
    out[base + 0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[base + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[base + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[base + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[base + 4];
    b1 = b[base + 5];
    b2 = b[base + 6];
    b3 = b[base + 7];
    out[base + 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[base + 5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[base + 6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[base + 7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[base + 8];
    b1 = b[base + 9];
    b2 = b[base + 10];
    b3 = b[base + 11];
    out[base + 8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[base + 9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[base + 10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[base + 11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[base + 12];
    b1 = b[base + 13];
    b2 = b[base + 14];
    b3 = b[base + 15];
    out[base + 12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[base + 13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[base + 14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[base + 15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
}

/**
 * Componentwise minimum of two packed vec3 streams. Useful for AABB merges
 * over `min`/`max` pairs.
 */
export function unsafeVec3MinF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const ax = a[offset + 0];
    const ay = a[offset + 1];
    const az = a[offset + 2];
    const bx = b[offset + 0];
    const by = b[offset + 1];
    const bz = b[offset + 2];
    out[offset + 0] = ax < bx ? ax : bx;
    out[offset + 1] = ay < by ? ay : by;
    out[offset + 2] = az < bz ? az : bz;
  }
}

/**
 * Componentwise maximum of two packed vec3 streams.
 */
export function unsafeVec3MaxF32Many(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array,
  count: number
): void {
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const ax = a[offset + 0];
    const ay = a[offset + 1];
    const az = a[offset + 2];
    const bx = b[offset + 0];
    const by = b[offset + 1];
    const bz = b[offset + 2];
    out[offset + 0] = ax > bx ? ax : bx;
    out[offset + 1] = ay > by ? ay : by;
    out[offset + 2] = az > bz ? az : bz;
  }
}

/**
 * Expand a single packed AABB (stride 6: minXYZ, maxXYZ) by N packed points.
 * The AABB is mutated in place. Initialize the AABB with min = +Infinity and
 * max = -Infinity for a fresh bound (see `aabbEmptyInto`).
 *
 * Layout: `box[0..2]` is min, `box[3..5]` is max. Points are stride 3.
 */
export function unsafeAabbExpandByPointF32Many(
  box: Float32Array,
  boxOffset: number,
  points: Float32Array,
  count: number
): void {
  let minX = box[boxOffset + 0];
  let minY = box[boxOffset + 1];
  let minZ = box[boxOffset + 2];
  let maxX = box[boxOffset + 3];
  let maxY = box[boxOffset + 4];
  let maxZ = box[boxOffset + 5];
  const end = count * 3;

  for (let offset = 0; offset < end; offset += 3) {
    const x = points[offset + 0];
    const y = points[offset + 1];
    const z = points[offset + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  box[boxOffset + 0] = minX;
  box[boxOffset + 1] = minY;
  box[boxOffset + 2] = minZ;
  box[boxOffset + 3] = maxX;
  box[boxOffset + 4] = maxY;
  box[boxOffset + 5] = maxZ;
}
